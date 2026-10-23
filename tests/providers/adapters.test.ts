import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createLocalProvider, createRemoteProvider, createTestProvider } from "../../lib/providers/adapters";
import { modelInputManifestSchema } from "../../lib/providers/manifest";
import { getAssessmentProvider } from "../../lib/providers/types";

// Synthetic transcript; no recording or personal data.
export const manifest = { version: "1" as const, jobId: "job_synthetic", durationSec: 30,
  artifacts: [{ id: "segment_1", modality: "transcript" as const, startSec: 2, endSec: 5,
    text: "Explain your reasoning.", sha256: createHash("sha256").update("Explain your reasoning.").digest("hex") }] };
const envelope = JSON.stringify({ output: { providerVersion: "synthetic-test", observations: [], ratings: [], limitations: [] },
  usage: { inputTokens: 10, outputTokens: 10 } });

describe("provider gates and resource bounds", () => {
  it("keeps default blocked and rejects unapproved/expired/mismatched remote permissions before I/O", async () => {
    await expect(getAssessmentProvider().analyze(manifest)).rejects.toMatchObject({ code: "provider_blocked" });
    for (const approval of [undefined,
      { reference: "synthetic", endpoint: "https://example.com/", expiresAt: "2000-01-01T00:00:00Z", modalities: ["transcript" as const] },
      { reference: "synthetic", endpoint: "https://example.org/", expiresAt: "2099-01-01T00:00:00Z", modalities: ["transcript" as const] }]) {
      await expect(createRemoteProvider({ endpoint: "https://example.com/", apiKey: "synthetic", approval }).analyze(manifest))
        .rejects.toMatchObject({ code: "provider_blocked" });
    }
  });
  it("runs the actual local JSON process protocol and strips inherited secrets", async () => {
    const code = `let b='';process.stdin.on('data',c=>b+=c);process.stdin.on('end',()=>{const r=JSON.parse(b);if(r.input.version!=='1'||process.env.DATABASE_URL)process.exit(3);process.stdout.write(${JSON.stringify(envelope)});});`;
    const provider = createLocalProvider({ executable: process.execPath, args: ["-e", code] });
    expect((await provider.analyze(manifest)).providerVersion).toBe("synthetic-test");
  });
  it("kills stalled processes and returns redacted errors", async () => {
    const provider = createLocalProvider({ executable: process.execPath, args: ["-e", "setInterval(()=>{},1000)"], limits: { timeoutMs: 20 } });
    await expect(provider.analyze(manifest)).rejects.toMatchObject({ code: "provider_timeout" });
  });
  it("preserves Unicode across subprocess output chunk boundaries", async () => {
    const value = envelope.replace('"limitations":[]', '"limitations":["தமிழ்"]');
    const code = `process.stdin.resume();process.stdin.on('end',()=>{const b=Buffer.from(${JSON.stringify(value)});const n=b.indexOf(Buffer.from('தமிழ்'))+1;process.stdout.write(b.subarray(0,n));setTimeout(()=>process.stdout.write(b.subarray(n)),10);});`;
    const result = await createLocalProvider({ executable: process.execPath, args: ["-e", code] }).analyze(manifest);
    expect(result.limitations).toEqual(["தமிழ்"]);
  });
  it("bounds invalid-output retries and audits no private content", async () => {
    const call = vi.fn(async () => "not json: private text");
    const audit = vi.fn();
    await expect(createTestProvider(call, {}, audit).analyze(manifest)).rejects.toMatchObject({ code: "provider_invalid_output" });
    expect(call).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(audit.mock.calls)).not.toContain("private text");
    expect(JSON.stringify(audit.mock.calls)).not.toContain("reasoning");
  });
  it("enforces test-only mode on every invocation", async () => {
    const provider = createTestProvider(async () => envelope);
    vi.stubEnv("NODE_ENV", "production");
    try { await expect(provider.analyze(manifest)).rejects.toMatchObject({ code: "provider_blocked" }); }
    finally { vi.unstubAllEnvs(); }
  });
  it("rejects forged digests, duplicate artifacts, reversed/missing timestamps, and unknown fields", () => {
    const artifact = manifest.artifacts[0];
    for (const value of [ { ...manifest, artifacts: [artifact, artifact] },
      { ...manifest, artifacts: [{ ...artifact, sha256: "0".repeat(64) }] },
      { ...manifest, artifacts: [{ ...artifact, endSec: 1 }] },
      { ...manifest, artifacts: [{ ...artifact, startSec: undefined }] }, { ...manifest, sourceUrl: "synthetic" } ]) {
      expect(modelInputManifestSchema.safeParse(value).success).toBe(false);
    }
  });
  it("enforces rate and token budgets without a silent fallback", async () => {
    const call = vi.fn(async () => envelope);
    const provider = createTestProvider(call, { requestsPerMinute: 1 });
    await provider.analyze(manifest);
    await expect(provider.analyze(manifest)).rejects.toMatchObject({ code: "provider_rate_limited" });
    expect(call).toHaveBeenCalledTimes(1);
    await expect(createTestProvider(call, { maxOutputTokens: 1 }).analyze(manifest)).rejects.toMatchObject({ code: "provider_budget_exceeded" });
  });
  it("rejects empty, extra, and oversized provider outputs", async () => {
    for (const output of ["{}", envelope.replace('"ratings":[]', '"ratings":[],"qualityLabel":"Excellent"'), "x".repeat(100001)]) {
      await expect(createTestProvider(async () => output).analyze(manifest)).rejects.toMatchObject({ code: "provider_invalid_output" });
    }
  });
});
