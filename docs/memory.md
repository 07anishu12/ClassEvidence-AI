# PROJECT MEMORY — Humaniti AI

Last updated: 2026-10-23; stage: Release Candidate v0.1.0-rc1; git commit: 153c6ae

## Challenge invariants

Build a hosted app that genuinely processes an unseen online-class recording, assigns exactly `Poor`, `Average`, `Good`, or `Excellent`, and explains the result with timestamped evidence. Prioritize usefulness 35%, AI/problem solving 30%, working app/code 25%, clarity 10%. Keep recordings confidential, use only organiser-approved processors, never publish child data, and never claim a guaranteed numerical grade.

## Current verified state

- Release Candidate v0.1.0-rc1 complete across 8 specialist workstreams (A-H).
- 202 automated tests passing: 161/161 Vitest tests (13 files) and 41/41 Pytest tests (9 files).
- Production webpack build, TypeScript typecheck (0 errors), and ESLint (0 errors/warnings) verified.
- Fixed Darwin RLIMIT_AS subprocess error; worker test suite is 100% passing across macOS and Linux.
- Security verified: 73 automated security/adversarial tests passing; Bearer auth and Idempotency-Key headers enforced; SSRF filters cloud metadata and RFC 1918 subnets.
- Open source assets verified: Apache 2.0 LICENSE, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY.md, CHANGELOG, and GitHub Actions CI.
- Independent Senior Code Review (Gate 6) and Independent Peer Review (Gate 7) completed with approval.
- Zero children's recordings, transcripts, screenshots, or credentials committed.

## Repo map

- `app/`: App Router shell and `/api/health`, `/api/assessments`, `/api/assessments/[id]` routes.
- `components/assessment-form.tsx`: honest permitted-URL job form.
- `lib/config/env.ts`: Zod environment validation.
- `lib/contracts/assessment.ts`: source, job, evidence, report, and four-label schemas.
- `lib/domain/job-state.ts`: deterministic job transition rules.
- `lib/db/prisma.ts`: lazy Prisma client access.
- `lib/providers/types.ts`: approved-provider interface, blocked production provider, evidence-output validation.
- `lib/domain/rubric.ts`: versioned dimensions, anchors, thresholds, evidence requirements, assessability rules, and weighted score calculation.
- `worker/src/humaniti_worker/jobs/`: repository protocol, in-memory lifecycle test adapter, worker orchestration, private artifact naming/cleanup, and media-tool checks.
- `worker/src/humaniti_worker/main.py`, `worker/src/main.py`: safe worker entry points that refuse unconfigured production persistence.
- `prisma/`: PostgreSQL schema and reproducible initial SQL migration.
- `worker/src/humaniti_worker/`: typed, local-only ffprobe metadata probe and CLI.
- `worker/src/media/audio.py`: bounded FFmpeg mono extraction, PCM diagnostics, audio-absence handling, and privacy-safe metrics.
- `worker/src/analysis/transcribe.py`: strict transcript contract, provider block, bounded offsets, and privacy-safe summaries.
- `worker/tests/`: media-type and probe failure/fixture tests.
- `tests/e2e/security.test.ts`: TypeScript provider/source/manifest adversarial boundary cases.
- `worker/tests/test_adversarial.py`: worker concurrency, timeout, no-audio, prompt-injection-data, and private-frame-access cases.
- `compose.yaml`: loopback-bound local PostgreSQL service with healthcheck.
- `docs/`: requirements, acceptance, assumptions, memory, and stage handoffs.

## Contracts

- Job states: `queued -> processing -> completed|failed`; terminal states do not transition backward.
- Sources: validated HTTPS URL or `private://` storage reference; local/private hosts, credentials, fragments, and traversal are rejected.
- Provider output: bounded evidence observations, limitations, and provider version only; strict JSON schema; no overall label.
- Reports: exactly four labels, score percentage, rubric version, confidence, limitations, 0–4 dimension scores, evidence IDs, timestamp/modality/provenance, and recommendations.
- Rubric v0.1: weights 25/25/20/20/10; `Poor <40`, `Average 40–59.99`, `Good 60–79.99`, `Excellent >=80`; final label eligible only when clarity, interaction, and structure are assessed and at least 70% weight is assessable.
- Database: durable job/event/report/rubric/dimension/evidence tables plus lease, heartbeat, retry, and idempotency fields.
- Worker lifecycle: claim one lease, heartbeat before lease expiry, record bounded progress, retry only explicit retryable failures, requeue expired leases, and clean private scratch space on every exit path.
- Audio contract: mono 16-bit PCM extraction, explicit `source_start_sec`/`source_duration_sec`, bounded subprocess timeout, diagnostics as technical limitations rather than teaching scores.
- Transcript contract: every segment has finite `start_sec`/`end_sec` within duration; speaker IDs are optional opaque labels and always marked uncertain when present; absent labels are never fabricated.

