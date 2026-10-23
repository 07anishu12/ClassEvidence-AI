import type { CoachingReport } from "./domain/report";

// Authored, synthetic display fixture. No recording, inference, provider or database is used.
// Scores and timestamps illustrate the report format; they are not evaluation results.
const observations: CoachingReport["observations"] = [
  {
    id: "evidence_demo_clarity", startSec: 20, endSec: 30, modality: "transcript",
    dimension: "clarity_accuracy", uncertainty: "low", impact: "positive",
    claim: "Synthetic example of a worked explanation.",
    evidence: "To compare two fractions, first give them a common denominator. One half is the same as two quarters.",
    provenance: { source: "transcript", locator: "synthetic_segment_clarity" },
  },
  {
    id: "evidence_demo_interaction", startSec: 90, endSec: 105, modality: "transcript",
    dimension: "interaction_responsiveness", uncertainty: "medium", impact: "positive",
    claim: "Synthetic example of responding to a learner's reasoning.",
    evidence: "You compared the bottom numbers. Let us draw both fractions using equal-sized wholes, then compare the shaded parts.",
    provenance: { source: "transcript", locator: "synthetic_segment_interaction" },
  },
  {
    id: "evidence_demo_structure", startSec: 180, endSec: 190, modality: "transcript",
    dimension: "lesson_structure", uncertainty: "low", impact: "positive",
    claim: "Synthetic example of a transition into practice.",
    evidence: "We have compared fractions with a diagram. Next, try a pair on your own, then explain which method helped you.",
    provenance: { source: "transcript", locator: "synthetic_segment_structure" },
  },
];
const limitations = [
  "Synthetic prerecorded example report: all excerpts, moments and scores are authored illustrations. No real recording or person is represented.",
  "This demo does not analyze uploads or run an AI model. It is not evidence of assessment accuracy.",
  "Rubric 0.1 is uncalibrated. A human must review real evidence and context before using a live result.",
  "Only three illustrative transcript moments are shown. Instructional practice and audio/video usability are not assessable in this example.",
  "Recommendations are suggestions for future practice, not claims that these activities occurred.",
];

export const demoReport: CoachingReport = {
  status: "assessed", providerVersion: "synthetic-display-only", recordingSha256: null, sourceArtifacts: [],
  report: {
    qualityLabel: "Good", scorePercent: 75, rubricVersion: "0.1", confidence: 0.25,
    assessmentLimitations: limitations,
    dimensions: [
      ...observations.map((item) => ({ key: item.dimension, score: 3, evidenceIds: [item.id], rationale: "Illustrative 3/4 anchor for this synthetic moment; not a measured rating." })),
      { key: "instructional_practice", score: null, evidenceIds: [], rationale: "An activity is mentioned, but no evidence of its execution is shown." },
      { key: "technical_usability", score: null, evidenceIds: [], rationale: "No real audio or video is included in this example." },
    ],
    observations: observations.map(({ id, startSec, endSec, modality, claim, evidence, impact, provenance }) => ({ id, startSec, endSec, modality, claim, evidence, impact, provenance })),
    recommendations: ["Ask for an explanation after the independent task, then check for misconceptions."],
  },
  observations,
  strengths: [{ dimension: "clarity_accuracy", evidenceIds: ["evidence_demo_clarity"], text: "In this invented example, the explanation connects two equivalent fractions. Review the cited moment as a possible strength." }],
  opportunities: [],
  nextSteps: [{ dimension: "lesson_structure", evidenceIds: ["evidence_demo_structure"], text: "After the independent task, invite a short explanation and connect the recap to the lesson objective." }],
  limitations, confidence: 0.25,
  confidenceBasis: { temporalCoverage: 0.175, evidenceQuality: 0.9, agreement: null, assessableWeight: 70 },
};
