import { z } from "zod";

import { evidenceSchema } from "../contracts/report";
import { rubricDimensionKeys } from "../domain/rubric";
import type { ModelInputManifest } from "./manifest";

export type ProviderInput = ModelInputManifest;

export const candidateEvidenceSchema = evidenceSchema.safeExtend({
  dimension: z.enum(rubricDimensionKeys),
  uncertainty: z.enum(["low", "medium", "high"]),
});

export const modelRatingSchema = z.union([
  z.object({ key: z.enum(rubricDimensionKeys), score: z.number().int().min(0).max(4),
    evidenceIds: z.array(evidenceSchema.shape.id).min(1).max(18) }).strict(),
  z.object({ key: z.enum(rubricDimensionKeys), score: z.null(),
    evidenceIds: z.array(evidenceSchema.shape.id).length(0) }).strict(),
]);

export const providerEvidenceOutputSchema = z
  .object({
    observations: z.array(candidateEvidenceSchema).max(18),
    ratings: z.array(modelRatingSchema).max(5),
    limitations: z.array(z.string().trim().min(1).max(1000)).max(50),
    providerVersion: z.string().trim().min(1).max(100),
  })
  .strict();

export type ProviderOutput = z.infer<typeof providerEvidenceOutputSchema>;

export interface AssessmentProvider {
  readonly name: string;
  analyze(input: ProviderInput): Promise<ProviderOutput>;
}

export class ProviderBlockedError extends Error {
  readonly code = "provider_blocked";

  constructor() {
    super("No organiser-approved assessment provider is configured.");
    this.name = "ProviderBlockedError";
  }
}

export const blockedProvider: AssessmentProvider = {
  name: "blocked",
  async analyze(): Promise<ProviderOutput> {
    throw new ProviderBlockedError();
  },
};

export function validateProviderOutput(value: unknown): ProviderOutput {
  return providerEvidenceOutputSchema.parse(value);
}

export function getAssessmentProvider(): AssessmentProvider {
  return blockedProvider;
}
