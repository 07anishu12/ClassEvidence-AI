import { z } from "zod";
import { evidenceSchema, reportSchema, validateReportEvidence } from "../contracts/report";
import { candidateEvidenceSchema } from "../providers/types";
import { rubricDimensionKeys, rubricDimensions, RUBRIC_VERSION } from "./rubric";
import type { ScoredEvidence } from "./scoring";

const citationSchema = z.object({ evidenceIds: z.array(z.string().regex(/^evidence_[A-Za-z0-9_-]+$/)).min(1).max(18),
  dimension: z.enum(rubricDimensionKeys), text: z.string().min(1).max(1000) }).strict();
export const coachingReportSchema = z.object({
  status: z.enum(["assessed", "insufficient_evidence"]),
  providerVersion: z.string().min(1).max(100),
  recordingSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable().default(null),
  sourceArtifacts: z.array(z.object({ id: z.string().min(1).max(80), modality: z.enum(["transcript", "video"]),
    startSec: z.number().finite().nonnegative(), endSec: z.number().finite().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).max(2000).default([]),
  report: reportSchema.nullable(),
  observations: z.array(candidateEvidenceSchema).max(18),
  strengths: z.array(citationSchema).max(18),
  opportunities: z.array(citationSchema).max(18),
  nextSteps: z.array(citationSchema).max(18),
  limitations: z.array(z.string().min(1).max(1000)).max(50),
  confidence: z.number().min(0).max(1),
  confidenceBasis: z.object({ temporalCoverage: z.number().min(0).max(1), evidenceQuality: z.number().min(0).max(1),
    agreement: z.number().min(0).max(1).nullable(), assessableWeight: z.number().min(0).max(100) }).strict(),
}).strict().superRefine((value, ctx) => {
  if ((value.status === "assessed") !== (value.report !== null)) ctx.addIssue({ code: "custom", message: "Report status mismatch" });
  const ids = new Map(value.observations.map((o) => [o.id, o]));
  if (value.sourceArtifacts.length) {
    const artifacts = new Map(value.sourceArtifacts.map((a) => [a.id, a]));
    if (artifacts.size !== value.sourceArtifacts.length) ctx.addIssue({ code: "custom", message: "Duplicate artifact IDs" });
    for (const o of value.observations) {
      const a = artifacts.get(o.provenance.locator);
      if (!a || a.modality !== o.modality || a.sha256 !== o.provenance.sha256 || a.startSec !== o.startSec || a.endSec !== o.endSec) {
        ctx.addIssue({ code: "custom", message: "Artifact registry mismatch" });
      }
    }
  }
  if (ids.size !== value.observations.length) ctx.addIssue({ code: "custom", message: "Duplicate observation IDs" });
  for (const item of [...value.strengths, ...value.opportunities, ...value.nextSteps]) {
    if (item.evidenceIds.some((id) => ids.get(id)?.dimension !== item.dimension)) ctx.addIssue({ code: "custom", message: "Unknown or mismatched citation" });
  }
  if (value.report) {
    try { validateReportEvidence(value.report); } catch { ctx.addIssue({ code: "custom", message: "Invalid report citations" }); }
    if (JSON.stringify(value.report.observations.map((o) => o.id)) !== JSON.stringify(value.observations.map((o) => o.id))) {
      ctx.addIssue({ code: "custom", message: "Report observation mismatch" });
    }
  }
});
export type CoachingReport = z.infer<typeof coachingReportSchema>;

const coaching: Record<(typeof rubricDimensionKeys)[number], string> = {
  clarity_accuracy: "In your next explanation, ask a learner to restate the idea and check it against a worked example.",
  interaction_responsiveness: "After a question, allow response time, then use the learner's reasoning to choose your next explanation.",
  lesson_structure: "Make the objective and transition explicit, then close with a brief recap linked to that objective.",
  instructional_practice: "Follow a demonstration with a short learner task and use the response to give specific feedback.",
  technical_usability: "Before the next class, check that speech and instructional material are accessible in a short local recording.",
};

export function buildCoachingReport(scored: ScoredEvidence): CoachingReport {
  const label = (key: string) => rubricDimensions.find((d) => d.key === key)!.label;
  const items = scored.observations.filter((o) => o.modality === "transcript" && o.uncertainty !== "high");
  const strengths = items.filter((o) => o.impact === "positive").map((o) => ({ dimension: o.dimension, evidenceIds: [o.id],
    text: `${label(o.dimension)}: review the cited moment as a potential strength in the sampled evidence.` }));
  const opportunities = items.filter((o) => o.impact === "negative").map((o) => ({ dimension: o.dimension, evidenceIds: [o.id],
    text: `${label(o.dimension)}: review this cited moment for an improvement opportunity; the interpretation is provisional.` }));
  const nextSteps = [...new Set(items.filter((o) => ["positive", "negative"].includes(o.impact)).map((o) => o.dimension))].map((dimension) => ({
    dimension, evidenceIds: items.filter((o) => o.dimension === dimension).map((o) => o.id), text: coaching[dimension],
  }));
  const limitations = [...scored.limitations, "Recommendations are suggestions for future practice, not claims that these activities occurred.",
    "This is decision support based on sampled evidence, not a guaranteed grade."];
  const report = scored.qualityLabel === null ? null : validateReportEvidence(reportSchema.parse({
    qualityLabel: scored.qualityLabel, scorePercent: scored.scorePercent, rubricVersion: RUBRIC_VERSION,
    confidence: scored.confidence, assessmentLimitations: limitations,
    dimensions: scored.dimensions.map((d) => ({ ...d, rationale: d.score === null ? "Not assessable from validated evidence." :
      `Provisional model rating ${d.score}/4, supported by ${d.evidenceIds.join(", ")}; applies to sampled moments only.` })),
    observations: scored.observations.map((o) => evidenceSchema.parse({ id: o.id, startSec: o.startSec, endSec: o.endSec,
      modality: o.modality, claim: o.claim, evidence: o.evidence, impact: o.impact, provenance: o.provenance })),
    recommendations: nextSteps.map((item) => `${item.text} [${item.evidenceIds.join(", ")}]`),
  }));
  return coachingReportSchema.parse({ status: report ? "assessed" : "insufficient_evidence", providerVersion: scored.providerVersion,
    recordingSha256: scored.recordingSha256, sourceArtifacts: scored.sourceArtifacts, report,
    observations: scored.observations, strengths, opportunities, nextSteps, limitations,
    confidence: scored.confidence, confidenceBasis: scored.confidenceBasis });
}
