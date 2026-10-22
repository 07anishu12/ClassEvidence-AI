# Humaniti AI — Acceptance Matrix

Stage 01 purpose: map every explicit challenge requirement to an owner and an executable verification. Status is `NOT STARTED` unless stated otherwise.

| ID | Requirement | Owner | Verification | Status |
|---|---|---|---|---|
| A01 | Hosted application is reachable for testing | Release | Open hosted URL from a clean session; record HTTP and UI result | NOT STARTED |
| A02 | Accept a new recording by upload | Gateway/UI | Submit a permitted unseen video; verify durable job is created | NOT STARTED |
| A03 | Accept a permitted link where enabled | Gateway | Positive allowlisted source and malicious/private/redirect cases | NOT STARTED |
| A04 | Process the actual input, not filename/sample shortcuts | Worker/Provider | Held-out file produces traceable media evidence independent of name | NOT STARTED |
| A05 | Return exactly Poor/Average/Good/Excellent | Domain | Unit-test deterministic boundaries and integration-test report enum | NOT STARTED |
| A06 | Provide specific useful observations | Provider/Report | Every substantive claim has evidence ID, modality, timestamp, and rationale | NOT STARTED |
| A07 | Keep timestamps accurate and bounded | Worker/Domain | Audit at least five report timestamps against private source moments | NOT STARTED |
| A08 | Use an explicit quality rubric | Domain/Product | Rubric version, weights, score range, null policy, and calibration notes present | NOT STARTED |
| A09 | Do not claim guaranteed numerical grades | Product/UI | Report and README describe decision support, confidence, and limitations | NOT STARTED |
| A10 | Preserve jobs/results across refresh/restart | DB/Worker | Create job, restart or refresh, retrieve same status/result | NOT STARTED |
| A11 | Handle failure and missing evidence honestly | Worker/Report | Corrupt, silent, unsupported, timeout, and unavailable-provider cases end safely | NOT STARTED |
| A12 | Keep recordings and child data private | Security/Release | Inspect tracked files, logs, storage ACLs, response payloads, and retention | NOT STARTED |
| A13 | Use only organiser-approved remote processing | Product/Provider | Record permission evidence; blocked provider cannot fake success | NOT STARTED |
| A14 | Keep secrets out of source and browser | Gateway/Release | Secret scan, `.env` policy, browser/network inspection | NOT STARTED |
| A15 | Provide source code and README | Release | Clean repository contains setup, env names, migrations, run/test commands | NOT STARTED |
| A16 | Provide relevant redacted AI interaction history | Product/Release | `docs/AI_INTERACTION_HISTORY.md` contains sanitized real entries or export instructions | IN PROGRESS |
| A17 | Provide <=300-word explanation | Product/Release | Word-count check on final submission statement; claims match verified results | NOT STARTED |
| A18 | Respect challenge window and timezone | Product | Confirm exact date/time/timezone with organiser; record evidence | UNVERIFIED |
| A19 | Evaluate an unseen recording | QA/Release | Hold out an accessible permitted recording and run from clean flow | NOT STARTED |
| A20 | Preserve at least two hours for final testing/deployment | Product | Maintain time-box log and freeze feature work before final hour | NOT STARTED |

## Stage 01 gate

Stage 01 passes only when every explicit challenge requirement above has an owner and verification path, and unsupported assumptions are clearly marked. It does not claim the application works yet.

## Stage 02 foundation gate

- **PASS:** Next.js/TypeScript typecheck, lint, production build, Vitest, Prisma schema validation/generation, migration equivalence, worker import/compile, worker pytest, Compose configuration, and honest API smoke checks.
- **PARTIAL:** PostgreSQL migration application is blocked because Docker/PostgreSQL is unavailable; real media processing and semantic provider execution remain intentionally unimplemented until permissions and samples are verified.