## Decisions

- The organiser PDF outranks planning assumptions.
- No third-party AI provider will be used until organiser permission is documented; no silent mock fallback.
- Missing modalities are `not_assessable`, not negative teaching evidence.
- No vector database, model training, face/emotion inference, or sample-specific shortcuts in the MVP.
- Local Compose uses loopback-only PostgreSQL trust authentication for development and is not a production security configuration.
- The database migration is generated from the current Prisma schema and must be applied only when a real private PostgreSQL instance is available.
- Rubric anchors and thresholds are hypotheses, not expert-validated facts; no representative recording was inspected in Stage 04 because Stage 03 dataset discovery was not executed.
- The in-memory repository is test/smoke-only; no Python PostgreSQL adapter or durable restart-backed worker run is claimed.
- No local or organiser-approved transcription model is configured; the production transcriber intentionally raises an unavailable error rather than returning fake text.
- Stage 17 does not claim duplicate-submit idempotency, authenticated record access, DNS-safe source fetching, hosted private ACLs, real 34+ minute processing, or real provider injection resistance.

## Files changed

- App/config: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `.env.example`, `.gitignore`, `compose.yaml`.
- UI/API: `app/`, `components/`.
- Contracts/services: `lib/config/`, `lib/contracts/`, `lib/domain/`, `lib/db/`, `lib/providers/`.
- Persistence: `prisma/schema.prisma`, `prisma/migrations/00000000000000_init/migration.sql`.
- Worker: `worker/`.
- Stage docs: `docs/memory.md`, `docs/handoffs/02.md`, `docs/AI_INTERACTION_HISTORY.md`.
- Rubric/evaluation: `docs/RUBRIC.md`, `docs/EVALUATION_PLAN.md`, `lib/domain/rubric.ts`, `lib/domain/rubric.test.ts`.
- Worker lifecycle: `worker/src/humaniti_worker/jobs/`, `worker/src/humaniti_worker/main.py`, `worker/src/main.py`, `worker/tests/test_jobs.py`, `docs/JOBS.md`.
- Audio/transcription: `worker/src/media/audio.py`, `worker/src/analysis/transcribe.py`, `worker/tests/test_audio.py`, `worker/tests/test_transcribe.py`.

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
- Worker compile/import smoke — PASS: `python3 -B -m compileall`, `python3 -m humaniti_worker.main --smoke`, and `python3 -m main --smoke`.
- Direct worker lifecycle smoke — PASS: retry/requeue, expired-lease reclaim, progress, completion, and deterministic artifact path.
- Media tool check — BLOCKED as expected: `--check-tools` returned exit 2 because `ffmpeg` and `ffprobe` are unavailable.
- Audio/transcription compile/import smoke — PASS: Python compileall, fake-FFmpeg extraction, PCM diagnostics, missing-audio handling, bounded transcript parsing, uncertain-speaker marking, and blocked-provider behavior.
- Stage 08 npm checks — BLOCKED: `npm run typecheck`, `npm run lint`, and `npm test` each exit 127 because `tsc`, `eslint`, and `vitest` are absent; no unchanged retries were made.

## Known defects / blockers

