import { z } from "zod";
import { jobStatusSchema } from "@/lib/contracts/job";
import { qualityLabelSchema } from "@/lib/contracts/report";

export const assessmentIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
export const createdAssessmentSchema = z.object({
  id: assessmentIdSchema,
  status: jobStatusSchema,
  reused: z.boolean().optional(),
});
export const historySchema = z.object({
  assessments: z.array(z.object({
    id: assessmentIdSchema,
    status: jobStatusSchema,
    stage: z.string().max(100).nullable(),
    createdAt: z.string().datetime(),
    qualityLabel: qualityLabelSchema.nullable(),
  })),
  nextCursor: z.string().min(1).max(2048).nullable(),
});
export type HistoryItem = z.infer<typeof historySchema>["assessments"][number];
export type CreatedAssessment = z.infer<typeof createdAssessmentSchema>;
export type PrivateSession = { token: string; signal: AbortSignal; onUnauthorized: () => void };
export const okSchema = z.object({ ok: z.literal(true) });
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string().max(1000) }) });

export class AssessmentRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function assessmentRequest<T>(
  path: string, session: PrivateSession, schema: z.ZodType<T>,
  init: RequestInit = {}, signal = session.signal,
): Promise<T> {
  const response = await fetch(path, {
    ...init, signal, cache: "no-store", credentials: "omit", redirect: "error",
    headers: { ...init.headers, authorization: `Bearer ${session.token}` },
  });
  if (session.signal.aborted || signal.aborted) throw new DOMException("Request cancelled", "AbortError");
  if (response.status === 401) {
    session.onUnauthorized();
    throw new AssessmentRequestError("Access key was not accepted. Unlock with a valid key.", 401);
  }
  const value: unknown = await response.json();
  if (session.signal.aborted || signal.aborted) throw new DOMException("Request cancelled", "AbortError");
  if (!response.ok) throw new AssessmentRequestError(
    errorSchema.safeParse(value).data?.error.message ?? "The request could not be completed. Please try again.", response.status,
  );
  return schema.parse(value);
}

export function requestMessage(error: unknown): string {
  return error instanceof AssessmentRequestError ? error.message :
    error instanceof z.ZodError ? "The service returned an invalid response. Please refresh or contact the app owner." :
      "The service could not be reached. Check your connection and try again.";
}

export function isActive(status: string): boolean { return status === "queued" || status === "processing"; }

export function stageLabel(stage: string | null): string {
  const labels: Record<string, string> = {
    queued: "Waiting for a processor", media: "Preparing media and transcript", analysis: "Reviewing evidence",
    completed: "Assessment complete", insufficient_evidence: "Not enough validated evidence",
    cancelled: "Cancelled", expired: "Processing window expired", failed: "Processing stopped",
  };
  return stage ? labels[stage] ?? stage.replaceAll("_", " ") : "Waiting for a status update";
}

// Child requests can be cancelled independently; every request also belongs to its unlock session.
export function sessionRequestController(session: PrivateSession) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (session.signal.aborted) abort();
  session.signal.addEventListener("abort", abort, { once: true });
  return { controller, dispose: () => { controller.abort(); session.signal.removeEventListener("abort", abort); } };
}
