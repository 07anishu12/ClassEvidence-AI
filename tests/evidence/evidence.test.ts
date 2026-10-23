import { describe, expect, it } from "vitest";
import { extractEvidence } from "../../lib/domain/evidence";
import { syntheticManifest as manifest, syntheticOutput as output } from "../fixtures/analysis";

describe("artifact grounding", () => {
  it("retains exact source excerpts and replaces free model prose", () => {
    const result = extractEvidence(manifest, output);
    expect(result.observations).toHaveLength(3);
    expect(result.rejected).toEqual([]);
    expect(result.observations[0].claim).toContain(manifest.artifacts[0].text);
    expect(JSON.stringify(result.observations)).not.toContain("Model interpretation");
  });
  it.each([
    [{ startSec: 1 }, "timing_mismatch"], [{ endSec: 61 }, "timing_mismatch"],
    [{ provenance: { source: "transcript", locator: "absent" } }, "artifact_missing"],
    [{ evidence: "Excellent teaching!" }, "unsupported_excerpt"], [{ modality: "audio" }, "modality_mismatch"],
  ])("removes unsupported candidate %j", (patch, code) => {
    const result = extractEvidence(manifest, { ...output, observations: [{ ...output.observations[0], ...patch }] });
    expect(result.observations).toEqual([]);
    expect(result.rejected[0].code).toBe(code);
  });
  it("removes both contradictory polarities rather than choosing convenient evidence", () => {
    const c = output.observations[0];
    const result = extractEvidence(manifest, { ...output, observations: [c, { ...c, id: "evidence_other", impact: "negative" }] });
    expect(result.observations).toEqual([]);
    expect(result.rejected.map((r) => r.code)).toEqual(["contradiction", "contradiction"]);
  });
  it("removes duplicate IDs and handles missing data without inventing observations", () => {
    const result = extractEvidence(manifest, { ...output, observations: [output.observations[0], output.observations[0]] });
    expect(result.observations).toEqual([]);
    expect(extractEvidence({ ...manifest, artifacts: [] }, { ...output, observations: [] }).observations).toEqual([]);
    expect(() => extractEvidence(manifest, { ...output, observations: [{ ...output.observations[0], startSec: -1 }] })).toThrow("schema");
  });
  it("never presents high uncertainty as negative teaching evidence", () => {
    const result = extractEvidence(manifest, { ...output, observations: [{ ...output.observations[0], uncertainty: "high", impact: "negative" }] });
    expect(result.observations[0].impact).toBe("not_assessable");
  });
});