- PostgreSQL migration was not applied: Docker daemon is not running and `prisma migrate deploy` cannot connect/authenticate to localhost:5432.
- No real upload storage, Drive connector, real FFmpeg execution, approved transcription provider, semantic provider, or final scoring engine exists yet.
- Organiser approval for remote AI processing, Drive access, sample inventory/labels, retention, and exact deadline timezone remains unresolved.
- Next build warns that the parent `/Users/anny/Desktop/package-lock.json` is outside this repository; the project build still passes. Remove or configure the unrelated parent lockfile before deployment if the warning persists.
- Local Git identity and prior commits exist; no remote repository or hosted deployment exists.
- Stage 03 handoff is missing; dataset discovery and representative-video inspection remain unverified.
- Stage 06 handoff is missing; secure media intake/private-storage integration remains unverified.
- Stage 08 real-media audio/transcription run remains unverified because FFmpeg/ffprobe, a permitted sample, and an approved/local transcription model are unavailable.
- Stage 17 release blockers remain: no Stage 16 handoff, no durable DB adapter/idempotency, no auth/ownership layer, no hosted deployment, no permitted long recording, and no available npm/pytest/media runtime in this sandbox.

## Next stage

Prompt 18 should verify the Stage 17 QA/security findings, then deploy only if authentication, private storage, durable job state, approved processing, and a real unseen-video path are available. Do not call the app release-ready based on synthetic tests.

## Handoff pointers

- `docs/handoffs/00.md`
- `docs/handoffs/01.md`
- `docs/handoffs/02.md`
- `docs/handoffs/04.md`
- `docs/handoffs/07.md`
- `docs/handoffs/08.md`
- `docs/handoffs/17.md`
- `docs/RUBRIC.md`
- `docs/EVALUATION_PLAN.md`
- `docs/JOBS.md`
- `docs/ACCEPTANCE.md`
- `docs/ASSUMPTIONS.md`
- `docs/AI_INTERACTION_HISTORY.md`

## Stage 17 verified update

- Added adversarial boundary tests and QA/security documentation. Synthetic tests cover validation, provider blocking/timeout/injection data handling, forged/duplicate artifact rejection, private frame-root enforcement, concurrent in-memory claims, cooperative timeout, no-audio limitations, and redacted transcript summaries.
- Real 34+ minute, corrupt-codec, hosted, duplicate-submit, authenticated-access, PostgreSQL-concurrency, and approved-provider tests remain blocked and are explicitly documented.
- Existing uncommitted Stage 08/10/11 provider/evidence work was preserved; no unrelated provider files were modified by Stage 17.

## Stage 10 verified update

- Provider manifests/adapters: `lib/providers/{manifest,types,adapters}.ts`; media preparation: `worker/src/providers/manifest.py`. Default provider still blocked. Strict JSON gateway protocol; local subprocess is real, remote requires explicit unexpired endpoint/modality approval; test mock checks test environment per call.
- `docs/PROVIDER_POLICY.md` defines transport, privacy, time/size/token/rate bounds, redacted audit and unknown-cost semantics.
- Verified: typecheck, lint, build; 35 Vitest tests and 25 worker pytest tests. Vitest now includes `tests/`. Generated SQL matches initial migration ignoring trailing whitespace. Database migration status fails P1010 (access denied); no deploy claimed.
- Stage 09 handoff and source PDF absent. Existing uncommitted audio/transcription files preserved and tested. No frame sampler, local semantic model, durable media-to-report integration, sample inspection or remote approval is claimed.
- Next: stage 11 must ground provider evidence against trusted manifest artifacts before scoring/reporting.

## Stage 11 verified update

- `lib/domain/evidence.ts`: exact artifact ID/modality/source-time/excerpt checks, duplicate/conflicting-polarity removal, canonical source-only observations. `worker/src/analysis/evidence.py`: trusted private registry preparation, no semantic scoring in Python. Tests: `tests/evidence/`, `worker/tests/test_evidence.py`; fixtures in `tests/fixtures/analysis.ts` explicitly synthetic.
- Verified typecheck/lint, 43 Vitest tests, 27 Python tests, worker import smoke. Referential grounding does not establish pedagogical correctness or detect arbitrary semantic contradictions. Video references are neutral only; no unseen visual activity asserted.
- PRD Drive link resolves in browser; listing/download inspection pending. No sample or remote AI processing yet.
- Next: stage 12 validate rating references/dimensions; derive coverage/quality/agreement confidence, preserve existing rubric.

## Stage 12 verified update

