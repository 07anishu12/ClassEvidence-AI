import type { QualityLabel } from "@/lib/contracts/assessment";

export const RUBRIC_VERSION = "0.1" as const;

export const rubricDimensionKeys = [
  "clarity_accuracy",
  "interaction_responsiveness",
  "lesson_structure",
  "instructional_practice",
  "technical_usability",
] as const;

export type RubricDimensionKey = (typeof rubricDimensionKeys)[number];
export type RubricScore = 0 | 1 | 2 | 3 | 4;

export type RubricAnchor = {
  score: RubricScore;
  description: string;
};

export type RubricDimension = {
  key: RubricDimensionKey;
  label: string;
  weight: number;
  evidenceRequirements: readonly string[];
  forbiddenProxies: readonly string[];
  anchors: readonly RubricAnchor[];
};

const sharedForbiddenProxies = [
  "teacher accent, voice pitch, or speaking speed by itself",
  "facial expression, apparent happiness, or perceived student attention",
  "children's appearance, identity, demographics, or personal attributes",
] as const;

export const rubricDimensions: readonly RubricDimension[] = [
  {
    key: "clarity_accuracy",
    label: "Conceptual clarity and factual accuracy",
    weight: 25,
    evidenceRequirements: [
      "Timestamped speech or transcript evidence of an explanation, example, question, or correction.",
      "A factual-accuracy claim requires a directly supported content moment; missing subject-matter verification is not a zero.",
      "Counterevidence or uncertainty must be recorded when the sampled content is incomplete.",
    ],
    forbiddenProxies: sharedForbiddenProxies,
    anchors: [
      { score: 0, description: "Direct evidence of a materially incorrect or persistently misleading explanation." },
      { score: 1, description: "Explanation is frequently unclear, unsupported, or materially incomplete in the observed moments." },
      { score: 2, description: "Observed explanation is understandable and mostly accurate, with limited checking or elaboration." },
      { score: 3, description: "Explanations are clear and accurate, with useful examples or checks across observed moments." },
      { score: 4, description: "Explanations are consistently precise, accurate, well-scaffolded, and responsive to misconceptions." },
    ],
  },
  {
    key: "interaction_responsiveness",
    label: "Learner interaction and responsiveness",
    weight: 25,
    evidenceRequirements: [
      "Timestamped audio/transcript evidence of meaningful questions, learner input, wait time, feedback, or adaptation.",
      "A response-quality claim must identify the teacher action and the available learner input; a student voice alone is insufficient.",
      "Do not infer engagement, attention, or emotion from faces or silence.",
    ],
    forbiddenProxies: [
      ...sharedForbiddenProxies,
      "number of student voices, smiles, camera presence, or silence without instructional context",
    ],
    anchors: [
      { score: 0, description: "Direct evidence that learner input is repeatedly ignored, dismissed, or contradicted without repair." },
      { score: 1, description: "Interaction is mostly one-way, with isolated or superficial responses in the observed moments." },
      { score: 2, description: "The teacher includes some questions or responses, but follow-up and adaptation are inconsistent." },
      { score: 3, description: "The teacher regularly elicits input, allows response time, and gives relevant feedback or adaptation." },
      { score: 4, description: "Interaction is consistently purposeful, responsive, and used to diagnose and advance learner understanding." },
    ],
  },
  {
    key: "lesson_structure",
    label: "Lesson structure and progression",
    weight: 20,
    evidenceRequirements: [
      "Timestamped evidence of an objective, agenda, progression, transition, scaffold, recap, or closure.",
      "A structure claim must refer to observed ordering or transitions, not presentation style alone.",
      "Sparse frame sampling may show visible transitions but cannot prove the complete lesson sequence.",
    ],
    forbiddenProxies: [
      ...sharedForbiddenProxies,
      "slide count, decorative production quality, or rigid timing by itself",
    ],
    anchors: [
      { score: 0, description: "Observed lesson flow is materially incoherent or prevents the stated learning activity from progressing." },
      { score: 1, description: "Sequence and transitions are difficult to follow, with little observable scaffolding or closure." },
      { score: 2, description: "The observed lesson has a usable sequence, though goals, transitions, or recap are uneven." },
      { score: 3, description: "The lesson progresses coherently with visible scaffolding, purposeful transitions, and some closure." },
      { score: 4, description: "The sequence is consistently purposeful, well-scaffolded, and adjusted while preserving a clear goal." },
    ],
  },
  {
    key: "instructional_practice",
    label: "Instructional practice and learner activity",
    weight: 20,
    evidenceRequirements: [
      "Timestamped evidence of demonstration, guided practice, learner task, worked example, adaptation, or formative feedback.",
      "An engagement claim must describe an instructional action or learner task, never presumed emotion.",
      "The report must distinguish a demonstrated activity from an activity merely mentioned by the teacher.",
    ],
    forbiddenProxies: [
      ...sharedForbiddenProxies,
      "volume, excitement, charisma, background music, or apparent enthusiasm alone",
    ],
    anchors: [
      { score: 0, description: "Observed practice blocks the learning task or repeatedly provides no usable path to participation." },
      { score: 1, description: "Instructional activity is mostly passive or unsupported in the observed moments." },
      { score: 2, description: "Some usable practice or demonstration is present, but support and adaptation are limited." },
      { score: 3, description: "The teacher provides purposeful activity, modelling, practice, and feedback in the observed moments." },
      { score: 4, description: "Practice is consistently active, well-supported, appropriately challenging, and adapted from evidence of learning." },
    ],
  },
  {
    key: "technical_usability",
    label: "Audio/video usability",
    weight: 10,
    evidenceRequirements: [
      "Timestamped audio, metadata, or frame evidence of intelligibility, legibility, interruptions, clipping, silence, or missing tracks.",
      "Technical observations must be separated from pedagogical judgments and must not dominate the quality label.",
      "Unavailable modality is reported as not_assessable, not as poor teaching.",
    ],
    forbiddenProxies: [
      "accent, voice pitch, camera aesthetics, internet conditions outside the teacher's control, or production polish",
    ],
    anchors: [
      { score: 0, description: "Technical faults make the observed lesson substantially unintelligible or unusable." },
      { score: 1, description: "Frequent technical faults materially obstruct access to the observed content." },
      { score: 2, description: "The recording is generally usable, with occasional faults or limited legibility." },
      { score: 3, description: "Speech and instructional visuals are consistently usable with only minor interruptions." },
      { score: 4, description: "Available audio/video is consistently clear and supports access without material technical friction." },
    ],
  },
] as const;

