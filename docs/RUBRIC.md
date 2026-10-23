# Humaniti AI — Rubric v0.1

Status: **initial hypothesis; not expert-validated**
Created: 2026-10-23
Implementation: `lib/domain/rubric.ts`

## Purpose

This rubric evaluates observable instructional practice in a recorded online lesson. It is a decision-support tool, not a guaranteed measurement of teacher ability and not a basis for judging children or personal characteristics.

The weights and thresholds below are a transparent starting point derived from the project planning document. They must be reviewed after legitimate sample inspection and must not be tuned to force a desired distribution on a held-out recording.

## Dimensions and weights

| Key | Dimension | Weight | Primary evidence |
|---|---|---:|---|
| `clarity_accuracy` | Conceptual clarity and factual accuracy | 25% | Timestamped speech/transcript content, examples, questions, corrections |
| `interaction_responsiveness` | Learner interaction and responsiveness | 25% | Teacher questions, learner input, wait time, feedback, adaptation |
| `lesson_structure` | Lesson structure and progression | 20% | Objective, sequence, scaffolding, transitions, recap, closure |
| `instructional_practice` | Instructional practice and learner activity | 20% | Demonstration, guided practice, learner task, modelling, feedback |
| `technical_usability` | Audio/video usability | 10% | Intelligibility, legibility, interruptions, clipping, missing tracks |
| **Total** |  | **100%** |  |

Technical usability is deliberately capped at 10%. It describes access to the recording and must not dominate instructional quality.

## Score anchors

Scores are integers from 0 to 4. A missing signal is `not_assessable`/`null`, not a zero. A zero requires direct evidence of a serious failure or contradiction; absence of evidence alone never earns zero.

### 1. Conceptual clarity and factual accuracy — 25%

| Score | Observable anchor |
|---:|---|
| 0 | Direct evidence of a materially incorrect or persistently misleading explanation. |
| 1 | Explanation is frequently unclear, unsupported, or materially incomplete in observed moments. |
| 2 | Observed explanation is understandable and mostly accurate, with limited checking or elaboration. |
| 3 | Explanations are clear and accurate, with useful examples or checks across observed moments. |
| 4 | Explanations are consistently precise, accurate, well-scaffolded, and responsive to misconceptions. |

Minimum evidence: at least one timestamped speech/transcript or audio observation of instructional content. Accuracy claims require directly supported content; if subject-matter verification is unavailable, state the limitation rather than infer a zero.

### 2. Learner interaction and responsiveness — 25%

| Score | Observable anchor |
|---:|---|
| 0 | Direct evidence that learner input is repeatedly ignored, dismissed, or contradicted without repair. |
| 1 | Interaction is mostly one-way, with isolated or superficial responses in observed moments. |
| 2 | Some questions or responses occur, but follow-up and adaptation are inconsistent. |
| 3 | The teacher regularly elicits input, allows response time, and gives relevant feedback or adaptation. |
| 4 | Interaction is consistently purposeful, responsive, and used to diagnose and advance understanding. |

Minimum evidence: identify the teacher action and available learner input with timestamps. A learner voice alone, number of voices, silence, camera presence, or facial expression is not evidence of quality.

### 3. Lesson structure and progression — 20%

| Score | Observable anchor |
|---:|---|
| 0 | Observed lesson flow is materially incoherent or prevents the stated learning activity from progressing. |
| 1 | Sequence and transitions are difficult to follow, with little observable scaffolding or closure. |
| 2 | The observed lesson has a usable sequence, though goals, transitions, or recap are uneven. |
| 3 | The lesson progresses coherently with visible scaffolding, purposeful transitions, and some closure. |
| 4 | The sequence is consistently purposeful, well-scaffolded, and adjusted while preserving a clear goal. |

Minimum evidence: one or more timestamped moments showing ordering, transitions, scaffolding, recap, or closure. Sparse frames may support visible-transition claims but cannot prove a complete lesson sequence.

### 4. Instructional practice and learner activity — 20%

| Score | Observable anchor |
|---:|---|
| 0 | Observed practice blocks the learning task or repeatedly provides no usable path to participation. |
| 1 | Instructional activity is mostly passive or unsupported in observed moments. |
| 2 | Some usable practice or demonstration is present, but support and adaptation are limited. |
| 3 | The teacher provides purposeful activity, modelling, practice, and feedback in observed moments. |
| 4 | Practice is consistently active, well-supported, appropriately challenging, and adapted from evidence of learning. |

Minimum evidence: distinguish an activity demonstrated in the recording from one merely mentioned. Claims must refer to instructional actions or learner tasks, never presumed emotion.

### 5. Audio/video usability — 10%

| Score | Observable anchor |
|---:|---|
| 0 | Technical faults make the observed lesson substantially unintelligible or unusable. |
| 1 | Frequent technical faults materially obstruct access to observed content. |
| 2 | The recording is generally usable, with occasional faults or limited legibility. |
| 3 | Speech and instructional visuals are consistently usable with only minor interruptions. |
| 4 | Available audio/video is consistently clear and supports access without material technical friction. |

Minimum evidence: timestamped audio, metadata, or frame evidence. Accent, voice pitch, camera aesthetics, internet conditions outside the teacher's control, and production polish are excluded.

## Evidence contract

Every observation must contain:

- Stable evidence ID.
- `startSec` and `endSec` within the validated recording duration.
- Modality: `audio`, `transcript`, `video`, or `metadata`.
- A concise observable claim and direct evidence description.
- Provenance locator, such as a transcript segment ID, audio diagnostic, frame ID, or media metadata field.
- Impact and uncertainty/limitation where relevant.

The evaluator must reject or downgrade unsupported, contradictory, out-of-range, or sample-inferred claims. A sparse frame sample cannot establish events between frames. A transcript cannot establish visual content. Technical evidence must stay separate from pedagogy.

## Missing-data and uncertainty rules

1. No transcript or speech evidence: interaction and conceptual-content claims may be `not_assessable`; do not infer poor teaching.
2. No usable video frames: structure and visual-legibility claims may be limited; do not infer that no visual teaching occurred.
3. No audio/video track or corrupt media: report the technical limitation and stop the affected analysis path safely.
4. If any dimension has no sufficient evidence, store `null` rather than zero.
5. A final label is eligible only when the three essential dimensions — clarity, interaction, and structure — are assessed and at least 70% of rubric weight is assessable. Otherwise return an uncertainty state to the service layer and explain the missing dimensions.
6. The numeric score is calculated only over assessable dimensions, with weights normalized over that subset. It must never be treated as guaranteed or psychometrically validated.

## Deterministic score and label hypothesis

For assessable dimensions:

```text
scorePercent = 100 × Σ(weight × score / 4) / Σ(assessable weights)
```

Initial thresholds:

- `Poor`: score `< 40`
- `Average`: `40 ≤ score < 60`
- `Good`: `60 ≤ score < 80`
- `Excellent`: score `≥ 80`

The language model, if an organiser-approved provider is later enabled, may extract validated observations and propose dimension scores. It may not alter weights, thresholds, missing-data rules, or the final label.

## Explicitly excluded proxies

Do not score accent, voice pitch, speaking speed by itself, facial expression, apparent happiness, perceived attention, children's appearance or demographics, socioeconomic status, internet conditions outside the teacher's control, camera aesthetics, or excitement/volume alone.

## Calibration status

No authorised recording has been inspected in this stage. Therefore the anchors, weights, and thresholds remain hypotheses. See `docs/EVALUATION_PLAN.md` for the required sample review, blind comparison, held-out run, timestamp audit, and failure analysis before claiming calibration or accuracy.
