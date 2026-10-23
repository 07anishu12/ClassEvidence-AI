import { describe, expect, it } from "vitest";
import { createTestProvider } from "../../lib/providers/adapters";
import { generateReport } from "../../lib/services/report";
import { coachingReportSchema } from "../../lib/domain/report";
import { syntheticManifest as manifest, syntheticOutput as output } from "../fixtures/analysis";

function provider(value: unknown) { return createTestProvider(async () => JSON.stringify({ output: value, usage: { inputTokens: 1, outputTokens: 1 } })); }

describe("grounded coaching reports", () => {
  it("uses provider→grounding→score→report and cites every strength/next step", async () => {
    const result = await generateReport(manifest, provider(output));
    expect(result.status).toBe("assessed");
    expect(result.report?.qualityLabel).toBe("Good");
    expect(result.strengths).toHaveLength(3);
    expect(result.nextSteps[0].text).toContain("next explanation");
    expect(JSON.stringify(result)).not.toContain("Model interpretation must");
    expect(result.observations[0].startSec).toBe(manifest.artifacts[0].startSec);
    expect(result.sourceArtifacts[0].sha256).toBe(manifest.artifacts[0].sha256);
    expect(coachingReportSchema.safeParse(result).success).toBe(true);
  });
  it("retains useful observations without assigning a label to insufficient evidence", async () => {
    const result = await generateReport(manifest, provider({ ...output, ratings: [output.ratings[0]] }));
    expect(result.report).toBeNull();
    expect(result.status).toBe("insufficient_evidence");
    expect(result.observations).toHaveLength(3);
  });
  it("handles no evidence honestly and propagates provider failures", async () => {
    const result = await generateReport({ ...manifest, artifacts: [] }, provider({ ...output, observations: [], ratings: [] }));
    expect(result.observations).toEqual([]);
    expect(result.nextSteps).toEqual([]);
    await expect(generateReport(manifest)).rejects.toMatchObject({ code: "provider_blocked" });
  });
  it("never presents fabricated observations or arbitrary model limitations as source facts", async () => {
    const forged = { ...output, observations: output.observations.map((o) => ({ ...o, evidence: "Unseen activity" })), limitations: ["private model text"] };
    const result = await generateReport(manifest, provider(forged));
    expect(result.observations).toEqual([]);
    expect(result.report).toBeNull();
    expect(JSON.stringify(result)).not.toContain("private model text");
  });
  it("rejects tampered coaching citations and unknown schema fields", async () => {
    const result = await generateReport(manifest, provider(output));
    expect(coachingReportSchema.safeParse({ ...result, nextSteps: [{ ...result.nextSteps[0], evidenceIds: ["evidence_missing"] }] }).success).toBe(false);
    expect(coachingReportSchema.safeParse({ ...result, inventedField: true }).success).toBe(false);
    expect(coachingReportSchema.safeParse({ ...result, sourceArtifacts: result.sourceArtifacts.map((a) => ({ ...a, startSec: a.startSec + 1 })) }).success).toBe(false);
  });
});
