import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, opendir, realpath, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";
import { env } from "../lib/config/env";
import { generateReport } from "../lib/services/report";
import { providerInstructions } from "../lib/providers/adapters";
import { providerEvidenceOutputSchema, type AssessmentProvider } from "../lib/providers/types";
import { modelInputManifestSchema } from "../lib/providers/manifest";
import { coachingReportSchema, type CoachingReport } from "../lib/domain/report";
import { RUBRIC_VERSION, rubricDimensions } from "../lib/domain/rubric";
import { privateMediaRoot } from "../lib/services/media-storage";

const db = new PrismaClient();
// Optional types allow the coordinator's env/schema additions to land independently.
const config: typeof env & { MAX_RECORDING_SECONDS?: number; REPORT_RETENTION_DAYS?: number;
  PYTHON_EXECUTABLE?: string; LOCAL_MODEL_TIMEOUT_MS?: number; LOCAL_MODEL_MAX_OUTPUT_TOKENS?: number } = env;
const UUID = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const uploadName = new RegExp(`^${UUID}\\.(mp4|mov|webm)$`);
const scratchName = new RegExp(`^work-(${UUID})$`);
const terminal = ["COMPLETED", "FAILED"] as const;
const MAX_RETRIES = 2;
const LEASE_MS = 60_000;
const errors: Record<string, string> = {
  provider_blocked: "No permitted local model is configured. Configure one and upload again.",
  provider_unavailable: "The local model is unavailable. Check the local processor and upload again.",
  provider_timeout: "The local model exceeded its processing time limit.",
  provider_invalid_output: "The local model returned an invalid response; no assessment was accepted.",
  provider_budget_exceeded: "The local model exceeded its output limit.",
  provider_rate_limited: "The local processor is busy. Upload again later.",
  provider_input_invalid: "The prepared evidence could not be validated.",
  transcription_unavailable: "The local speech model or speech executable is unavailable.",
  transcription_timeout: "Local transcription exceeded its time limit.",
  transcript_invalid: "The local transcript could not be validated.",
  invalid_media: "The recording is corrupt or is not a supported media container.",
  unsupported_duration: "The recording exceeds the configured duration limit or has no valid duration.",
  unsupported_codec: "The recording does not contain a supported video codec.",
  unsupported_resolution: "The recording exceeds the supported video resolution.",
  media_tools_unavailable: "The local FFmpeg media tools are unavailable.",
  media_timeout: "Media preparation exceeded its time limit.",
  media_preparation_failed: "The local media processor could not prepare this recording.",
  source_deleted: "The private recording was removed during processing. Upload it again.",
  source_integrity_failed: "The private recording no longer matches the uploaded file.",
  invalid_source: "The private recording is not a valid regular upload file.",
  scoring_invalid: "Model ratings failed evidence validation; no assessment was accepted.",
  evidence_invalid: "Model observations failed source grounding; no assessment was accepted.",
  processing_failed: "Processing could not complete. Check the local processor and upload again.",
};
export class WorkerError extends Error {
  constructor(readonly code: string) { super(code); }
}
function safeCode(error: unknown): string {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  return typeof code === "string" && Object.hasOwn(errors, code) ? code : "processing_failed";
}
export type Claim = { id: string; sourceRef: string; leaseToken: string; retryCount: number;
  contentSha256?: string | null; sizeBytes?: bigint | null };
type Database = PrismaClient | Prisma.TransactionClient;

/** All ownership decisions use the database clock, including renewal after pauses. */
export async function claimNext(client: Database = db): Promise<Claim | undefined> {
  const token = randomUUID();
  const rows = await client.$queryRaw<Claim[]>`UPDATE "AssessmentJob" SET
    "retryCount"=CASE WHEN status='PROCESSING' THEN "retryCount"+1 ELSE "retryCount" END,
    status='PROCESSING', stage='probing', progress=0, "errorCode"=NULL, "errorMessage"=NULL,
    "leaseToken"=${token}, "leaseUntil"=NOW()+INTERVAL '60 seconds', "heartbeatAt"=NOW(), "updatedAt"=NOW()
    WHERE id=(SELECT id FROM "AssessmentJob" WHERE "cancelRequested"=false
      AND "createdAt">NOW()-INTERVAL '1 hour' AND "retryCount"<=${MAX_RETRIES}
      AND ((status='QUEUED' AND ("leaseUntil" IS NULL OR "leaseUntil"<=NOW()))
        OR (status='PROCESSING' AND ("leaseUntil" IS NULL OR "leaseUntil"<=NOW()) AND "retryCount"<${MAX_RETRIES}))
      ORDER BY "createdAt", id FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING *`;
  return rows[0];
}

