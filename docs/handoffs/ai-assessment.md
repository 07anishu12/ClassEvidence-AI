# Specialist Handoff: AI Assessment & Evaluation (Workstream C)

**Date:** 2026-10-23  
**Stage:** 18/20  
**Role:** Applied AI Engineer and Evaluation Specialist (Workstream C)  
**Recipient Workstreams:** Orchestration, Full-Stack Delivery, Final Submission  
**Governing Context:** `Humaniti_AI_PRD_and_4_Stage_Prompt_Book.md`, `AGENTS.md`, `docs/memory.md`  

---

## 1. Scope & Owned Artifacts

Workstream C is accountable for the AI assessment pipeline, teaching rubric definition, evidence grounding, scoring engine, provider abstraction layer, and empirical evaluation auditing.

### 1.1 Owned Modules
- [`lib/domain/rubric.ts`](file:///Users/anny/Desktop/assignment/lib/domain/rubric.ts) — Rubric v0.1 dimensions, weights, score anchors (0–4), four-label boundary thresholds, and assessability weighting logic.
- [`lib/domain/evidence.ts`](file:///Users/anny/Desktop/assignment/lib/domain/evidence.ts) — Referential grounding pipeline, manifest artifact validation, verbatim excerpt matching, contradiction pruning, and claim de-hallucination.
- [`lib/domain/scoring.ts`](file:///Users/anny/Desktop/assignment/lib/domain/scoring.ts) — Evidence-backed dimension rating validation, cross-dimension citation enforcement, temporal source coverage, and confidence indexing.
- [`lib/domain/report.ts`](file:///Users/anny/Desktop/assignment/lib/domain/report.ts) — Coaching report synthesis, actionable next steps mapping, and `insufficient_evidence` status transition.
- [`lib/providers/adapters.ts`](file:///Users/anny/Desktop/assignment/lib/providers/adapters.ts) — Secure local subprocess execution, secret scrubbing, timeout termination, remote approval verification, IPv4 DNS SSRF defenses, token/rate budgeting, and private auditing.
- [`lib/providers/manifest.ts`](file:///Users/anny/Desktop/assignment/lib/providers/manifest.ts) — Model input manifest schema, SHA-256 integrity validation, and frame magic-byte verification.
- [`lib/providers/types.ts`](file:///Users/anny/Desktop/assignment/lib/providers/types.ts) — Typed provider contracts, Zod schemas for candidate observations and model ratings, and default blocked provider implementation.

### 1.2 Authored Deliverables
- [`docs/audit/ai-review.md`](file:///Users/anny/Desktop/assignment/docs/audit/ai-review.md) — Comprehensive technical audit of rubric versioning, four-label thresholds, referential grounding, excluded proxies, provider security, and prompt injection defense.
- [`docs/evaluation/ai-quality-evaluation.md`](file:///Users/anny/Desktop/assignment/docs/evaluation/ai-quality-evaluation.md) — Evaluation framework specification, calibration criteria, limitations of synthetic fixtures, human benchmark audit protocol, and empirical evaluation results on permitted recordings.
- [`docs/handoffs/ai-assessment.md`](file:///Users/anny/Desktop/assignment/docs/handoffs/ai-assessment.md) — This specialist handoff document.

---

## 2. Verification Evidence & Exact Command Outputs

All unit tests, integration tests, type checks, and evaluation scripts within Workstream C's scope were executed in the workspace. Zero tests failed.

### 2.1 Domain Unit Tests
Command executed:
```bash
npm test lib/domain/rubric.test.ts tests/evidence/evidence.test.ts tests/scoring/scoring.test.ts tests/providers/adapters.test.ts
```
Output:
```
 RUN  v5.0.5 /Users/anny/Desktop/assignment

 ✓ lib/domain/rubric.test.ts (11 tests) 4ms
 ✓ tests/evidence/evidence.test.ts (9 tests) 5ms
 ✓ tests/scoring/scoring.test.ts (7 tests) 7ms
 ✓ tests/providers/adapters.test.ts (9 tests) 187ms

 Test Files  4 passed (4)
      Tests  36 passed (36)
   Duration  377ms
```

### 2.2 Report & Provider Type Tests
Command executed:
```bash
npm test tests/report/ lib/providers/types.test.ts
```
Output:
```
 RUN  v5.0.5 /Users/anny/Desktop/assignment

 ✓ lib/providers/types.test.ts (2 tests) 3ms
 ✓ tests/report/report.test.ts (5 tests) 8ms

 Test Files  2 passed (2)
      Tests  7 passed (7)
   Duration  150ms
```

### 2.3 Adversarial Security & Full Project Test Suite
Command executed:
```bash
npm test
```
Output:
```
 RUN  v5.0.5 /Users/anny/Desktop/assignment

 ✓ tests/scoring/scoring.test.ts (7 tests)
 ✓ tests/evidence/evidence.test.ts (9 tests)
 ✓ tests/report/report.test.ts (5 tests)
 ✓ tests/ui/intake.test.ts (9 tests)
 ✓ lib/contracts/assessment.test.ts (14 tests)
 ✓ tests/ui/render.test.tsx (7 tests)
 ✓ tests/integration/api.test.ts (11 tests)
 ✓ tests/e2e/security.test.ts (12 tests)
 ✓ lib/domain/rubric.test.ts (11 tests)
 ✓ lib/domain/job-state.test.ts (2 tests)
 ✓ lib/config/env.test.ts (2 tests)
 ✓ lib/providers/types.test.ts (2 tests)
 ✓ tests/providers/adapters.test.ts (9 tests)

 Test Files  13 passed (13)
      Tests  100 passed (100)
   Duration  473ms
```

### 2.4 TypeScript Static Typecheck
Command executed:
```bash
npm run typecheck
```
Output:
```
> humaniti-ai@0.1.0 typecheck
> tsc --noEmit
(exited with code 0)
```

### 2.5 ESLint Code Quality Verification
Command executed:
```bash
npm run lint
```
Output:
```
> humaniti-ai@0.1.0 lint
> eslint .
(exited with code 0)
```

### 2.6 Python Media & Worker Tests
Command executed:
```bash
worker/.venv/bin/pytest worker/tests
```
Output:
```
.........................................                                [100%]
41 passed in 0.85s
```

### 2.7 Executable Benchmark Evaluation Run
Command executed:
```bash
python3 scripts/evaluate.py .private/evaluation/results.json
```
Output:
```json
{
  "confusionMatrix": null,
  "dataKind": "permitted_recordings",
  "humanClaimAudit": null,
  "humanTimestampAudit": null,
  "mechanicallyCheckedObservations": 30,
  "outcomes": {
    "completed": 0,
    "failed": 1,
    "insufficient_evidence": 2
  },
  "recordings": 3,
  "splits": {
    "calibration": 1,
    "heldout": 2
  },
  "trustedLabeledHeldoutPredictions": 0
}
```

---

## 3. Core Architectural Highlights Verified

### 3.1 Rubric v0.1 & Four-Tier Deterministic Classification
- **Five Observable Dimensions:** Weights configured as Clarity 25%, Engagement 25%, Structure 20%, Support 20%, Technical Usability 10% (sum = 100%).
- **Discrete Anchors:** Exactly 5 discrete integer anchors ($0, 1, 2, 3, 4$) per dimension.
- **Strict Boundary Mapping:**
  - `Poor`: score $< 40$
  - `Average`: $40 \le \text{score} < 60$
  - `Good`: $60 \le \text{score} < 80$
  - `Excellent`: $\text{score} \ge 80$
- **Weight Normalization:** Scores are normalized only over assessable dimensions; missing video or optional signals do not artificially depress teaching grades.

### 3.2 Insufficient Evidence Gating
- Verified that a quality label is generated **only** if:
  1. All 3 essential dimensions (`clarity_accuracy`, `interaction_responsiveness`, `lesson_structure`) are assessed.
  2. The total assessable weight meets or exceeds $70\%$ (`MINIMUM_ASSESSABLE_WEIGHT = 70`).
- If either invariant fails, `calculateWeightedScore()` returns `qualityLabel: null`.
- `buildCoachingReport()` assigns `status: "insufficient_evidence"` and `report: null`. The system **never** invents an arbitrary or fallback grade.

### 3.3 Referential Grounding Pipeline
- Every observation must match an artifact registered in `manifest.artifacts` by ID.
- Exact match of `startSec` and `endSec` is required; sub-segment timing hallucinations are rejected (`timing_mismatch`).
- Transcript excerpts must be verbatim substrings (`unsupported_excerpt`).
- Video frames cannot assert pedagogical claims on their own (`unsupported_visual_claim`).
- Candidate free-form `claim` text from the model is discarded and replaced with verbatim source excerpts, defeating indirect prompt injection.
- Conflicting polarities (positive vs. negative claims on the same text moment) trigger mutual rejection (`contradiction`).
- High-uncertainty observations are mapped to `not_assessable`, preventing uncertain signals from serving as negative evidence.

### 3.4 Provider Boundary & Security Hardening
- `getAssessmentProvider()` returns `blockedProvider` by default, throwing `ProviderBlockedError`. No unapproved cloud transfer is possible.
- Local provider spawns isolated subprocesses in a detached process group, terminating via `SIGKILL` on timeout.
- Process environment strips database URLs, API keys, and system secrets (`NODE_ENV`, `PATH`, `LANG` only).
- Remote provider verifies unexpired server-side approval, validates IPv4 address ranges to block SSRF (RFC 1918, CGNAT, loopback, link-local metadata), and rejects redirects.
- Model instructions enforce strict schema boundaries; the model is prohibited from returning overall labels.

---

## 4. Current State & Release Gate Status

1. **Domain Logic & Safety Rails:** **PASS**. The domain logic, grounding, security gates, and scoring math are fully verified, robust, and clean.
2. **End-to-End Automated Classification Gate:** **FAIL (Honest Status)**.
   - Evaluated on 3 permitted recordings (1 calibration, 2 held-out).
   - Local offline stack (whisper.cpp tiny multilingual + local Qwen3:4b) did not achieve $\ge 70\%$ low-uncertainty evidence coverage across 50+ minute recordings.
   - Guardrails functioned as designed: rather than guessing a grade, the system yielded 1 validation failure (caught schema discrepancy) and 2 `insufficient_evidence` results.
   - Zero hallucinations or ungrounded grades were exposed to users.

---

## 5. Recommendations for Downstream Workstreams

1. **User Interface Presentation (Workstream D):**
   - When viewing an `insufficient_evidence` assessment, present the limitations clearly to the user, highlighting which dimensions were unassessable.
   - Emphasize that `insufficient_evidence` is an honest guardrail protecting the teacher from unverified automated evaluation.
2. **Third-Party Model Approval (Organizer Interaction):**
   - If the organizer permits remote processing, configure `createRemoteProvider()` with an approved HTTPS endpoint, API key, and unexpired `RemoteApproval` record.
   - Do NOT bypass the approval check or enable unapproved mock fallbacks in production.
3. **Submission & Documentation:**
   - Reference `docs/audit/ai-review.md` and `docs/evaluation/ai-quality-evaluation.md` as primary evidence of AI rigor and safety.
