# Humaniti AI — Parallel Multi-Agent Execution Plan

**Author:** Principal Engineer & Multi-Agent Orchestrator  
**Baseline Revision:** `73776c5`  
**Execution Target:** Integrated Open-Source Release Candidate (`v0.1.0-rc1`)  
**Created:** 2026-10-23  

---

## 1. Parallel Execution Philosophy & Classification

Per Section 4 of the project specifications, tasks are partitioned into three execution categories:

- **Category A (Parallelizable)**: Independent domain investigations, isolated file modifications, self-contained test suites, security scans, documentation, and open-source packaging.
- **Category B (Partially Parallelizable)**: Workstreams that can develop against agreed shared contracts independently, but require an integration gate before end-to-end verification.
- **Category C (Sequential)**: Work that depends strictly on earlier stages: Gate 1 baseline approval, integration merging, cross-component E2E verification, independent code review, peer review, and final release signoff.

---

## 2. Workstream Breakdown & Task Matrix

| Task ID | Workstream & Role | Scope / Owned Files | Category | Dependencies | Branch / Worktree | Required Tests | Expected Deliverables |
|---|---|---|---|---|---|---|---|
| **TASK-A** | **Workstream A: Frontend & UX**<br>*Senior Frontend Engineer & Accessibility Reviewer* | `app/page.tsx`<br>`app/demo/page.tsx`<br>`components/*`<br>`app/globals.css` | **B** | Shared API Contracts (Gate 1) | `work/frontend` | `tests/ui/intake.test.ts`<br>`tests/ui/render.test.tsx` | - Frontend review doc<br>- `docs/handoffs/frontend.md`<br>- WCAG AA compliant UI |
| **TASK-B** | **Workstream B: Backend & API**<br>*Senior Backend Engineer & API Contract Owner* | `app/api/*`<br>`lib/services/assessment.ts`<br>`lib/contracts/assessment.ts`<br>`lib/contracts/report.ts` | **B** | Shared API Contracts (Gate 1) | `work/backend` | `tests/integration/api.test.ts`<br>`lib/contracts/assessment.test.ts` | - Idempotency & Auth fixes<br>- DNS SSRF pinning<br>- `docs/audit/backend-review.md`<br>- `docs/handoffs/backend.md` |
| **TASK-C** | **Workstream C: AI & Rubric Quality**<br>*Applied AI Engineer & Evaluation Specialist* | `lib/domain/rubric.ts`<br>`lib/domain/evidence.ts`<br>`lib/domain/scoring.ts`<br>`lib/domain/report.ts`<br>`lib/providers/*` | **A** | None (Independent domain) | `work/ai-assessment` | `lib/domain/rubric.test.ts`<br>`tests/evidence/evidence.test.ts`<br>`tests/scoring/scoring.test.ts`<br>`tests/providers/adapters.test.ts` | - Rubric calibration docs<br>- `docs/evaluation/ai-quality-evaluation.md`<br>- `docs/audit/ai-review.md`<br>- `docs/handoffs/ai-assessment.md` |
| **TASK-D** | **Workstream D: Media Processing & Worker**<br>*Media Pipeline & Background-Job Engineer* | `worker/src/*`<br>`scripts/assessment-worker.ts`<br>`worker/tests/*` | **A** | None (Independent worker) | `work/media-worker` | `pytest worker/tests` (all 41 tests) | - Cross-platform `process.py`<br>- `docs/audit/media-worker-review.md`<br>- `docs/handoffs/media-worker.md` |
| **TASK-E** | **Workstream E: Database & Storage**<br>*Database Engineer & Data-Lifecycle Reviewer* | `prisma/schema.prisma`<br>`prisma/migrations/*`<br>`lib/services/media-storage.ts`<br>`lib/db/*` | **B** | API Contracts (Gate 1) | `work/database-storage` | `prisma validate`<br>Migration verification | - Data model doc<br>- Storage retention & cleanup<br>- `docs/architecture/data-model.md`<br>- `docs/handoffs/database-storage.md` |
| **TASK-F** | **Workstream F: Security & Privacy**<br>*Application Security Engineer & Privacy Reviewer* | `docs/SECURITY.md`<br>`docs/security-and-privacy.md`<br>`tests/e2e/security.test.ts` | **A** | Baseline commit | `work/security` | `tests/e2e/security.test.ts`<br>Secret scanning | - Security threat model<br>- Vulnerability audit<br>- `docs/audit/security-findings.md`<br>- `docs/handoffs/security.md` |
| **TASK-G** | **Workstream G: DevOps & CI**<br>*DevOps & Release Engineer* | `.github/workflows/*`<br>`compose.yaml`<br>`.env.example`<br>`docs/deployment/*` | **A** | Baseline commit | `work/devops` | `docker compose config`<br>CI YAML validation | - GitHub Actions CI workflow<br>- Self-hosting manual<br>- `docs/deployment/self-hosting.md`<br>- `docs/handoffs/devops.md` |
| **TASK-H** | **Workstream H: Open-Source Maintainer**<br>*Open-Source Maintainer & DX Lead* | `LICENSE`<br>`README.md`<br>`CONTRIBUTING.md`<br>`CODE_OF_CONDUCT.md`<br>`CHANGELOG.md` | **A** | Baseline commit | `work/opensource` | Markdown lint & link validation | - Open source licensing<br>- Clear README & guidelines<br>- `docs/audit/opensource-readiness.md`<br>- `docs/handoffs/opensource.md` |