export const qualityThresholds = {
  poorBelow: 40,
  averageBelow: 60,
  goodBelow: 80,
} as const;

export const essentialDimensionKeys: readonly RubricDimensionKey[] = [
  "clarity_accuracy",
  "interaction_responsiveness",
  "lesson_structure",
] as const;

export const MINIMUM_ASSESSABLE_WEIGHT = 70;

export type DimensionAssessment = {
  key: RubricDimensionKey;
  score: RubricScore | null;
  evidenceIds: readonly string[];
};

export type WeightedScoreResult = {
  scorePercent: number | null;
  qualityLabel: QualityLabel | null;
  assessableWeight: number;
  assessableDimensions: number;
  sufficientlyAssessable: boolean;
  limitations: readonly string[];
};

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function dimensionByKey(key: RubricDimensionKey): RubricDimension {
  const dimension = rubricDimensions.find((candidate) => candidate.key === key);
  if (!dimension) {
    throw new Error(`Unknown rubric dimension: ${key}`);
  }
  return dimension;
}

export function validateRubricDefinition(): void {
  const totalWeight = rubricDimensions.reduce((total, dimension) => total + dimension.weight, 0);
  if (totalWeight !== 100) {
    throw new Error(`Rubric weights must sum to 100; received ${totalWeight}`);
  }

  for (const dimension of rubricDimensions) {
    if (dimension.anchors.length !== 5) {
      throw new Error(`${dimension.key} must define anchors for scores 0 through 4`);
    }
    if (dimension.anchors.some((anchor, index) => anchor.score !== index)) {
      throw new Error(`${dimension.key} anchors must be ordered from score 0 through 4`);
    }
    if (dimension.evidenceRequirements.length === 0) {
      throw new Error(`${dimension.key} must define evidence requirements`);
    }
  }
}

export function classifyQuality(scorePercent: number | null): QualityLabel | null {
  if (scorePercent === null) {
    return null;
  }
  if (!Number.isFinite(scorePercent) || scorePercent < 0 || scorePercent > 100) {
    throw new Error("Score percentage must be between 0 and 100");
  }
  if (scorePercent < qualityThresholds.poorBelow) return "Poor";
  if (scorePercent < qualityThresholds.averageBelow) return "Average";
  if (scorePercent < qualityThresholds.goodBelow) return "Good";
  return "Excellent";
}

export function calculateWeightedScore(
  assessments: readonly DimensionAssessment[],
): WeightedScoreResult {
  const seen = new Set<RubricDimensionKey>();
  for (const assessment of assessments) {
    if (seen.has(assessment.key)) {
      throw new Error(`Duplicate rubric dimension: ${assessment.key}`);
    }
    seen.add(assessment.key);
    dimensionByKey(assessment.key);
    if (assessment.score !== null && (!Number.isInteger(assessment.score) || assessment.score < 0 || assessment.score > 4)) {
      throw new Error("Rubric scores must be integer anchors from 0 through 4");
    }
    if (assessment.score !== null && assessment.evidenceIds.length === 0) {
      throw new Error(`Assessable dimension ${assessment.key} requires evidence IDs`);
    }
  }

  const assessable = assessments.filter((assessment) => assessment.score !== null);
  const assessableWeight = assessable.reduce(
    (total, assessment) => total + dimensionByKey(assessment.key).weight,
    0,
  );
  const weightedPoints = assessable.reduce(
    (total, assessment) => total + dimensionByKey(assessment.key).weight * (assessment.score as number) / 4,
    0,
  );
  const scorePercent = assessableWeight === 0 ? null : roundPercent(weightedPoints / assessableWeight * 100);
  const missingEssential = essentialDimensionKeys.filter((key) => !assessable.some((assessment) => assessment.key === key));
  const sufficientlyAssessable = assessableWeight >= MINIMUM_ASSESSABLE_WEIGHT && missingEssential.length === 0;
  const limitations = [
    ...missingEssential.map((key) => `${dimensionByKey(key).label} is not assessable from the available evidence.`),
    ...(assessableWeight < MINIMUM_ASSESSABLE_WEIGHT
      ? [`Only ${assessableWeight}% of rubric weight is assessable; a quality label is withheld.`]
      : []),
  ];

  return {
    scorePercent,
    qualityLabel: sufficientlyAssessable ? classifyQuality(scorePercent) : null,
    assessableWeight,
    assessableDimensions: assessable.length,
    sufficientlyAssessable,
    limitations,
  };
}

validateRubricDefinition();
