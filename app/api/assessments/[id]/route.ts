import { NextResponse } from "next/server";
import { z } from "zod";
import { jobSchema } from "@/lib/contracts/job";
import { apiError, authorize, changeAssessment, loadAssessment, AssessmentError } from "@/lib/services/assessment";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    authorize(request);
    const job = await loadAssessment((await context.params).id);
    return NextResponse.json(jobSchema.parse({ id: job.id, status: job.status.toLowerCase(), progress: job.progress, stage: job.stage,
      error: job.errorCode ? { code: job.errorCode, message: job.errorMessage } : null,
      createdAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString(), hasReport: Boolean(job.analysis) }),
    { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    authorize(request, true);
    if (Number(request.headers.get("content-length")) > 100 || !request.body) throw new AssessmentError(413, "request_too_large", "Invalid request size.");
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0, timedOut = false;
    const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 5000);
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 100) { await reader.cancel(); throw new AssessmentError(413, "request_too_large", "Request is too large."); }
        chunks.push(chunk.value);
      }
    } finally { clearTimeout(timer); reader.releaseLock(); }
    if (timedOut) throw new AssessmentError(408, "request_timeout", "The request timed out.");
    const text = Buffer.concat(chunks).toString("utf8");
    let value: unknown;
    try { value = JSON.parse(text); } catch { throw new AssessmentError(400, "invalid_json", "Request must contain valid JSON."); }
    const parsed = z.object({ action: z.enum(["cancel", "retry"]) }).strict().safeParse(value);
    if (!parsed.success) throw new AssessmentError(400, "invalid_action", "Choose cancel or retry.");
    await changeAssessment((await context.params).id, parsed.data.action);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
