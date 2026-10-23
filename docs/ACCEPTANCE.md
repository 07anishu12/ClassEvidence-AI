# Humaniti AI — Acceptance Matrix

Stage 01 purpose: map every explicit challenge requirement to an owner and an executable verification. Status is `NOT STARTED` unless stated otherwise.

| ID | Requirement | Owner | Verification | Status |
|---|---|---|---|---|
| A01 | Hosted application is reachable for testing | Release | Open hosted URL from a clean session; record HTTP and UI result | NOT STARTED |
| A02 | Accept a new recording by upload | Gateway/UI | Submit a permitted unseen video; verify durable job is created | LOCAL PASS |
| A03 | Accept a permitted link where enabled | Gateway | Positive allowlisted source and malicious/private/redirect cases | DISABLED — Drive connector unavailable |
| A04 | Process the actual input, not filename/sample shortcuts | Worker/Provider | Held-out file produces traceable media evidence independent of name | PARTIAL — actual media processed; classification gate fails |
| A05 | Return exactly Poor/Average/Good/Excellent | Domain | Unit-test deterministic boundaries and integration-test report enum | UNIT PASS — real complete-label gate FAIL |
| A06 | Provide specific useful observations | Provider/Report | Every substantive claim has evidence ID, modality, timestamp, and rationale | PARTIAL — 30 mechanical checks; human review pending |
| A07 | Keep timestamps accurate and bounded | Worker/Domain | Audit at least five report timestamps against private source moments | PARTIAL — original registry checked; human audit pending |
| A08 | Use an explicit quality rubric | Domain/Product | Rubric version, weights, score range, null policy, and calibration notes present | PASS — definition; empirical calibration unavailable |
| A09 | Do not claim guaranteed numerical grades | Product/UI | Report and README describe decision support, confidence, and limitations | LOCAL PASS |
| A10 | Preserve jobs/results across refresh/restart | DB/Worker | Create job, restart or refresh, retrieve same status/result | LOCAL PASS — durable status and concurrent claim smoke |
| A11 | Handle failure and missing evidence honestly | Worker/Report | Corrupt, silent, unsupported, timeout, and unavailable-provider cases end safely | LOCAL PASS |
| A12 | Keep recordings and child data private | Security/Release | Inspect tracked files, logs, storage ACLs, response payloads, and retention | PARTIAL — private files verified; stage-14 tool-output incident recorded |
| A13 | Use only organiser-approved remote processing | Product/Provider | Record permission evidence; blocked provider cannot fake success | PASS — cloud blocked; real runs local only |
| A14 | Keep secrets out of source and browser | Gateway/Release | Secret scan, `.env` policy, browser/network inspection | LOCAL PASS — token/media/trace scan |
| A15 | Provide source code and README | Release | Clean repository contains setup, env names, migrations, run/test commands | PARTIAL — local source and README; no remote publication |
| A16 | Provide relevant redacted AI interaction history | Product/Release | `docs/AI_INTERACTION_HISTORY.md` contains sanitized real entries or export instructions | IN PROGRESS |
| A17 | Provide <=300-word explanation | Product/Release | Word-count check on final submission statement; claims match verified results | NOT STARTED |
| A18 | Respect challenge window and timezone | Product | Confirm exact date/time/timezone with organiser; record evidence | UNVERIFIED |
| A19 | Evaluate an unseen recording | QA/Release | Hold out an accessible permitted recording and run from clean flow | EXECUTED — held-out classification gate FAIL |
| A20 | Preserve at least two hours for final testing/deployment | Product | Maintain time-box log and freeze feature work before final hour | UNVERIFIED — exact deadline unknown |

## Stage 01 gate

Stage 01 passes only when every explicit challenge requirement above has an owner and verification path, and unsupported assumptions are clearly marked. It does not claim the application works yet.

## Stage 02 foundation gate

- **PASS:** Next.js/TypeScript typecheck, lint, production build, Vitest, Prisma schema validation/generation, migration equivalence, worker import/compile, worker pytest, Compose configuration, and honest API smoke checks.
- **PARTIAL:** PostgreSQL migration application is blocked because Docker/PostgreSQL is unavailable; real media processing and semantic provider execution remain intentionally unimplemented until permissions and samples are verified.

## Stage 04 rubric gate

- **PASS:** `docs/RUBRIC.md` and `lib/domain/rubric.ts` define five dimensions, weights summing to 100, observable 0–4 anchors, evidence requirements, excluded proxies, missing-data rules, and deterministic thresholds.
- **BLOCKED:** Representative recording inspection, empirical calibration, and held-out timestamp audit await the missing Stage 03 dataset-discovery/permission result.

## Stage 07 worker gate

- **PASS:** Worker lifecycle code covers lease claim/recovery, heartbeat/progress, bounded retry, cooperative cancellation/timeout, deterministic artifact naming, private scratch cleanup, and an external-process entry point.
- **PARTIAL/BLOCKED:** The durable PostgreSQL repository adapter, FFmpeg execution, and completion of a real sample remain unverified because PostgreSQL, FFmpeg/ffprobe, approved media, and the Stage 06 handoff are unavailable.

## Stage 08 audio/transcription gate

- **PASS:** Audio extraction and transcript contracts enforce source-duration offsets, explicit audio-absent limitations, no fabricated speakers, uncertain diarization flags, bounded subprocess behavior, and redacted logs.
- **PARTIAL/BLOCKED:** Real FFmpeg execution, approved/local model transcription, and a permitted sample run remain unavailable because FFmpeg/ffprobe, the worker test environment, approved media, and provider approval are missing.

## Stage 17 reliability/security gate

- **PASS at contract level:** Adversarial cases cover unsafe inputs, manifest integrity, prompt-injection-as-data, provider unavailability/timeout, private frame access, no-audio handling, concurrent test-worker claims, and redacted logs.
- **BLOCKED/OPEN:** Duplicate-submit idempotency, authenticated report access, DNS-safe source fetching, real 34+ minute/corrupt-codec processing, PostgreSQL concurrency, hosted ACLs, and approved-provider testing are not verified.

## Stages 10–16 verified gates

- Provider permission/schema/budget gates PASS; no production mock fallback or unapproved cloud run.
- Grounding, deterministic scoring boundaries and structured reports PASS in tests. Compatible human calibration remains unavailable.
- API/worker/private upload/progress/cancel/cleanup integration PASS locally; real media reached local inference. No hosted end-to-end success claimed.
- UI desktop/mobile/keyboard and authenticated upload/report view PASS; real held-out observations/limitations displayed without a fake label.
- Evaluation harness and actual failure recording PASS. Product requirement for a complete genuine four-way assessment FAILS: three distinct permitted recordings yielded zero completed quality labels. Human audits and accuracy remain unverified.
