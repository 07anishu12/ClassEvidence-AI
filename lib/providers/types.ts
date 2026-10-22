import { z } from "zod";

import { evidenceSchema, type AssessmentCreate } from "../contracts/assessment";

export type ProviderInput = {
  jobId: string;
  source: AssessmentCreate["source"];
};

export const providerEvidenceOutputSchema = z
  .object({
    observations: z.array(evidenceSchema).max(18),
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
