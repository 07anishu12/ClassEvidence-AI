import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, open, realpath, rm } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { env } from "../config/env";
import { getPrisma } from "../db/prisma";
import { coachingReportSchema } from "../domain/report";
import { privateMediaRoot } from "./media-storage";

export class AssessmentError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
export function apiError(error: unknown) {
  const safe = error instanceof AssessmentError ? error : new AssessmentError(503, "service_unavailable", "Assessment storage or processing is unavailable.");
  return NextResponse.json(
    { error: safe.message, code: safe.code, message: safe.message },
    {
      status: safe.status,
      headers: { "Cache-Control": "no-store", ...(safe.status === 429 ? { "Retry-After": "60" } : {}) },
    },
  );
}
const attempts: number[] = [];
export function authorize(request: Request, mutation = false) {
  const expected = env.ASSESSMENT_ACCESS_TOKEN;
  if (!expected) throw new AssessmentError(503, "auth_unconfigured", "Private assessment access is not configured.");
  const actual = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (actual.length > 256 || !timingSafeEqual(createHash("sha256").update(actual).digest(), createHash("sha256").update(expected).digest())) {
    throw new AssessmentError(401, "unauthorized", "A valid assessment access token is required.");
  }
  if (mutation) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(env.APP_ORIGIN).origin) throw new AssessmentError(403, "origin_rejected", "This request origin is not permitted.");
    const now = Date.now();
    while (attempts.length && attempts[0] < now - 60_000) attempts.shift();
    if (attempts.length >= 6) throw new AssessmentError(429, "rate_limited", "Please wait before creating another assessment.");
    attempts.push(now);
  }
}
export function database() {
  const db = getPrisma();
  if (!db) throw new AssessmentError(503, "database_unavailable", "Assessment storage is not configured.");
  return db;
}
export async function loadAssessment(id: string) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new AssessmentError(400, "invalid_job_id", "Invalid assessment ID.");
  const job = await database().assessmentJob.findUnique({ where: { id } });
  if (!job) throw new AssessmentError(404, "job_not_found", "Assessment was not found.");
  return job;
}
export function extractIdempotencyKey(request: Request): string | null {
  const headerKey = request.headers.get("idempotency-key") || request.headers.get("x-idempotency-key");
  if (!headerKey) return null;
  const trimmed = headerKey.trim();
  if (!trimmed || trimmed.length > 256 || !/^[A-Za-z0-9_.:-]+$/.test(trimmed)) {
    throw new AssessmentError(400, "invalid_idempotency_key", "The idempotency key is invalid.");
  }
  return trimmed;
}

export async function createAssessment(request: Request) {
  authorize(request, true);
  if (request.headers.get("x-recording-consent") !== "true") throw new AssessmentError(400, "consent_required", "Confirm permission to process this recording.");
  const mime = request.headers.get("content-type")?.split(";")[0];
  const headerIdempotencyKey = extractIdempotencyKey(request);

  if (mime === "application/json") {
    if (headerIdempotencyKey) {
      const db = database();
      const existing = await db.assessmentJob.findUnique({ where: { idempotencyKey: headerIdempotencyKey } });
      if (existing) {
        return { id: existing.id, status: existing.status.toLowerCase(), reused: true };
      }
    }
    let payloadKey: string | null = null;
    if (request.body) {
      try {
        const text = await request.text();
        if (text) {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed.idempotencyKey === "string") {
            const trimmed = parsed.idempotencyKey.trim();
            if (trimmed && trimmed.length <= 256 && /^[A-Za-z0-9_.:-]+$/.test(trimmed)) {
              payloadKey = trimmed;
            }
          }
        }
      } catch {
        // Malformed JSON or binary data under application/json falls through to source_unavailable
      }
    }
    if (payloadKey) {
      const db = database();
      const existing = await db.assessmentJob.findUnique({ where: { idempotencyKey: payloadKey } });
      if (existing) {
        return { id: existing.id, status: existing.status.toLowerCase(), reused: true };
      }
    }
    throw new AssessmentError(422, "source_unavailable", "Drive import is not configured. Download a permitted file and upload it privately.");
  }

  if (headerIdempotencyKey) {
    const db = database();
    const existing = await db.assessmentJob.findUnique({ where: { idempotencyKey: headerIdempotencyKey } });
    if (existing) {
      return { id: existing.id, status: existing.status.toLowerCase(), reused: true };
    }
  }

  return queuePrivateRecording(request, { idempotencyKey: headerIdempotencyKey ?? undefined });
}

