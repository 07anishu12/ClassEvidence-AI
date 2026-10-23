import { z } from "zod";
import { extractEvidence, type GroundedObservation } from "./evidence";
import { calculateWeightedScore, rubricDimensions, type DimensionAssessment, type RubricDimensionKey } from "./rubric";
import { providerEvidenceOutputSchema, type ProviderOutput } from "../providers/types";

export class ScoringValidationError extends Error {
  readonly code = "scoring_invalid";
  constructor() { super("Ratings failed schema, identity, or evidence validation."); }
}

function validateRatings(output: ProviderOutput, observations: GroundedObservation[]): DimensionAssessment[] {
  const ids = new Map(observations.map((o) => [o.id, o]));
  if (new Set(output.ratings.map((r) => r.key)).size !== output.ratings.length) throw new ScoringValidationError();
  return rubricDimensions.map((dimension) => {
    const rating = output.ratings.find((r) => r.key === dimension.key);
    if (!rating || rating.score === null) {
      if (rating?.evidenceIds.length) throw new ScoringValidationError();
      return { key: dimension.key, score: null, evidenceIds: [] };
    }
    if (!rating.evidenceIds.length || new Set(rating.evidenceIds).size !== rating.evidenceIds.length) throw new ScoringValidationError();
    const cited = rating.evidenceIds.map((id) => ids.get(id));
    // Removed evidence makes its dimension unassessable. Cross-dimension references are a schema failure.
    if (cited.some((o) => o && o.dimension !== rating.key)) throw new ScoringValidationError();
    if (cited.some((o) => !o || o.impact === "not_assessable" || o.modality !== "transcript" || o.uncertainty === "high")) {
      return { key: dimension.key, score: null, evidenceIds: [] };
    }
    return { key: dimension.key, score: rating.score as 0 | 1 | 2 | 3 | 4, evidenceIds: rating.evidenceIds };
  });
}

export function sourceCoverage(observations: readonly { startSec: number; endSec: number }[], duration: number): number {
  let end = 0, covered = 0;
  for (const interval of [...observations].sort((a, b) => a.startSec - b.startSec)) {
    covered += Math.max(0, interval.endSec - Math.max(end, interval.startSec));
    end = Math.max(end, interval.endSec);
  }
  return Math.min(1, covered / duration);
}

export function scoreEvidence(manifest: unknown, rawOutput: unknown, independentReview?: unknown) {
  const parsed = providerEvidenceOutputSchema.safeParse(rawOutput);
  if (!parsed.success) throw new ScoringValidationError();
  const grounded = extractEvidence(manifest, parsed.data);
  const dimensions = validateRatings(parsed.data, grounded.observations);
  const weighted = calculateWeightedScore(dimensions);
  const citedIds = new Set(dimensions.flatMap((d) => [...d.evidenceIds]));
  const cited = grounded.observations.filter((o) => citedIds.has(o.id));
  const temporalCoverage = sourceCoverage(cited, grounded.manifest.durationSec);
  const evidenceQuality = cited.length ? cited.reduce((sum, o) => sum + (o.uncertainty === "low" ? 1 : 0.6), 0) / cited.length : 0;
  let agreement: number | null = null;
  if (independentReview !== undefined) {
    const second = providerEvidenceOutputSchema.safeParse(independentReview);
    if (!second.success) throw new ScoringValidationError();
    const secondGrounded = extractEvidence(manifest, second.data);
    const other = validateRatings(second.data, secondGrounded.observations);
    const paired = dimensions.flatMap((d) => {
      const score = other.find((o) => o.key === d.key)?.score;
      return d.score !== null && score !== null && score !== undefined ? [1 - Math.abs(d.score - score) / 4] : [];
    });
    if (paired.length) agreement = paired.reduce((a, b) => a + b, 0) / paired.length;
  }
  const confidence = Math.round(weighted.assessableWeight / 100 * temporalCoverage * evidenceQuality * (agreement ?? 0.5) * 1000) / 1000;
  return { ...weighted, providerVersion: parsed.data.providerVersion,
    recordingSha256: grounded.manifest.sourceSha256 ?? null,
    sourceArtifacts: grounded.manifest.artifacts.map(({ id, modality, startSec, endSec, sha256 }) => ({ id, modality, startSec, endSec, sha256 })),
    dimensions, observations: grounded.observations, rejected: grounded.rejected,
    confidence, confidenceBasis: { temporalCoverage, evidenceQuality, agreement, assessableWeight: weighted.assessableWeight },
    limitations: [...weighted.limitations,
      "Rubric weights and thresholds are provisional and have not been calibrated against trusted sample reviews.",
      "Source grounding validates citations, not the correctness of model interpretations or factual subject knowledge.",
      "Transcript wording, speaker attribution and timestamps have not been independently audited against the recording. The local text-only path does not assess visible activity.",
      ...(agreement === null ? ["No independent rating agreement is available; confidence is discounted."] : []),
      ...(temporalCoverage < 1 ? ["Only cited source intervals support this assessment; unobserved lesson activity is not assessed."] : []),
      ...(grounded.rejected.length ? ["Unsupported or conflicting observations were excluded."] : [])],
  };
}

export type ScoredEvidence = ReturnType<typeof scoreEvidence>;
export const dimensionKeySchema = z.enum(rubricDimensions.map((d) => d.key) as [RubricDimensionKey, ...RubricDimensionKey[]]);
