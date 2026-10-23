import { createHash } from "node:crypto";

// Explicitly synthetic text and times. These are not sample recordings or ground-truth labels.
export const syntheticManifest = { version: "1" as const, jobId: "job_synthetic", durationSec: 60,
  artifacts: ["First, explain the concept.", "Why does this work?", "Next, try the practice task."].map((text, i) => ({
    id: `segment_${i}`, modality: "transcript" as const, startSec: i * 10, endSec: i * 10 + 5,
    text, sha256: createHash("sha256").update(text).digest("hex"),
  })) };
export const syntheticObservations = syntheticManifest.artifacts.map((a, i) => ({
  id: `evidence_${i}`, startSec: a.startSec, endSec: a.endSec, modality: a.modality,
  claim: "Model interpretation must never be displayed.", evidence: a.text, impact: "positive" as const,
  dimension: (["clarity_accuracy", "interaction_responsiveness", "lesson_structure"] as const)[i],
  uncertainty: "low" as const, provenance: { source: "transcript" as const, locator: a.id },
}));
export const syntheticOutput = { observations: syntheticObservations,
  ratings: syntheticObservations.map((o) => ({ key: o.dimension, score: 3, evidenceIds: [o.id] })),
  limitations: [], providerVersion: "synthetic-test" };