/** Trusted operator boundary: callers must establish consent and source authorization first. */
export async function queuePrivateRecording(
  request: Request,
  checks?: { dataset?: boolean; md5?: string; sha256?: string; idempotencyKey?: string },
) {
  const db = database();
  const mime = request.headers.get("content-type")?.split(";")[0];
  const extension = mime === "video/mp4" ? "mp4" : mime === "video/quicktime" ? "mov" : mime === "video/webm" ? "webm" : null;
  if (!extension || !request.body) throw new AssessmentError(415, "unsupported_media", "Upload an MP4, MOV, or WebM recording.");
  const declared = Number(request.headers.get("content-length"));
  if (declared > env.MAX_UPLOAD_BYTES) throw new AssessmentError(413, "upload_too_large", "The recording exceeds the upload limit.");
  const root = privateMediaRoot(env.PRIVATE_MEDIA_ROOT);
  await mkdir(root, { recursive: true, mode: 0o700 });
  if (await realpath(root) !== root) throw new AssessmentError(503, "storage_unavailable", "Private media storage is unavailable.");
  const name = `${randomUUID()}.${extension}`;
  const path = join(root, name);
  const file = await open(path, "wx", 0o600);
  const reader = request.body.getReader();
  let size = 0, head = Buffer.alloc(0);
  const sha256 = createHash("sha256"), md5 = createHash("md5");
  let timedOut = false;
  const deadline = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 120_000);
  let complete = false;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) { complete = true; break; }
      size += chunk.value.byteLength;
      sha256.update(chunk.value); md5.update(chunk.value);
      if (size > env.MAX_UPLOAD_BYTES) throw new AssessmentError(413, "upload_too_large", "The recording exceeds the upload limit.");
      if (head.length < 16) head = Buffer.concat([head, Buffer.from(chunk.value)]).subarray(0, 16);
      await file.writeFile(chunk.value);
    }
    const contentMatches = extension === "webm" ? head.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])) : head.subarray(4, 8).toString() === "ftyp";
    if (!size || !contentMatches || (declared && declared !== size) || request.signal.aborted || timedOut) {
      throw new AssessmentError(415, "invalid_media", "Recording content does not match a supported container.");
    }
    const digest = sha256.digest("hex"), md5Digest = md5.digest("hex");
    if (checks?.md5 && checks.md5 !== md5Digest || checks?.sha256 && checks.sha256 !== digest) {
      throw new AssessmentError(422, "source_integrity_failed", "Recording checksum does not match the source metadata.");
    }
    const idempotencyKey = checks?.idempotencyKey ?? (checks?.dataset ? `dataset:${digest}` : undefined);
    const data = { sourceKind: "UPLOAD" as const, sourceRef: `private://${name}`, idempotencyKey,
      stage: "queued", events: { create: { eventType: "job.created", message: "Private recording queued for local processing." } } };
    let job;
    try { job = await db.assessmentJob.create({ data }); }
    catch (error) {
      // The unique database key arbitrates concurrent imports, including different Drive IDs of identical bytes.
      if (!idempotencyKey || !(error instanceof Error) || !("code" in error) || error.code !== "P2002") throw error;
      job = await db.assessmentJob.findUnique({ where: { idempotencyKey } });
      if (!job) throw error;
      await rm(path, { force: true });
      return { id: job.id, status: job.status.toLowerCase(), reused: true };
    }
    return { id: job.id, status: "queued" as const, ...(checks?.dataset ? { reused: false } : {}) };
  } catch (error) { await rm(path, { force: true }); throw error; }
  finally { clearTimeout(deadline); if (!complete) await reader.cancel().catch(() => {}); reader.releaseLock(); await file.close(); }
}
export async function changeAssessment(id: string, action: "cancel" | "retry") {
  const db = database();
  await loadAssessment(id);
  if (action === "cancel") {
    const job = await loadAssessment(id);
    const result = await db.assessmentJob.updateMany({ where: { id, status: { in: ["QUEUED", "PROCESSING"] } }, data: {
      cancelRequested: true, status: "FAILED", stage: "cancelled", errorCode: "cancelled", errorMessage: "Assessment cancelled.", leaseToken: null, leaseUntil: null,
    } });
    if (!result.count) throw new AssessmentError(409, "invalid_state", "Only queued or processing assessments can be cancelled.");
    if (job.status === "QUEUED" && /^private:\/\/[a-f0-9-]{36}\.(mp4|mov|webm)$/.test(job.sourceRef)) {
      await rm(join(privateMediaRoot(env.PRIVATE_MEDIA_ROOT), job.sourceRef.slice("private://".length)), { force: true });
    }
  } else {
    throw new AssessmentError(409, "retry_unavailable", "Private source files are deleted after processing. Upload the recording again to retry.");
  }
}
export async function getAssessmentReport(id: string) {
  const job = await loadAssessment(id);
  const parsed = coachingReportSchema.safeParse(job.analysis);
  if (!parsed.success) throw new AssessmentError(409, "report_unavailable", "A report is not available yet.");
  return parsed.data;
}

