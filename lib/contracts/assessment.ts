import { z } from "zod";

import { isIP } from "node:net";

export const qualityLabels = ["Poor", "Average", "Good", "Excellent"] as const;
export type QualityLabel = (typeof qualityLabels)[number];
export const qualityLabelSchema = z.enum(qualityLabels);

export const jobStatuses = ["queued", "processing", "completed", "failed"] as const;
export type JobStatus = (typeof jobStatuses)[number];
export const jobStatusSchema = z.enum(jobStatuses);

export const evidenceModalities = ["audio", "transcript", "video", "metadata"] as const;
export const evidenceImpacts = ["positive", "negative", "neutral", "not_assessable"] as const;

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0"
  ) {
    return true;
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const octets = host.split(".").map(Number);
    const [first, second] = octets;
    return (
      first === 10 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first === 127 ||
      (first === 169 && second === 254)
    );
  }

  if (ipVersion === 6) {
    return host === "::1" || host === "::" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  }

  return false;
}

export const sourceUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .url()
  .superRefine((value, context) => {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      context.addIssue({ code: "custom", message: "Source URLs must use HTTPS" });
    }
    if (url.username || url.password) {
      context.addIssue({ code: "custom", message: "Source URLs cannot contain credentials" });
    }
    if (url.hash) {
      context.addIssue({ code: "custom", message: "Source URLs cannot contain fragments" });
    }
    if (isPrivateOrLocalHost(url.hostname)) {
      context.addIssue({ code: "custom", message: "Source host must not be local or private" });
    }
  });

export const privateStorageKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .regex(/^private:\/\/[A-Za-z0-9][A-Za-z0-9/_-]*$/, "Invalid private storage reference")
  .refine((value) => !value.includes(".."), "Storage references cannot contain parent traversal");

export const sourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("url"),
      url: sourceUrlSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("upload"),
      storageKey: privateStorageKeySchema,
    })
    .strict(),
]);

export const assessmentCreateSchema = z
  .object({
    source: sourceSchema,
  })
  .strict();

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

export const jobErrorSchema = z
  .object({
    code: z.string().trim().min(1).max(100),
    message: z.string().trim().min(1).max(1000),
  })
  .strict();

export const jobSchema = z
  .object({
    id: z.string().trim().min(1),
    status: jobStatusSchema,
    progress: z.number().int().min(0).max(100),
    stage: z.string().trim().min(1).max(100).nullable(),
    error: jobErrorSchema.nullable(),
    createdAt: z.string().trim().min(1),
    updatedAt: z.string().trim().min(1),
    report: reportSchema.nullable(),
  })
  .strict();

export const assessmentCreatedSchema = z
  .object({
    id: z.string().trim().min(1),
    status: jobStatusSchema,
  })
  .strict();

export type AssessmentCreate = z.infer<typeof assessmentCreateSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Report = z.infer<typeof reportSchema>;
export type Job = z.infer<typeof jobSchema>;

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