---

## 3. Dependency Graph & Execution Funnel

```mermaid
flowchart TD
    G1["Gate 1: Baseline & Shared Contracts Approval"] --> T_A["Task A: Frontend (work/frontend)"]
    G1 --> T_B["Task B: Backend (work/backend)"]
    G1 --> T_C["Task C: AI Quality (work/ai-assessment)"]
    G1 --> T_D["Task D: Media Worker (work/media-worker)"]
    G1 --> T_E["Task E: Database & Storage (work/database-storage)"]
    G1 --> T_F["Task F: Security & Privacy (work/security)"]
    G1 --> T_G["Task G: DevOps & CI (work/devops)"]
    G1 --> T_H["Task H: Open Source DX (work/opensource)"]

    T_A --> G2["Gate 2: Specialist Workstream Completion & Verification"]
    T_B --> G2
    T_C --> G2
    T_D --> G2
    T_E --> G2
    T_F --> G2
    T_G --> G2
    T_H --> G2

    G2 --> G3["Gate 3: Controlled Integration to release-candidate"]
    G3 --> G4["Gate 4: Cross-Component E2E Verification"]
    G4 --> G5["Gate 5: Cross-Component Remediation (P0/P1 fixes)"]
    G5 --> G6["Gate 6: Independent Code Review (Read-Only)"]
    G6 --> G7["Gate 7: Peer Review & Adversarial Challenge"]
    G7 --> G8["Gate 8: Final Release Verification & Verdict"]
```

---

## 4. Worktree and Branch Allocation

To eliminate merge conflicts and concurrent file stomping:
1. Each workstream operates either in a dedicated Git worktree or branch with strictly disjoint file sets:
   - Frontend: `app/page.tsx`, `components/`
   - Backend: `app/api/`, `lib/services/assessment.ts`
   - AI: `lib/domain/`, `lib/providers/`
   - Worker: `worker/src/`, `scripts/assessment-worker.ts`
   - Database: `prisma/`, `lib/services/media-storage.ts`
   - Security: `docs/SECURITY.md`, `tests/e2e/security.test.ts`
   - DevOps: `.github/workflows/`, `compose.yaml`
   - OpenSource: `LICENSE`, `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`
2. All branches branch off `chore(baseline)` (`73776c5`).
3. Integration is staged deliberately into `integration/release-candidate`.

---

## 5. Gate Acceptance Criteria

- **Gate 1 Approval**: Current state, target state, requirements matrix, baseline test results, and execution plan committed.
- **Gate 2 Approval**: Each specialist workstream submits tested diffs, test pass proof, review document, and handoff document.
- **Gate 3 Approval**: All branches merged into `integration/release-candidate` with 0 unresolved conflicts.
- **Gate 4 Approval**: Full Vitest test suite (100+ tests) and full Pytest suite (41 tests) pass without failure or skip. Production build and typecheck pass.
- **Gate 5 Approval**: Zero remaining P0 (critical blocker) and P1 (functional defect) issues.
- **Gate 6 & 7 Approval**: Independent code review and peer review completed with documented findings and signed-off remediations.
- **Gate 8 Approval**: Final verdict documented in `docs/audit/final-verdict.md`.
