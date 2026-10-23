# PROJECT MEMORY — Humaniti AI

Last updated: 2026-10-23; stage: 04/20; git commit: uncommitted Stage 04 changes

## Challenge invariants

Build a hosted app that genuinely processes an unseen online-class recording, assigns exactly `Poor`, `Average`, `Good`, or `Excellent`, and explains the result with timestamped evidence. Prioritize usefulness 35%, AI/problem solving 30%, working app/code 25%, clarity 10%. Keep recordings confidential, use only organiser-approved processors, never publish child data, and never claim a guaranteed numerical grade.

## Current verified state

- Stage 02 foundation is runnable: Next.js App Router, strict TypeScript, Tailwind, ESLint, Vitest, Prisma schema/migration, PostgreSQL Compose service, Python worker package, environment validation, and honest API/UI boundaries.
- API routes exist for health, assessment creation, and assessment retrieval. They validate inputs and return explicit `503` when storage is unconfigured; no fake report is produced.
- The provider boundary is explicitly blocked until organiser approval. Provider output is evidence-only and schema-validated; it cannot supply the final label.
- Rubric v0.1 and an evaluation plan now exist. The rubric has five observable dimensions, weights summing to 100, 0–4 anchors, evidence rules, explicit excluded proxies, missing-data rules, and deterministic thresholds.
- No recordings, transcripts, screenshots, credentials, Drive API credentials, or remote AI services were accessed.

## Repo map

- `app/`: App Router shell and `/api/health`, `/api/assessments`, `/api/assessments/[id]` routes.
- `components/assessment-form.tsx`: honest permitted-URL job form.
- `lib/config/env.ts`: Zod environment validation.
- `lib/contracts/assessment.ts`: source, job, evidence, report, and four-label schemas.
- `lib/domain/job-state.ts`: deterministic job transition rules.
- `lib/db/prisma.ts`: lazy Prisma client access.
- `lib/providers/types.ts`: approved-provider interface, blocked production provider, evidence-output validation.
- `lib/domain/rubric.ts`: versioned dimensions, anchors, thresholds, evidence requirements, assessability rules, and weighted score calculation.
- `prisma/`: PostgreSQL schema and reproducible initial SQL migration.
- `worker/src/humaniti_worker/`: typed, local-only ffprobe metadata probe and CLI.
- `worker/tests/`: media-type and probe failure/fixture tests.
- `compose.yaml`: loopback-bound local PostgreSQL service with healthcheck.
- `docs/`: requirements, acceptance, assumptions, memory, and stage handoffs.

## Contracts

- Job states: `queued -> processing -> completed|failed`; terminal states do not transition backward.
- Sources: validated HTTPS URL or `private://` storage reference; local/private hosts, credentials, fragments, and traversal are rejected.
- Provider output: bounded evidence observations, limitations, and provider version only; strict JSON schema; no overall label.
- Reports: exactly four labels, score percentage, rubric version, confidence, limitations, 0–4 dimension scores, evidence IDs, timestamp/modality/provenance, and recommendations.
- Rubric v0.1: weights 25/25/20/20/10; `Poor <40`, `Average 40–59.99`, `Good 60–79.99`, `Excellent >=80`; final label eligible only when clarity, interaction, and structure are assessed and at least 70% weight is assessable.
- Database: durable job/event/report/rubric/dimension/evidence tables plus lease, heartbeat, retry, and idempotency fields.

## Decisions

- The organiser PDF outranks planning assumptions.
- No third-party AI provider will be used until organiser permission is documented; no silent mock fallback.
- Missing modalities are `not_assessable`, not negative teaching evidence.
- No vector database, model training, face/emotion inference, or sample-specific shortcuts in the MVP.
- Local Compose uses loopback-only PostgreSQL trust authentication for development and is not a production security configuration.
- The database migration is generated from the current Prisma schema and must be applied only when a real private PostgreSQL instance is available.
- Rubric anchors and thresholds are hypotheses, not expert-validated facts; no representative recording was inspected in Stage 04 because Stage 03 dataset discovery was not executed.

## Files changed

- App/config: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `.env.example`, `.gitignore`, `compose.yaml`.
- UI/API: `app/`, `components/`.
- Contracts/services: `lib/config/`, `lib/contracts/`, `lib/domain/`, `lib/db/`, `lib/providers/`.
- Persistence: `prisma/schema.prisma`, `prisma/migrations/00000000000000_init/migration.sql`.
- Worker: `worker/`.
- Stage docs: `docs/memory.md`, `docs/handoffs/02.md`, `docs/AI_INTERACTION_HISTORY.md`.
- Rubric/evaluation: `docs/RUBRIC.md`, `docs/EVALUATION_PLAN.md`, `lib/domain/rubric.ts`, `lib/domain/rubric.test.ts`.

## Verification evidence

- `npm run typecheck` — PASS on 2026-10-23.
- `npm run lint` — PASS.
- `npm test` — PASS; 4 files, 16 tests.
- `npm run build` — PASS; routes generated for `/`, health, assessment create, and assessment retrieval.
- `DATABASE_URL=... npm run prisma:validate` and `npm run prisma:generate` — PASS; Prisma 6.19.3.
- Generated migration compared with `prisma migrate diff` — PASS; SQL matches schema.
- `docker compose config` — PASS; Docker daemon unavailable, so database was not started.
- `worker/.venv/bin/python -m pytest worker/tests` — PASS; 8 tests.
- `npm run worker:smoke` and Python compileall — PASS.
- Local production smoke — PASS for honest behavior: health `503` when DB is unconfigured, valid upload job `503` when storage is unavailable, unsafe URL `400`.
- Stage 04 documentation/domain checks — NOT RUN because the current environment has no installed npm dependencies (`tsc`, `eslint`, `vitest`, `next`, and `prisma` unavailable); user instruction says not to retry these checks in this turn.
- Static rubric contract checks, required-document checks, memory line limit, secret-pattern scan, and `git diff --check` — PASS on 2026-10-23.

## Known defects / blockers

- PostgreSQL migration was not applied: Docker daemon is not running and `prisma migrate deploy` cannot connect/authenticate to localhost:5432.
- No real upload storage, Drive connector, media extraction, transcription, semantic provider, queue worker, or final scoring engine exists yet.
- Organiser approval for remote AI processing, Drive access, sample inventory/labels, retention, and exact deadline timezone remains unresolved.
- Next build warns that the parent `/Users/anny/Desktop/package-lock.json` is outside this repository; the project build still passes. Remove or configure the unrelated parent lockfile before deployment if the warning persists.
- Local Git identity and prior commits exist; no remote repository or hosted deployment exists.
- Stage 03 handoff is missing; dataset discovery and representative-video inspection remain unverified.

## Next stage

Prompt 05 should verify the rubric contract, then harden the Prisma schema and transaction-safe durable job state. Before claiming rubric calibration, run the missing Stage 03 Drive/local inventory and inspect only legitimately permitted media.

## Handoff pointers

- `docs/handoffs/00.md`
- `docs/handoffs/01.md`
- `docs/handoffs/02.md`
- `docs/handoffs/04.md`
- `docs/RUBRIC.md`
- `docs/EVALUATION_PLAN.md`
- `docs/ACCEPTANCE.md`
- `docs/ASSUMPTIONS.md`
- `docs/AI_INTERACTION_HISTORY.md`
