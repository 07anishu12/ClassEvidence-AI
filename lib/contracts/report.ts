import { z } from "zod";

export const qualityLabels = ["Poor", "Average", "Good", "Excellent"] as const;
export type QualityLabel = (typeof qualityLabels)[number];
export const qualityLabelSchema = z.enum(qualityLabels);

export const evidenceModalities = ["audio", "transcript", "video", "metadata"] as const;
export const evidenceImpacts = ["positive", "negative", "neutral", "not_assessable"] as const;

export const evidenceSchema = z
  .object({
    id: z.string().regex(/^evidence_[a-zA-Z0-9_-]+$/),
    startSec: z.number().finite().nonnegative(),
    endSec: z.number().finite().nonnegative(),
    modality: z.enum(evidenceModalities),
    claim: z.string().trim().min(1).max(2000),
    evidence: z.string().trim().min(1).max(2000),
    impact: z.enum(evidenceImpacts),
    provenance: z
      .object({
        source: z.enum(["recording", "transcript", "metadata"]),
        locator: z.string().trim().min(1).max(512),
        sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endSec < value.startSec) {
      context.addIssue({ code: "custom", path: ["endSec"], message: "endSec must be >= startSec" });
    }
  });

export const dimensionScoreSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9_]+$/),
    score: z.number().finite().min(0).max(4).nullable(),
    rationale: z.string().trim().min(1).max(2000),
    evidenceIds: z.array(evidenceSchema.shape.id).max(50),
  })
  .strict();

export const reportSchema = z
  .object({
    qualityLabel: qualityLabelSchema,
    scorePercent: z.number().finite().min(0).max(100).nullable(),
    rubricVersion: z.string().trim().min(1).max(100),
    confidence: z.number().finite().min(0).max(1).nullable(),
    assessmentLimitations: z.array(z.string().trim().min(1).max(1000)).max(50),
    dimensions: z.array(dimensionScoreSchema).max(50),
    observations: z.array(evidenceSchema).max(500),
    recommendations: z.array(z.string().trim().min(1).max(1000)).max(50),
  })
  .strict();

export type Evidence = z.infer<typeof evidenceSchema>;
export type Report = z.infer<typeof reportSchema>;

export function validateReportEvidence(report: Report): Report {
  const observationIds = new Set(report.observations.map((observation) => observation.id));
  for (const dimension of report.dimensions) {
    for (const evidenceId of dimension.evidenceIds) {
      if (!observationIds.has(evidenceId)) {
        throw new Error(`Dimension ${dimension.key} references unknown evidence ${evidenceId}`);
      }
    }
  }
  return report;
}
