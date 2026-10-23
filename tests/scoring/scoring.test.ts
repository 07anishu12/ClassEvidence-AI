import { describe, expect, it } from "vitest";
import { scoreEvidence, sourceCoverage } from "../../lib/domain/scoring";
import { calculateWeightedScore, classifyQuality, rubricDimensions } from "../../lib/domain/rubric";
import { syntheticManifest as manifest, syntheticOutput as output } from "../fixtures/analysis";

describe("evidence-backed scoring", () => {
  it("uses the existing weights and exactly four boundary labels", () => {
    expect(rubricDimensions.reduce((s, d) => s + d.weight, 0)).toBe(100);
    expect([0, 39.99, 40, 59.99, 60, 79.99, 80, 100].map(classifyQuality))
      .toEqual(["Poor", "Poor", "Average", "Average", "Good", "Good", "Excellent", "Excellent"]);
  });
  it("normalizes assessed weight and never punishes missing video or optional dimensions", () => {
    const result = scoreEvidence(manifest, output);
    expect(result.qualityLabel).toBe("Good");
    expect(result.scorePercent).toBe(75);
    expect(result.assessableWeight).toBe(70);
    expect(result.dimensions[4].score).toBeNull();
  });
  it("withholds a label for absent essential evidence or no evidence", () => {
    expect(scoreEvidence(manifest, { ...output, observations: [], ratings: [] }).qualityLabel).toBeNull();
    const observations = output.observations.filter((o) => o.dimension !== "interaction_responsiveness");
    expect(scoreEvidence(manifest, { ...output, observations }).qualityLabel).toBeNull();
  });
  it("rejects duplicate dimensions, bad numeric ratings, cross-dimension citations and unassessable citations", () => {
    for (const ratings of [[output.ratings[0], output.ratings[0]], [{ ...output.ratings[0], score: 5 }],
      [{ ...output.ratings[0], score: NaN }], [{ ...output.ratings[0], score: 1.5 }],
      [{ ...output.ratings[0], evidenceIds: ["evidence_1"] }], [{ ...output.ratings[0], score: null }]]) {
      expect(() => scoreEvidence(manifest, { ...output, ratings })).toThrow();
    }
  });
  it("withholds ratings when grounding removes fabricated evidence", () => {
    const observations = output.observations.map((o) => ({ ...o, startSec: o.startSec + 0.5 }));
    expect(scoreEvidence(manifest, { ...output, observations }).qualityLabel).toBeNull();
    expect(scoreEvidence(manifest, { ...output, observations }).confidence).toBe(0);
  });
  it("confidence uses time/weight coverage, evidence uncertainty and real review agreement", () => {
    const result = scoreEvidence(manifest, output);
    expect(result.confidence).toBe(0.088); // 70% * 15/60 * 1 * 0.5, rounded.
    expect(result.confidenceBasis.agreement).toBeNull();
    const review = { ...output, ratings: output.ratings.map((r) => ({ ...r, score: 0 })) };
    expect(scoreEvidence(manifest, output, review).confidenceBasis.agreement).toBe(0.25);
    expect(scoreEvidence(manifest, output, review).confidence).toBeLessThan(result.confidence);
  });
  it("merges overlapping intervals and rejects unsafe lower-level score callers", () => {
    expect(sourceCoverage([{ startSec: 0, endSec: 10 }, { startSec: 5, endSec: 15 }], 20)).toBe(0.75);
    expect(() => calculateWeightedScore([{ key: "clarity_accuracy", score: 5 as 4, evidenceIds: ["evidence_0"] }])).toThrow();
  });
});
