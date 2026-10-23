import { z } from "zod";
import { modelInputManifestSchema, type ModelInputManifest } from "../providers/manifest";
import { candidateEvidenceSchema, providerEvidenceOutputSchema } from "../providers/types";

export type GroundedObservation = z.infer<typeof candidateEvidenceSchema>;
export type RejectionCode = "artifact_missing" | "timing_mismatch" | "modality_mismatch" | "unsupported_excerpt" |
  "unsupported_visual_claim" | "contradiction" | "duplicate";
export class EvidenceValidationError extends Error {
  readonly code = "evidence_invalid";
  constructor() { super("Evidence input failed schema or identity validation."); }
}

/** Referential grounding only: no heuristic pretends to prove pedagogical interpretations. */
export function extractEvidence(rawManifest: unknown, rawOutput: unknown): {
  manifest: ModelInputManifest; observations: GroundedObservation[];
  rejected: { id: string; code: RejectionCode }[];
} {
  const m = modelInputManifestSchema.safeParse(rawManifest);
  const o = providerEvidenceOutputSchema.safeParse(rawOutput);
  if (!m.success || !o.success) throw new EvidenceValidationError();
  const artifacts = new Map(m.data.artifacts.map((a) => [a.id, a]));
  const counts = new Map<string, number>();
  for (const candidate of o.data.observations) counts.set(candidate.id, (counts.get(candidate.id) ?? 0) + 1);
  const rejected: { id: string; code: RejectionCode }[] = [];
  const supported: GroundedObservation[] = [];
  for (const c of o.data.observations) {
    const artifact = artifacts.get(c.provenance.locator);
    let code: RejectionCode | undefined;
    if (counts.get(c.id)! > 1) code = "duplicate";
    else if (!artifact) code = "artifact_missing";
    else if (c.modality !== artifact.modality || c.provenance.source !== (artifact.modality === "transcript" ? "transcript" : "recording")) code = "modality_mismatch";
    // Sub-segment word times are unavailable. Never accept invented finer timing or clip-relative offsets.
    else if (c.startSec !== artifact.startSec || c.endSec !== artifact.endSec) code = "timing_mismatch";
    else if (artifact.modality === "transcript" && (!artifact.text.includes(c.evidence) || !c.evidence.trim())) code = "unsupported_excerpt";
    else if (artifact.modality === "video" && (c.evidence !== artifact.id || c.impact !== "neutral")) code = "unsupported_visual_claim";
    if (code) { rejected.push({ id: c.id, code }); continue; }
    // Only source quotations/frame references are user-visible. Model praise and inferred activity are discarded.
    supported.push({ ...c, impact: c.uncertainty === "high" ? "not_assessable" : c.impact,
      provenance: { ...c.provenance, sha256: artifact!.sha256 },
      claim: c.modality === "transcript" ? c.evidence : `Sampled frame ${c.provenance.locator}.` });
  }
  const conflicts = new Set<string>();
  for (const a of supported) for (const b of supported) {
    if (a.id !== b.id && a.dimension === b.dimension && a.provenance.locator === b.provenance.locator &&
        a.evidence === b.evidence && ((a.impact === "positive" && b.impact === "negative") || (a.impact === "negative" && b.impact === "positive"))) {
      conflicts.add(a.id); conflicts.add(b.id);
    }
  }
  const unique = new Set<string>();
  const observations = supported.filter((c) => {
    const key = JSON.stringify([c.dimension, c.provenance.locator, c.evidence, c.impact]);
    const code = conflicts.has(c.id) ? "contradiction" : unique.has(key) ? "duplicate" : undefined;
    if (code) { rejected.push({ id: c.id, code }); return false; }
    unique.add(key); return true;
  }).sort((a, b) => a.startSec - b.startSec || a.id.localeCompare(b.id));
  return { manifest: m.data, observations, rejected };
}