export async function listAssessments(cursor?: string | null, limit = 20) {
  const db = database();
  if (cursor && !/^[A-Za-z0-9_-]{1,100}$/.test(cursor)) {
    throw new AssessmentError(400, "invalid_cursor", "Invalid pagination cursor.");
  }
  const take = Math.min(Math.max(limit, 1), 50);
  const jobs = await db.assessmentJob.findMany({
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      stage: true,
      createdAt: true,
      analysis: true,
    },
  });

  const hasMore = jobs.length > take;
  const items = hasMore ? jobs.slice(0, take) : jobs;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return {
    assessments: items.map((job) => {
      let qualityLabel: string | null = null;
      if (job.analysis && typeof job.analysis === "object") {
        const analysis = job.analysis as Record<string, unknown>;
        if (typeof analysis.qualityLabel === "string") {
          qualityLabel = analysis.qualityLabel;
        } else if (
          analysis.report &&
          typeof analysis.report === "object" &&
          typeof (analysis.report as Record<string, unknown>).qualityLabel === "string"
        ) {
          qualityLabel = (analysis.report as Record<string, unknown>).qualityLabel as string;
        }
      }
      return {
        id: job.id,
        status: job.status.toLowerCase(),
        stage: job.stage,
        createdAt: job.createdAt.toISOString(),
        qualityLabel,
      };
    }),
    nextCursor,
  };
}

export async function deleteAssessment(id: string) {
  const db = database();
  const job = await loadAssessment(id);
  if (job.status === "QUEUED" || job.status === "PROCESSING") {
    throw new AssessmentError(409, "invalid_state", "Active assessments cannot be deleted.");
  }
  if (job.sourceRef.startsWith("private://")) {
    const filename = job.sourceRef.slice("private://".length);
    if (/^[a-f0-9-]{36}\.(mp4|mov|webm)$/.test(filename)) {
      try {
        await rm(join(privateMediaRoot(env.PRIVATE_MEDIA_ROOT), filename), { force: true });
      } catch {
        // Safe ignoring of filesystem unlinking if file does not exist
      }
    }
  }
  await db.assessmentJob.delete({ where: { id } });
  return { ok: true };
}
