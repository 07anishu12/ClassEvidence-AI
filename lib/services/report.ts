import { buildCoachingReport, type CoachingReport } from "../domain/report";
import { scoreEvidence } from "../domain/scoring";
import { modelInputManifestSchema } from "../providers/manifest";
import { getAssessmentProvider, type AssessmentProvider } from "../providers/types";
import { ProviderError } from "../providers/adapters";

/** Shared production analysis path. Adapter injection is trusted worker configuration, never request JSON. */
export async function generateReport(rawManifest: unknown, provider: AssessmentProvider = getAssessmentProvider()): Promise<CoachingReport> {
  const parsed = modelInputManifestSchema.safeParse(rawManifest);
  if (!parsed.success) throw new ProviderError("provider_input_invalid");
  const output = await provider.analyze(parsed.data);
  return buildCoachingReport(scoreEvidence(parsed.data, output));
}
