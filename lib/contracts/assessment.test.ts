import { describe, expect, it } from "vitest";

import {
  assessmentCreateSchema,
  reportSchema,
  sourceSchema,
  validateReportEvidence,
} from "./assessment";

describe("assessment source validation", () => {
  it("accepts a public HTTPS source URL", () => {
    expect(
      sourceSchema.parse({ kind: "url", url: "https://example.com/recordings/class-01.mp4" }),
    ).toEqual({ kind: "url", url: "https://example.com/recordings/class-01.mp4" });
  });

  it.each([
    "http://example.com/recording.mp4",
    "https://localhost/recording.mp4",
    "https://127.0.0.1/recording.mp4",
    "https://10.0.0.2/recording.mp4",
    "https://user:password@example.com/recording.mp4",
    "https://example.com/recording.mp4#private-fragment",
  ])("rejects unsafe source URL %s", (url) => {
    expect(() => sourceSchema.parse({ kind: "url", url })).toThrow();
  });

  it("rejects extra request fields", () => {
    expect(() =>
      assessmentCreateSchema.parse({
        source: { kind: "url", url: "https://example.com/recording.mp4" },
        mock: true,
      }),
    ).toThrow();
  });

  it("accepts a private upload reference and rejects path traversal", () => {
    expect(sourceSchema.parse({ kind: "upload", storageKey: "private://media/asset_123" })).toEqual({
      kind: "upload",
      storageKey: "private://media/asset_123",
    });
    expect(() => sourceSchema.parse({ kind: "upload", storageKey: "private://../secret" })).toThrow();
  });

  it("rejects dimensions that reference missing evidence", () => {
    const report = reportSchema.parse({
      qualityLabel: "Good",
      scorePercent: 75,
      rubricVersion: "0.1",
      confidence: 0.5,
      assessmentLimitations: [],
      dimensions: [
        { key: "clarity", score: 3, rationale: "Supported", evidenceIds: ["evidence_missing"] },
      ],
      observations: [],
      recommendations: [],
    });

    expect(() => validateReportEvidence(report)).toThrow("unknown evidence");
  });
});
