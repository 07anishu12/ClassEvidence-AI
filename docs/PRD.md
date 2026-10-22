# Humaniti AI — Product Requirements

Status: Stage 01 audit baseline; implementation has not started.

## Source and product goal

The organiser's three-page challenge brief is the highest-priority source. The full planning document is `Humaniti_AI_PRD_and_4_Stage_Prompt_Book.md`. Build a hosted application that accepts an unseen online class recording, genuinely processes it, classifies teaching quality as exactly `Poor`, `Average`, `Good`, or `Excellent`, and explains the assessment with specific useful observations.

## Challenge facts

- Input: a new class recording by upload or link.
- Output: one of four labels plus specific evidence-backed explanations.
- Evaluation: assessment usefulness 35%, effective AI/problem solving 30%, working application/code 25%, clarity 10%.
- Deliverables: hosted application, GitHub source and README, redacted relevant AI interaction history, and a maximum 300-word explanation.
- Expected effort: approximately 4–5 hours inside a Wednesday 6:00 PM to Friday 12:00 PM submission window. The brief does not state a timezone; verify it with the organiser.
- Recordings are confidential and may identify children. Use only organiser-permitted processing services and do not publish or expose the media.
- Model training is not required; a simple interface is acceptable.

## Users and first useful flow

The primary user is a recruiter/evaluator. They submit a permitted recording, receive a durable job identifier and status, wait for processing, then inspect a report with the label, rubric breakdown, timestamped evidence, uncertainty, and recommendations.

## Evidence-first assessment

1. Validate and privately store the media.
2. Probe duration, codec, tracks, and technical quality.
3. Extract speech/transcript segments and bounded audio diagnostics where permitted.
4. Sample frames with timestamps and inspect instructional content only.
5. Produce structured observations with evidence IDs, time ranges, modality, claim, direct evidence, uncertainty, and relevance.
6. Validate timestamps and evidence support.
7. Score fixed rubric dimensions; calculate the final label deterministically.
8. Generate a coaching-oriented report only from validated observations and stored scores.

## Initial rubric hypothesis

| Dimension | Weight |
|---|---:|
| Conceptual clarity and factual accuracy | 25% |
| Learner interaction and responsiveness | 25% |
| Lesson structure and progression | 20% |
| Instructional practice and engagement | 20% |
| Audio/video usability | 10% |

Each dimension is 0–4 or `null` when evidence is insufficient. Initial percentage boundaries are Poor `<40`, Average `40–59.99`, Good `60–79.99`, and Excellent `>=80`; these are hypotheses and must not be presented as validated psychometrics. Normalize weights over assessable dimensions and report uncertainty when essential evidence is missing.

## Required MVP boundaries

- Stack: Next.js App Router, strict TypeScript, Zod, PostgreSQL, Prisma, Python media worker, FFmpeg/ffprobe, private storage, and a pluggable AI provider.
- Durable states: `queued -> processing -> completed|failed`, with progress, heartbeat/lease, retry, and idempotency where practical.
- API: create assessment, retrieve status, retrieve report, and guarded admin Drive import.
- Report: label, score when justified, rubric version, confidence, limitations, dimension scores, timestamped observations, impact, and recommendations.
- Security: no arbitrary file reads, path traversal, fake MIME trust, SSRF/private-host fetches, public media URLs, or sensitive logs.
- No vector database, face recognition, emotion detection, child identification, or training pipeline for the MVP.

## Acceptance source

The detailed acceptance matrix is in `docs/ACCEPTANCE.md`; unresolved factual inputs are tracked in `docs/ASSUMPTIONS.md`.