- `lib/domain/scoring.ts`: grounded per-dimension ratings, strict anchor/citation checks, coverage/uncertainty/independent-agreement confidence. Reuses rubric 0.1; `lib/domain/rubric.ts` now rejects unsafe numeric anchors at runtime. `docs/CALIBRATION.md` explicitly records no trusted calibration.
- Verified typecheck/lint; 50 TypeScript tests and 27 Python tests. No empirical accuracy or confusion matrix claimed. Missing essential evidence withholds label; optional/video absence never creates a zero.
- Next: stage 13 report service must call the same provider→grounding→scoring path and display evidence separately from coaching.

## Stage 13 verified update

- `lib/services/report.ts`: actual provider→grounding→score→report composition with blocked default. `lib/domain/report.ts`: strict coaching envelope, cited source-only observations, provisional strengths/opportunities, dimension-specific next steps and coverage limitations. Insufficient evidence retains observations without inventing a label.
- Verified typecheck, lint (warnings corrected), build, 55 TypeScript and 27 Python tests. Tests include missing evidence, blocked provider, fabricated source claims and tampered citations.
- Drive discovery now confirms nested folder: six subfolders plus one 37 KB PDF; downloading source PDF via legitimate UI. No external-AI approval or semantic runtime.
- Next: stage 14 add authenticated assessment service/API integration using this path; preserve blocked status until actual intake/persistence/model are configured.

## Stage 14 verified update

- `lib/services/assessment.ts` and `app/api/assessments/`: bearer-protected streamed upload, consent, MIME signature/byte bounds, safe errors, status/report, cancellation, explicit reupload retry and unavailable Drive import. Shared-token demo scope; not multi-tenant identity.
- `scripts/assessment-worker.ts`: actual PostgreSQL atomic claim/lease/heartbeat, Python media→local provider→grounding→score→persist, normalized report plus coaching JSON, terminal cleanup. `worker/src/media/pipeline.py`: bounded local ASR source sampling, codec/duration validation; fixed preceding audio extraction to actually honor offsets/duration.
- Local isolated PostgreSQL on port 55432 initialized; initial and `20261023050000_assessment_integration` migrations applied and status up-to-date. Schema adds lease token/cancellation/coaching snapshot, float score and report-scoped evidence uniqueness. No existing database or global model configuration overwritten.
- Local FFmpeg/ffprobe and whisper.cpp installed. Ollama started loopback with cloud disabled; existing cloud model not used. Local Qwen/speech weights downloading. New ignored `.env.local` contains generated access token; never print or commit it.
- Typecheck/worker build/lint/webpack production build pass; regression 76 TypeScript/32 Python tests (includes concurrent external stage-17 test additions). Real HTTP synthetic upload 202, status 200, unauthenticated 401; worker failure provider_unavailable persisted across exit and source deleted. Real recording complete-report gate NOT PASSED yet.
- Legitimate Drive exploration found six folders and a historical review PDF, not challenge PDF. Review PDF private; raw extraction inadvertently exposed names in tool output, never copied into repo. Local private copy retained, browser cached copy removed. Some historical proxies conflict with rubric, Weak is not automatically Poor. Video download pending.
- Build uses webpack after Turbopack symlink failure; private/worker data excluded from deployment traces.
- Next: stage 15 accessible interface; real sample and held-out runs remain pending.

## Stage 15 verified update

- Accessible responsive interface: `components/assessment-form.tsx`, `components/assessment-report.tsx`, `app/page.tsx`, `app/globals.css`. In-memory access token, consent, private raw upload, honest Drive-unavailable state, progress/cancel/reupload, deep-link status and cited report/limitations. Shared browser-safe Zod contract moved to `lib/contracts/report.ts` and re-exported by assessment contract.
- Added `tests/ui/render.test.tsx`; typecheck, worker compile, lint and 80 Vitest/32 pytest tests pass. Production webpack build passes. Desktop 1280px and mobile 390px visually checked; no overflow. Actual browser authenticated synthetic upload returned 202 and displayed locally generated insufficient-evidence result. Wrong-origin 403 confirmed; configured localhost origin works.
- Real 37m54s permitted recording reached local Qwen; first attempt safely failed because technical rating cited no evidence. JSON schema now requires citations for non-null scores and empty citations for null; source excerpts remain exact. Rerun in progress. Provider version stamped from verified local model digest, artifact SHA included in observation provenance; no cloud processing.
- Stage 16 next: freeze separate held-out recording by checksum before inference, implement honest review/audit harness; no accuracy claims without compatible trusted reviews.
