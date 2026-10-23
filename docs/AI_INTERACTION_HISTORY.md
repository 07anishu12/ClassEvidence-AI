# Humaniti AI — Sanitized AI Interaction History

This file records relevant development interactions without secrets, credentials, recordings, transcripts, child data, or private payloads. It must contain actual interactions only; do not fabricate entries.

## 2026-10-23 — Stage 01 challenge audit

- **Source:** User-provided Humaniti AI operating contract and Prompt 01/20.
- **Actions performed:** Read the complete project PRD/prompt book; read the organiser challenge PDF at the local path; inspected the empty workspace; initialized local Git metadata; created the operating contract and Stage 01 documentation.
- **Decisions recorded:** The organiser PDF outranks planning assumptions; the exact deadline timezone, Drive access, sample inventory, ground-truth labels, retention policy, and approved remote processors remain unverified.
- **Privacy status:** No recordings, transcripts, screenshots, credentials, or external AI services were accessed or transmitted.
- **Verification status:** Documentation structure, required headings, memory line limit, secret-pattern scan, and `git diff --check` passed; no application functionality is claimed.

## 2026-10-23 — Stage 02 full-stack foundation

- **Source:** User-provided Stage 02/20 implementation prompt.
- **Actions performed:** Verified Stage 01 handoff claims; delegated independent TypeScript and Python foundation work; reviewed the resulting files; corrected contracts, local configuration, migration fields, provider output shape, and a worker test fixture; ran the recorded application, schema, worker, Compose, and HTTP smoke checks.
- **Decisions recorded:** Use a blocked production provider until organiser approval; keep provider output evidence-only; accept only validated HTTPS URLs or private storage references; use loopback-only development PostgreSQL trust auth; keep Compose database-only until app/worker container contracts exist.
- **Privacy status:** No recordings, transcripts, screenshots, credentials, Drive access, or external AI services were accessed or transmitted. `.env.example` contains no committed database password.
- **Verification status:** TypeScript typecheck, lint, build, Vitest, Prisma validation/generation, migration equivalence, Compose config, worker import/compile, worker pytest, and honest API smoke checks passed. Database application is blocked by unavailable PostgreSQL/Docker daemon.

## 2026-10-23 — Stage 04 rubric design

- **Source:** User-provided Prompt 04/20.
- **Actions performed:** Read Stage 02 memory/handoff and required control documents; confirmed the Stage 03 handoff and dataset inventory are missing; added the rubric domain contract/tests, rubric documentation, and evaluation plan.
- **Decisions recorded:** Preserve rubric v0.1 weights 25/25/20/20/10; require observable evidence IDs for non-null scores; treat unavailable signals as `not_assessable`; withhold a label below essential-dimension/70%-weight coverage; keep initial thresholds as hypotheses.
- **Privacy status:** No recordings, transcripts, frames, screenshots, credentials, Drive files, or external AI services were accessed or transmitted.
- **Verification status:** Static rubric/document validation, secret scan, memory line-limit, and `git diff --check` passed. TypeScript, lint, build, Vitest, Prisma, and worker pytest remain blocked because npm dependencies and the worker virtual environment are absent; the user-provided self-check instructed not to retry those failed commands in this turn.

## 2026-10-23 — Stage 07 worker lifecycle

- **Source:** User-provided Prompt 07/20.
- **Actions performed:** Verified the available Stage 04 handoff and missing Stage 06 handoff; added repository/lease lifecycle primitives, heartbeat/progress/retry/cancellation/timeout handling, deterministic artifact naming, private cleanup, media-tool checks, worker entry points, lifecycle tests, and `docs/JOBS.md`.
- **Decisions recorded:** Keep the production persistence adapter behind `JobRepository`; use the in-memory adapter only for tests/smoke; represent cancellation as terminal failed code `cancelled` until the Prisma enum is deliberately extended; use cooperative checkpoints for timeouts.
- **Privacy status:** No recordings, transcripts, frames, screenshots, credentials, Drive files, or external AI services were accessed or transmitted.
- **Verification status:** Compile/import smoke and direct lifecycle smoke passed. FFmpeg/ffprobe check is blocked because both tools are unavailable. Pytest and npm checks remain unavailable because the worker virtual environment and Node dependencies are absent.

## 2026-10-23 — Stage 08 audio and transcription