export async function heartbeatClaim(job: Claim, client: Database = db): Promise<void> {
  const count = await client.$executeRaw`UPDATE "AssessmentJob" SET "heartbeatAt"=NOW(),
    "leaseUntil"=NOW()+INTERVAL '60 seconds' WHERE id=${job.id} AND status='PROCESSING'
    AND "leaseToken"=${job.leaseToken} AND "leaseUntil">NOW() AND "cancelRequested"=false
    AND "createdAt">NOW()-INTERVAL '1 hour'`;
  if (!count) throw new WorkerError("lease_lost");
}

export async function setStage(job: Claim, stage: "probing" | "transcribing" | "analysis", client: Database = db): Promise<void> {
  const count = await client.$executeRaw`UPDATE "AssessmentJob" SET stage=${stage}, progress=0, "updatedAt"=NOW()
    WHERE id=${job.id} AND status='PROCESSING' AND "leaseToken"=${job.leaseToken}
      AND "leaseUntil">NOW() AND "cancelRequested"=false AND "createdAt">NOW()-INTERVAL '1 hour'`;
  if (!count) throw new WorkerError("lease_lost");
}

export async function failClaim(job: Claim, error: unknown, client: PrismaClient = db): Promise<void> {
  const code = safeCode(error);
  const retry = ["provider_timeout", "provider_unavailable", "provider_rate_limited", "media_timeout", "transcription_timeout"].includes(code)
    && job.retryCount < MAX_RETRIES;
  await client.$transaction(async (tx) => {
    const count = await tx.$executeRaw`UPDATE "AssessmentJob" SET
      status=${retry ? "QUEUED" : "FAILED"}::"JobStatus", stage=${retry ? "retry_wait" : "failed"}, progress=0,
      "errorCode"=${code}, "errorMessage"=${errors[code]}, "leaseToken"=NULL,
      "leaseUntil"=CASE WHEN ${retry} THEN NOW()+${job.retryCount === 0 ? 30 : 120}*INTERVAL '1 second' ELSE NULL END,
      "retryCount"="retryCount"+${retry ? 1 : 0},
      "idempotencyKey"=CASE WHEN ${retry} THEN "idempotencyKey" ELSE NULL END, "updatedAt"=NOW()
      WHERE id=${job.id} AND status='PROCESSING' AND "leaseToken"=${job.leaseToken}
        AND "leaseUntil">NOW() AND "cancelRequested"=false AND "createdAt">NOW()-INTERVAL '1 hour'`;
    if (count) await tx.processingEvent.create({ data: { jobId: job.id, eventType: retry ? "job.retry" : "job.failed", message: code } });
  });
}

