import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const token = "synthetic-test-token-with-32-characters";
const create = vi.fn();
const find = vi.fn();
vi.mock("../../lib/db/prisma", () => ({ getPrisma: () => ({ assessmentJob: { create, findUnique: find } }) }));
let root: string;
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks();
  root = await realpath(await mkdtemp(join(tmpdir(), "humaniti-synthetic-")));
  vi.stubEnv("ASSESSMENT_ACCESS_TOKEN", token); vi.stubEnv("PRIVATE_MEDIA_ROOT", root);
  vi.stubEnv("MAX_UPLOAD_BYTES", "1000");
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); });
function request(body: Uint8Array | string, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/assessments", { method: "POST", body: body as BodyInit,
    headers: { authorization: `Bearer ${token}`, "content-type": "video/mp4", "x-recording-consent": "true", ...headers } });
}
// Synthetic container signature only. Worker must reject this as undecodable media, never generate a report.
const syntheticContainer = Buffer.from([0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0]);

describe("private assessment API", () => {
  it("streams an authenticated upload into private storage and queues its durable reference", async () => {
    create.mockResolvedValue({ id: "job_synthetic" });
    const { POST } = await import("../../app/api/assessments/route");
    const response = await POST(request(syntheticContainer));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ id: "job_synthetic", status: "queued" });
    expect(await readdir(root)).toHaveLength(1);
    expect(create.mock.calls[0][0].data.sourceRef).toMatch(/^private:\/\/[a-f0-9-]+\.mp4$/);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each([
    [{ authorization: "" }, 401], [{ "x-recording-consent": "false" }, 400],
    [{ origin: "https://example.com" }, 403], [{ "content-type": "image/png" }, 415],
    [{ "content-length": "1001" }, 413], [{ "content-type": "application/json" }, 422],
  ])("rejects unsafe intake %j before creating jobs", async (headers, status) => {
    const { POST } = await import("../../app/api/assessments/route");
    expect((await POST(request(syntheticContainer, headers))).status).toBe(status);
    expect(create).not.toHaveBeenCalled();
  });
  it("cleans malformed/oversize files and failed database writes", async () => {
    const { POST } = await import("../../app/api/assessments/route");
    expect((await POST(request("not a recording"))).status).toBe(415);
    expect((await POST(request(Buffer.alloc(1001)))).status).toBe(413);
    create.mockRejectedValue(new Error("private connection details"));
    const failed = await POST(request(syntheticContainer));
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("private connection");
    expect(await readdir(root)).toEqual([]);
  });
  it("refuses a media root inside public or tracked application files", async () => {
    vi.stubEnv("PRIVATE_MEDIA_ROOT", resolve("public"));
    const { POST } = await import("../../app/api/assessments/route");
    expect((await POST(request(syntheticContainer))).status).toBe(503);
    expect(create).not.toHaveBeenCalled();
  });
  it("protects status/report reads and never exposes a source reference", async () => {
    const { GET } = await import("../../app/api/assessments/[id]/route");
    const context = { params: Promise.resolve({ id: "job_synthetic" }) };
    expect((await GET(new Request("http://localhost/api/assessments/job_synthetic"), context)).status).toBe(401);
    find.mockResolvedValue({ id: "job_synthetic", status: "FAILED", progress: 10, stage: "failed", analysis: null,
      sourceRef: "private://never-expose", errorCode: "provider_blocked", errorMessage: "No local processor.", createdAt: new Date(), updatedAt: new Date() });
    const result = await GET(new Request("http://localhost/api/assessments/job_synthetic", { headers: { authorization: `Bearer ${token}` } }), context);
    expect(result.status).toBe(200);
    expect(await result.text()).not.toContain("private://");
    const { GET: report } = await import("../../app/api/assessments/[id]/report/route");
    expect((await report(new Request("http://localhost/api", { headers: { authorization: `Bearer ${token}` } }), context)).status).toBe(409);
  });
  it("bounds action bodies and rejects malformed or unknown actions", async () => {
    const { PATCH } = await import("../../app/api/assessments/[id]/route");
    const context = { params: Promise.resolve({ id: "job_synthetic" }) };
    for (const [body, status] of [["x".repeat(101), 413], ["{", 400], [JSON.stringify({ action: "erase" }), 400]] as const) {
      const result = await PATCH(new Request("http://localhost:3000/api/assessments/job_synthetic", { method: "PATCH", body,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } }), context);
      expect(result.status).toBe(status);
    }
  });
});