- **Source:** User-provided Prompt 08/20.
- **Actions performed:** Verified Stage 07 lifecycle evidence and missing Stage 06 handoff; added bounded mono-audio extraction, PCM silence/clipping/possible-dropout diagnostics, audio-absence handling, strict transcript parsing, offset validation, uncertain diarization, redacted summaries, tests, and handoff documentation.
- **Decisions recorded:** Keep transcription blocked until an organiser-approved local/remote provider exists; reject out-of-range transcript offsets; never infer speaker identity; treat technical audio signals as limitations rather than pedagogical scores.
- **Privacy status:** No recordings, transcripts, frames, screenshots, credentials, Drive files, or external AI services were accessed or transmitted. Synthetic WAV fixtures were used only in smoke code and were not stored as media artifacts.
- **Verification status:** Compile/import and direct audio/transcription smoke passed. Real FFmpeg/ffprobe and pytest are blocked; npm typecheck/lint/test each returned exit 127 because dependencies are absent.

## 2026-10-23 — Stage 17 adversarial QA/security

- **Source:** User-provided Prompt 17/20.
- **Actions performed:** Verified the available current provider/evidence boundaries and missing Stage 16 handoff; added TypeScript and Python adversarial tests, QA matrix, security threat register, and explicit long-media/hosted/auth/idempotency blockers.
- **Decisions recorded:** Treat transcript/frame content as untrusted data; preserve fixed provider instructions and strict manifest grounding; document synthetic-only coverage honestly; do not claim duplicate-submit protection or authorization without an implemented contract.
- **Privacy status:** No recordings, transcripts, frames, screenshots, credentials, Drive files, or external AI services were accessed or transmitted. New fixtures are synthetic.
- **Verification status:** Direct Python adversarial smoke passed. npm checks remain unavailable because `tsc`, `eslint`, and `vitest` are absent; pytest/media/database/hosted checks remain blocked.

## Stage 10 — 2026-10-23
User requested provider adapters, explicit approval gates, strict schema, bounds, redacted costs/errors and verification. Implemented and tested the real local subprocess protocol and gated generic remote protocol; no model or private recording used, no remote transfer. Prior stage-09/PDF missing; database access denied. Tests: 35 TypeScript, 25 Python; typecheck/lint/build passed. Follow-up extends work through stages 14–16 and directs sample discovery to the PRD Drive link.

## Stage 11 — 2026-10-23
Implemented artifact/excerpt/time grounding, contradictory-polarity and duplicate filtering, canonical source-only observations and private registry preparation. Verified 43 TypeScript/27 Python tests, lint/typecheck and worker smoke. User identified sample source in PRD; local browser access investigation underway. No private content retained in history.

## Stage 12 — 2026-10-23
Implemented evidence-backed fixed-rubric scoring and coverage/quality/agreement confidence. Synthetic boundary, missing-data and invalid-reference tests pass (50 TypeScript, 27 Python total). Calibration remains explicitly unverified; no grades, accuracy or human labels invented.

## Stage 13 — 2026-10-23
Implemented grounded coaching envelope and shared provider-to-report service; tested useful source observations, insufficient evidence, blocked provider, forged claims and citations. 55 TypeScript/27 Python tests, typecheck/lint/build passed. User extended scope through API/UI/evaluation stages; legitimate Drive exploration continuing. No private media or credentials included here.

## Stage 14 — 2026-10-23
Added real private upload/status/report APIs and PostgreSQL worker integration. Applied reproducible migration to new loopback DB, preserved existing services/settings. 76 TypeScript and 32 Python tests passed; production webpack build and durable synthetic HTTP failure/cleanup smoke passed. Local-only media/model setup initiated with cloud disabled. Legitimate Drive source discovery found historical review PDF; raw extraction exposed identifying text in tool output, not repository files. Private copy protected, cached copy removed; names omitted here. Real-media completion remains pending.

## Stage 15 — 2026-10-23
Built accessible private upload/progress/coaching UI with shared strict browser-safe report validation. 80 TypeScript/32 Python tests and production build passed; desktop/mobile reviewed; actual browser synthetic upload and local insufficient-evidence result verified. Real permitted 37m54s media inference reached local model; unsupported citation-free score rejected, schema tightened and rerun started. No real transcript/screenshots or access token in artifacts/history.
