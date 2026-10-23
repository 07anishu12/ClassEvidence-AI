# Humaniti AI — Integration & Merge Matrix

**Orchestrator:** Principal Engineer & Release Manager  
**Target Release:** `v0.1.0-rc1`  
**Integration Funnel:** Gate 1 (Baseline) ➔ Gate 2 (Specialist Completion) ➔ Gate 3 (Controlled Merge) ➔ Gate 4 (E2E Verification) ➔ Gate 5 (Remediation) ➔ Gate 6 (Code Review) ➔ Gate 7 (Peer Review) ➔ Gate 8 (Final Signoff)  

---

## 1. Specialist Workstream Status Ledger

| Workstream | Role & Specialist | Subagent ID | Status | Branch | Owned Files | Verification Target | Gate 2 Approval |
|---|---|---|---|---|---|---|---|
| **A: Frontend** | Senior Frontend Engineer & A11y Reviewer | `1681079c-e7af-4d5e-bbdb-1568d89782ad` | `IN_PROGRESS` | `work/frontend` | `app/page.tsx`, `app/demo/page.tsx`, `components/*` | `tests/ui/intake.test.ts`, `tests/ui/render.test.tsx` | PENDING |
| **B: Backend** | Senior Backend Engineer & API Contract Owner | `25683f40-c472-4982-8b1b-60a6c4f33a84` | `IN_PROGRESS` | `work/backend` | `app/api/*`, `lib/services/assessment.ts`, `lib/contracts/assessment.ts` | `tests/integration/api.test.ts`, `lib/contracts/assessment.test.ts` | PENDING |
| **C: AI Quality** | Applied AI Engineer & Eval Specialist | `1abe46cc-eb72-418f-a366-f7c05457c79f` | `IN_PROGRESS` | `work/ai-assessment` | `lib/domain/*`, `lib/providers/*` | `lib/domain/rubric.test.ts`, `tests/scoring/scoring.test.ts` | PENDING |
| **D: Media Worker** | Media Pipeline & Background-Job Engineer | `29bc7933-a1fe-4e49-8729-264db054033a` | `IN_PROGRESS` | `work/media-worker` | `worker/src/*`, `worker/tests/*`, `scripts/assessment-worker.ts` | `pytest worker/tests` (41 tests) | PENDING |
| **E: Database** | Database Engineer & Data-Lifecycle Reviewer | `bd8547a0-9567-41c3-82d6-9f258fe7bb62` | `IN_PROGRESS` | `work/database-storage` | `prisma/*`, `lib/services/media-storage.ts`, `lib/db/*` | `prisma validate`, migration diff | PENDING |
| **F: Security** | AppSec Engineer & Privacy Reviewer | `c206519c-27bb-42cb-984b-5e31270242d3` | `IN_PROGRESS` | `work/security` | `docs/SECURITY.md`, `tests/e2e/security.test.ts` | `tests/e2e/security.test.ts`, secret audit | PENDING |
| **G: DevOps** | DevOps & Release Engineer | `0aeea7b2-0498-4835-8760-b0d09f2cff06` | `IN_PROGRESS` | `work/devops` | `.github/workflows/*`, `compose.yaml`, `.env.example` | CI syntax check, Docker Compose config | PENDING |
| **H: Open Source** | Open-Source Maintainer & DX Lead | `f496e8c0-a195-4145-9a05-53c586632e84` | `IN_PROGRESS` | `work/opensource` | `LICENSE`, `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` | License verification, documentation lint | PENDING |

---

## 2. Integration Checkpoints & Criteria

1. **Gate 1 (Baseline & Shared Contracts)**: Approved at commit `0a97ac0`.
2. **Gate 2 (Parallel Completion)**: All 8 subagents submit deliverables, tests passing, and handoff markdown.
3. **Gate 3 (Controlled Merge)**: Synchronize verified changes into `integration/release-candidate` branch.
4. **Gate 4 (E2E Verification)**: Complete integration test suite run (Vitest + Pytest + Next.js build + worker build).
5. **Gate 5 (Remediation)**: Address any discovered integration anomalies (P0/P1 fixes).
6. **Gate 6 (Code Review)**: Independent read-only code review of full diff.
7. **Gate 7 (Peer Review)**: Independent challenge and validation pass.
8. **Gate 8 (Final Verdict)**: Source-release and hosted-service readiness decision.