export async function completeClaim(job: Claim, analysis: CoachingReport, client: PrismaClient = db): Promise<void> {
  // Revalidate even the locally constructed no-audio envelope before persistence.
  analysis = coachingReportSchema.parse(analysis);
  await client.$transaction(async (tx) => {
    const count = await tx.$executeRaw`UPDATE "AssessmentJob" SET
      status=${analysis.report ? "COMPLETED" : "FAILED"}::"JobStatus",
      progress=${analysis.report ? 100 : 0}, stage=${analysis.report ? "completed" : "insufficient_evidence"},
      "errorCode"=${analysis.report ? null : "insufficient_evidence"},
      "errorMessage"=${analysis.report ? null : "Available evidence does not support an overall label. Review the limitations."},
      analysis=${JSON.stringify(analysis)}::jsonb, "leaseToken"=NULL, "leaseUntil"=NULL,
      "idempotencyKey"=CASE WHEN ${!!analysis.report} THEN "idempotencyKey" ELSE NULL END, "updatedAt"=NOW()
      WHERE id=${job.id} AND status='PROCESSING' AND "leaseToken"=${job.leaseToken}
        AND "leaseUntil">NOW() AND "cancelRequested"=false AND "createdAt">NOW()-INTERVAL '1 hour'`;
    if (!count) throw new WorkerError("lease_lost");
    if (analysis.report) {
      const report = analysis.report;
      const rubric = await tx.rubricVersion.upsert({ where: { version: RUBRIC_VERSION }, create: { version: RUBRIC_VERSION,
        weights: Object.fromEntries(rubricDimensions.map((d) => [d.key, d.weight])) }, update: {} });
      await tx.assessmentReport.create({ data: {
        jobId: job.id, rubricVersionId: rubric.id, qualityLabel: report.qualityLabel.toUpperCase() as "POOR" | "AVERAGE" | "GOOD" | "EXCELLENT",
        scorePercent: report.scorePercent, confidence: report.confidence, limitations: report.assessmentLimitations,
        recommendations: report.recommendations, dimensions: { create: report.dimensions.map((d) => ({ ...d })) },
        observations: { create: report.observations.map((o) => ({ evidenceId: o.id, startSec: o.startSec, endSec: o.endSec,
          claim: o.claim, evidence: o.evidence, modality: o.modality.toUpperCase() as "TRANSCRIPT" | "VIDEO" | "AUDIO" | "METADATA",
          impact: o.impact.toUpperCase() as "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "NOT_ASSESSABLE", provenance: o.provenance })) },
      } });
    }
    await tx.processingEvent.create({ data: { jobId: job.id, eventType: "job.terminal", message: analysis.report ? "Assessment completed." : "Insufficient evidence for a label." } });
  });
}

async function storageRoot(configured: string): Promise<string> {
  const root = privateMediaRoot(configured);
  await mkdir(root, { recursive: true, mode: 0o700 });
  if (await realpath(root) !== root || !(await lstat(root)).isDirectory()) throw new WorkerError("invalid_source");
  return root;
}
async function entry(path: string) {
  try { return await lstat(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
async function removeSource(root: string, sourceRef: string, client: Database): Promise<void> {
  const name = sourceRef.slice("private://".length);
  if (!sourceRef.startsWith("private://") || !uploadName.test(name)) return;
  if (await client.assessmentJob.findFirst({ where: { sourceRef, status: { in: ["QUEUED", "PROCESSING"] } }, select: { id: true } })) return;
  const info = await entry(join(root, name));
  if (info?.isFile() && info.nlink === 1) await rm(join(root, name), { force: true });
}

export async function cleanupExpired(client: PrismaClient = db, configuredRoot = env.PRIVATE_MEDIA_ROOT,
  retentionDays = config.REPORT_RETENTION_DAYS ?? 30): Promise<void> {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) throw new Error("invalid_retention");
  await client.$executeRaw`UPDATE "AssessmentJob" SET status='FAILED', progress=0,
    stage=CASE WHEN "cancelRequested" THEN 'cancelled' ELSE 'expired' END,
    "errorCode"=CASE WHEN "cancelRequested" THEN 'cancelled' ELSE 'processing_expired' END,
    "errorMessage"=CASE WHEN "cancelRequested" THEN 'Assessment cancelled.' ELSE 'The private processing window expired. Upload the recording again.' END,
    "leaseToken"=NULL, "leaseUntil"=NULL, "idempotencyKey"=NULL, "updatedAt"=NOW()
    WHERE status IN ('QUEUED','PROCESSING') AND ("cancelRequested" OR "createdAt"<=NOW()-INTERVAL '1 hour'
      OR (status='PROCESSING' AND ("leaseUntil" IS NULL OR "leaseUntil"<=NOW()) AND "retryCount">=${MAX_RETRIES}))`;
  // Repair pre-RC failures/cancellations without extending their retention deadline.
  await client.$executeRaw`UPDATE "AssessmentJob" SET "idempotencyKey"=NULL WHERE status='FAILED' AND "idempotencyKey" IS NOT NULL`;
  const root = await storageRoot(configuredRoot);
  let after: string | undefined;
  for (;;) {
    const jobs = await client.assessmentJob.findMany({ where: { status: { in: [...terminal] }, ...(after ? { id: { gt: after } } : {}) },
      select: { id: true, sourceRef: true }, orderBy: { id: "asc" }, take: 200 });
    if (!jobs.length) break;
    for (const job of jobs) {
      await removeSource(root, job.sourceRef, client);
      // Cascades delete both normalized reports/evidence and events, plus the JSON snapshot.
      await client.$executeRaw`DELETE FROM "AssessmentJob" WHERE id=${job.id} AND status IN ('COMPLETED','FAILED')
        AND "updatedAt"<NOW()-${retentionDays}*INTERVAL '1 day'`;
    }
    after = jobs[jobs.length - 1].id;
  }
  const cutoff = Date.now() - 3_600_000;
  // Streaming directory iteration and keyset paging keep cleanup bounded in memory.
  for await (const item of await opendir(root)) {
    if (!uploadName.test(item.name) && !scratchName.test(item.name)) continue;
    const path = join(root, item.name);
    const info = await entry(path);
    if (!info || info.isSymbolicLink() || Math.max(info.mtimeMs, info.ctimeMs) >= cutoff) continue;
    if (uploadName.test(item.name) && info.isFile() && info.nlink === 1) {
      if (!await client.assessmentJob.findFirst({ where: { sourceRef: `private://${item.name}` }, select: { id: true } })) await rm(path, { force: true });
    } else if (scratchName.test(item.name) && info.isDirectory()) {
      const token = scratchName.exec(item.name)![1];
      // An expired-but-not-yet-reclaimed token still protects its scratch. Never use mtime alone.
      if (!await client.assessmentJob.findFirst({ where: { status: "PROCESSING", leaseToken: token }, select: { id: true } })) {
        await rm(path, { recursive: true, force: true });
      }
    }
  }
}

/** Wait for close after a kill: no retry can overlap the old local process group. */
export function runBoundedProcess(executable: string, args: string[], options: { signal: AbortSignal; timeoutMs: number;
  maxBytes: number; input?: string; mode: "media" | "model"; onStage?: (stage: "probing" | "transcribing") => void }): Promise<string> {
  if (options.signal.aborted) return Promise.reject(options.signal.reason ?? new WorkerError("lease_lost"));
  return new Promise((accept, reject) => {
    const child = spawn(executable, args, { detached: true,
      env: { PATH: process.env.PATH, PYTHONPATH: resolve("worker/src"), LANG: "C.UTF-8", NODE_ENV: "production", OMP_NUM_THREADS: "2" },
      stdio: ["pipe", "pipe", "pipe"] });
    let bytes = 0, stderrBytes = 0, stderr = "", failure: unknown;
    const chunks: Buffer[] = [];
    const kill = (error: unknown) => {
      failure ??= error;
      try { if (child.pid) process.kill(-child.pid, "SIGKILL"); } catch { /* Already exited. */ }
    };
    const abort = () => kill(options.signal.reason ?? new WorkerError("lease_lost"));
    const timer = setTimeout(() => kill(new WorkerError(options.mode === "media" ? "media_timeout" : "provider_timeout")), options.timeoutMs);
    options.signal.addEventListener("abort", abort, { once: true });
    if (options.signal.aborted) abort();
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > options.maxBytes) kill(new WorkerError(options.mode === "media" ? "media_preparation_failed" : "provider_budget_exceeded"));
      else if (!failure) chunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      // Never forward child output, even when it claims to be an error message.
      stderrBytes += chunk.length;
      stderr += chunk.toString("utf8");
      if (stderrBytes > 2048) { kill(new WorkerError("processing_failed")); return; }
      let end: number;
      while ((end = stderr.indexOf("\n")) >= 0) {
        const line = stderr.slice(0, end); stderr = stderr.slice(end + 1);
        if (line === "stage:probing" || line === "stage:transcribing") options.onStage?.(line.slice(6) as "probing" | "transcribing");
        else if (Object.hasOwn(errors, line)) failure ??= new WorkerError(line);
      }
    });
    child.on("error", () => { failure ??= new WorkerError(options.mode === "media" ? "media_tools_unavailable" : "provider_unavailable"); });
    child.stdin.on("error", () => kill(new WorkerError(options.mode === "media" ? "media_preparation_failed" : "provider_unavailable")));
    child.on("close", (code) => {
      clearTimeout(timer); options.signal.removeEventListener("abort", abort);
      if (failure) reject(failure);
      else if (code !== 0) reject(new WorkerError(options.mode === "media" ? "media_preparation_failed" : "provider_unavailable"));
      else accept(Buffer.concat(chunks).toString("utf8"));
    });
    child.stdin.end(options.input);
  });
}

const mediaResultSchema = z.object({ manifest: modelInputManifestSchema, hasAudio: z.boolean(),
  transcriptionVersion: z.string().regex(/^sha256:[a-f0-9]{64}$/).nullable() }).strict();
export function insufficientMedia(result: z.infer<typeof mediaResultSchema>): CoachingReport {
  if (result.manifest.artifacts.length) throw new WorkerError("provider_input_invalid");
  return coachingReportSchema.parse({ status: "insufficient_evidence", providerVersion: result.transcriptionVersion ?? "local-media-probe-v1",
    recordingSha256: result.manifest.sourceSha256 ?? null, sourceArtifacts: [], report: null, observations: [], strengths: [], opportunities: [], nextSteps: [],
    limitations: [result.hasAudio ? "No usable speech evidence was produced in the sampled audio intervals." : "The probed recording has no audio stream; speech dimensions are not_assessable.",
      "Visual teaching activity has not been assessed. Missing evidence is not evidence of poor teaching."],
    confidence: 0, confidenceBasis: { temporalCoverage: 0, evidenceQuality: 0, agreement: null, assessableWeight: 0 } });
}

function localProvider(signal: AbortSignal): AssessmentProvider {
  const timeoutMs = config.LOCAL_MODEL_TIMEOUT_MS ?? 120_000;
  const maxOutputTokens = config.LOCAL_MODEL_MAX_OUTPUT_TOKENS ?? 4000;
  return { name: "local", async analyze(input) {
    const body = JSON.stringify({ input, instructions: providerInstructions, maxOutputTokens });
    if (Buffer.byteLength(body) > 8_000_000) throw new WorkerError("provider_budget_exceeded");
    const raw = await runBoundedProcess(process.execPath, [resolve(".worker-build/scripts/local-model.js"), env.LOCAL_MODEL!, String(timeoutMs), String(maxOutputTokens)],
      { signal, timeoutMs, maxBytes: 100_000, input: body, mode: "model" });
    const response = z.object({ output: providerEvidenceOutputSchema, usage: z.object({ inputTokens: z.number().int().min(0).max(1_000_000),
      outputTokens: z.number().int().min(0).max(maxOutputTokens) }).strict() }).strict().safeParse(JSON.parse(raw));
    if (!response.success) throw new WorkerError("provider_invalid_output");
    return response.data.output;
  } };
}

// One invocation at a time per process. Across processes, PostgreSQL arbitrates individual claims.
let busy = false;
export async function processOne(client: PrismaClient = db, shutdown?: AbortSignal): Promise<boolean> {
  if (busy || shutdown?.aborted) return false;
  busy = true;
  let heartbeat: ReturnType<typeof setTimeout> | undefined, watchdog: ReturnType<typeof setTimeout> | undefined;
  let scratch: string | undefined, path: string | undefined, root: string | undefined;
  const controller = new AbortController();
  const stop = () => controller.abort(new WorkerError("worker_stopping"));
  shutdown?.addEventListener("abort", stop, { once: true });
  let job: Claim | undefined;
  try {
    job = await claimNext(client);
    if (!job) return false;
    const claim = job;
    // Abort independently of a hung DB heartbeat; late query results cannot revive an expired claim.
    const armWatchdog = (started = Date.now()) => { clearTimeout(watchdog);
      watchdog = setTimeout(() => controller.abort(new WorkerError("lease_lost")), Math.max(1, LEASE_MS - 10_000 - (Date.now() - started))); };
    armWatchdog();
    root = await storageRoot(env.PRIVATE_MEDIA_ROOT);
    const name = job.sourceRef.slice("private://".length);
    if (!job.sourceRef.startsWith("private://") || !uploadName.test(name)) throw new WorkerError("invalid_source");
    path = join(root, name);
    const source = await entry(path);
    if (!source) throw new WorkerError("source_deleted");
    if (!source.isFile() || source.nlink !== 1) throw new WorkerError("invalid_source");
    const checkSource = async () => {
      const current = await entry(path!);
      if (!current) throw new WorkerError("source_deleted");
      if (!current.isFile() || current.dev !== source.dev || current.ino !== source.ino || current.size !== source.size || current.mtimeMs !== source.mtimeMs) {
        throw new WorkerError("source_integrity_failed");
      }
    };
    const pulse = async () => {
      const started = Date.now();
      try { await checkSource(); await heartbeatClaim(claim, client); if (!controller.signal.aborted) { armWatchdog(started); heartbeat = setTimeout(() => void pulse(), 10_000); } }
      catch (error) { controller.abort(error instanceof WorkerError ? error : new WorkerError("lease_lost")); }
    };
    heartbeat = setTimeout(() => void pulse(), 10_000);
    scratch = join(root, `work-${job.leaseToken}`);
    await mkdir(scratch, { mode: 0o700 });
    const permitted = env.ASSESSMENT_PROVIDER === "local" && !!env.LOCAL_MODEL;
    const args = ["-m", "media.pipeline", path, "--job-id", job.id, "--scratch", scratch,
      "--max-seconds", String(config.MAX_RECORDING_SECONDS ?? 7200), "--max-bytes", String(env.MAX_UPLOAD_BYTES)];
    if (!permitted) args.push("--provider-blocked");
    if (env.WHISPER_MODEL_PATH) args.push("--model", env.WHISPER_MODEL_PATH);
    if (job.contentSha256) args.push("--expected-sha256", job.contentSha256);
    if (job.sizeBytes != null) args.push("--expected-bytes", String(job.sizeBytes));
    let stages = Promise.resolve();
    const media = await runBoundedProcess(config.PYTHON_EXECUTABLE ?? "python3", args, { signal: controller.signal, timeoutMs: 650_000,
      maxBytes: 8_000_000, mode: "media", onStage(stage) {
        stages = stages.then(() => setStage(claim, stage, client)).catch(() => { controller.abort(new WorkerError("lease_lost")); });
      } });
    await stages;
    const result = mediaResultSchema.parse(JSON.parse(media));
    if (result.manifest.jobId !== job.id || job.contentSha256 && result.manifest.sourceSha256 !== job.contentSha256) throw new WorkerError("source_integrity_failed");
    controller.signal.throwIfAborted();
    if (result.hasAudio && !permitted) throw new WorkerError("provider_blocked");
    let analysis: CoachingReport;
    if (!result.manifest.artifacts.length) analysis = insufficientMedia(result);
    else {
      await setStage(job, "analysis", client);
      analysis = await generateReport(result.manifest, localProvider(controller.signal));
      if (result.transcriptionVersion) analysis = coachingReportSchema.parse({ ...analysis,
        limitations: [...analysis.limitations, `Local ASR model ${result.transcriptionVersion}; sampled speech, no verified speaker identity.`] });
    }
    await checkSource();
    controller.signal.throwIfAborted();
    await completeClaim(job, analysis, client);
    return true;
  } catch (error) {
    const reason = controller.signal.aborted ? controller.signal.reason : error;
    if (job && !(reason instanceof WorkerError && ["lease_lost", "worker_stopping"].includes(reason.code))) await failClaim(job, reason, client);
    else if (!job) throw error;
    return !!job;
  } finally {
    clearTimeout(heartbeat); clearTimeout(watchdog); controller.abort(); shutdown?.removeEventListener("abort", stop);
    try {
      if (scratch) await rm(scratch, { recursive: true, force: true });
      if (job && root) await removeSource(root, job.sourceRef, client);
    } finally { busy = false; }
  }
}

async function main() {
  if (!env.DATABASE_URL) throw new Error("database_unconfigured");
  if (process.argv.includes("--cleanup")) { await cleanupExpired(); return; }
  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.once("SIGTERM", stop); process.once("SIGINT", stop);
  let cleaning: Promise<void> | undefined;
  const clean = () => cleaning ??= cleanupExpired().catch(() => { console.error("worker_cleanup_failed"); }).finally(() => { cleaning = undefined; });
  await clean();
  const maintenance = setInterval(() => { void clean(); }, 60_000);
  try {
    do {
      try { if (!await processOne(db, shutdown.signal)) await new Promise((r) => setTimeout(r, 1000)); }
      catch { console.error("worker_iteration_failed"); await new Promise((r) => setTimeout(r, 5000)); }
    } while (!shutdown.signal.aborted && !process.argv.includes("--once"));
  } finally { clearInterval(maintenance); await cleaning; process.removeListener("SIGTERM", stop); process.removeListener("SIGINT", stop); }
}
if (require.main === module) main().catch(() => { console.error("worker_unavailable"); process.exitCode = 1; }).finally(() => db.$disconnect());
