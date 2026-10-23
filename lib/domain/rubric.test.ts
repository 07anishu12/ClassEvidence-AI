import { describe, expect, it } from "vitest";

import {
  calculateWeightedScore,
  classifyQuality,
  MINIMUM_ASSESSABLE_WEIGHT,
  rubricDimensions,
  validateRubricDefinition,
} from "./rubric";

const evidence = ["evidence_test"];

describe("versioned teaching-quality rubric", () => {
  it("has five dimensions with weights summing to 100 and five anchors each", () => {
    expect(() => validateRubricDefinition()).not.toThrow();
    expect(rubricDimensions.reduce((sum, dimension) => sum + dimension.weight, 0)).toBe(100);
    expect(rubricDimensions.every((dimension) => dimension.anchors.length === 5)).toBe(true);
  });

  it.each([
    [0, "Poor"],
    [39.99, "Poor"],
    [40, "Average"],
    [59.99, "Average"],
    [60, "Good"],
    [79.99, "Good"],
    [80, "Excellent"],
  ] as const)("classifies %s as %s", (score, label) => {
    expect(classifyQuality(score)).toBe(label);
  });

  it("withholds a label when essential evidence is missing", () => {
    const result = calculateWeightedScore([
      { key: "clarity_accuracy", score: 3, evidenceIds: evidence },
      { key: "interaction_responsiveness", score: null, evidenceIds: [] },
      { key: "lesson_structure", score: 3, evidenceIds: evidence },
      { key: "instructional_practice", score: 3, evidenceIds: evidence },
      { key: "technical_usability", score: 3, evidenceIds: evidence },
    ]);

    expect(result.assessableWeight).toBe(75);
    expect(result.sufficientlyAssessable).toBe(false);
    expect(result.qualityLabel).toBeNull();
    expect(result.limitations.join(" ")).toContain("interaction");
  });

  it("normalizes over assessable dimensions and marks low coverage", () => {
    const result = calculateWeightedScore([
      { key: "clarity_accuracy", score: 4, evidenceIds: evidence },
      { key: "interaction_responsiveness", score: 4, evidenceIds: evidence },
      { key: "lesson_structure", score: 4, evidenceIds: evidence },
    ]);

    expect(result.assessableWeight).toBe(70);
    expect(result.scorePercent).toBe(100);
    expect(result.sufficientlyAssessable).toBe(true);
    expect(result.qualityLabel).toBe("Excellent");
    expect(MINIMUM_ASSESSABLE_WEIGHT).toBe(70);
  });

  it("rejects an assessable score without provenance IDs", () => {
    expect(() =>
      calculateWeightedScore([{ key: "clarity_accuracy", score: 2, evidenceIds: [] }]),
    ).toThrow("requires evidence IDs");
  });
});
