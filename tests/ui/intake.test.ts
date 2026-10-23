import { afterEach, describe, expect, it, vi } from "vitest";
import { fileProblem, formatBytes, sourceProblem } from "../../components/recording-intake";
import { assessmentRequest, createdAssessmentSchema, historySchema, okSchema } from "../../components/assessment-client";

afterEach(() => vi.unstubAllGlobals());

describe("intake boundaries", () => {
  it("rejects empty, oversized, unsupported and mismatched files while accepting missing browser MIME", () => {
    const file = { name: "synthetic.mp4", type: "video/mp4", size: 1024 };
    expect(fileProblem(file, 1024)).toBeNull();
    expect(fileProblem({ ...file, size: 0 }, 1024)).toContain("empty");
    expect(fileProblem({ ...file, size: 1025 }, 1024)).toContain("limit");
    expect(fileProblem({ ...file, name: "synthetic.exe" }, 1024)).toContain("MP4");
    expect(fileProblem({ ...file, type: "text/plain" }, 1024)).toContain("MP4");
    expect(fileProblem({ ...file, type: "" }, 1024)).toBeNull();
    expect(formatBytes(512 * 1024 ** 2)).toBe("512.0 MiB");
  });
  it("honors source flags and validates basic URL/Drive form shape", () => {
    // Reserved test host; these synthetic URLs are never fetched.
    expect(sourceProblem("https://media.example.test/synthetic.mp4", "url", false, false)).toContain("not enabled");
    expect(sourceProblem("http://media.example.test/synthetic.mp4", "url", true, false)).toContain("HTTPS");
    expect(sourceProblem("https://user:secret@media.example.test/synthetic.mp4", "url", true, false)).toContain("credentials");
    expect(sourceProblem("https://media.example.test/synthetic.mp4", "url", true, false)).toBeNull();
    expect(sourceProblem("https://drive.google.com/file/d/synthetic/view", "drive", false, true)).toBeNull();
    expect(sourceProblem("https://drive.google.com/drive/folders/synthetic", "drive", false, true)).toContain("folder");
    expect(sourceProblem("https://drive.google.com/file/d/synthetic/view", "url", true, false)).toContain("not enabled");
  });
  it.each(["queued", "processing", "completed", "failed"])("accepts reused %s create responses", (status) => {
    expect(createdAssessmentSchema.parse({ id: "synthetic_id", status, reused: true }).reused).toBe(true);
  });
  it("rejects unsafe IDs and unsupported labels at the history boundary", () => {
    const item = { id: "synthetic", status: "completed", stage: "completed", createdAt: "2026-10-23T00:00:00.000Z", qualityLabel: "Good" };
    expect(historySchema.safeParse({ assessments: [item], nextCursor: null }).success).toBe(true);
    expect(historySchema.safeParse({ assessments: [{ ...item, id: "../other" }], nextCursor: null }).success).toBe(false);
    expect(historySchema.safeParse({ assessments: [{ ...item, qualityLabel: "Perfect" }], nextCursor: null }).success).toBe(false);
  });
  it("rejects late responses even if fetch ignores cancellation", async () => {
    const controller = new AbortController(); const unauthorized = vi.fn();
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
    const pending = assessmentRequest("/api/assessments", { token: "synthetic-only", signal: controller.signal, onUnauthorized: unauthorized }, okSchema);
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    controller.abort(); resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await assertion; expect(unauthorized).not.toHaveBeenCalled();
  });
  it("clears the workspace on a current 401 without exposing raw response content", async () => {
    const unauthorized = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("synthetic untrusted server detail", { status: 401 })));
    await expect(assessmentRequest("/api/assessments", { token: "synthetic-only", signal: new AbortController().signal, onUnauthorized: unauthorized }, okSchema)).rejects.toThrow("Access key was not accepted");
    expect(unauthorized).toHaveBeenCalledOnce();
  });
});
