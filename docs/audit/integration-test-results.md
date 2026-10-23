# Humaniti AI — Integration Test Results & Cross-Component Verification (Gate 4)

**Execution Date:** 2026-10-23T23:39:25+05:30  
**Target Release:** `v0.1.0-rc1`  
**Git Revision:** `20c1304` (branch `integration/release-candidate`)  
**Hardware & OS:** Apple Silicon (macOS Darwin 26.x arm64)  
**Runtimes:** Node.js v26.10.0, npm 11.19.1, Python 3.14.7, FFmpeg 8.0, PostgreSQL 16  

---

## 1. Integrated Test Suite Summary

| Check / Suite | Exact Command | Result | Duration | Scope Verified |
|---|---|---|---|---|
| **TypeScript Typecheck** | `npm run typecheck` | **PASS** | 1.9s | 0 errors across all frontend, backend, contracts, and tests |
| **ESLint Static Analysis** | `npm run lint` | **PASS** | 2.0s | 0 warnings, 0 errors |
| **Full Vitest Test Suite** | `npm test` | **PASS (161/161)** | 0.47s | 13 test files covering intake, domain rubric, evidence grounding, scoring, reports, API, and security |
| **Full Pytest Worker Suite**| `./worker/.venv/bin/pytest worker/tests` | **PASS (41/41)** | 3.41s | 9 test files covering media probe, audio 16kHz extraction, ASR parsing, jobs, adversarial |
| **Worker Daemon Build** | `npm run worker:build` | **PASS** | 1.1s | Compiles `scripts/assessment-worker.ts` to `.worker-build/` |
| **Next.js Production Build**| `npm run build` | **PASS** | 6.8s | Generates optimized Webpack production bundle for all 6 routes |
| **Prisma Schema Validation**| `npm run prisma:validate` | **PASS** | 0.05s | Schema syntax and referential integrity verified |
| **Database Migrations** | `npx prisma migrate status` | **PASS** | 0.22s | 3 migrations verified up-to-date in PostgreSQL |
| **Docker Compose Config** | `docker compose config` | **PASS** | 0.08s | Hardened loopback `127.0.0.1:5432` container configuration validated |

---

## 2. Cross-Component Verification Matrix

```
[ Upload / URL Intake ]
       │ (MIME & size validated; idempotency verified; SSRF blocked)
       ▼
[ PostgreSQL Job Queue ]
       │ (Lease claimed atomically: status=QUEUED -> PROCESSING)
       ▼
[ Media Worker Pipeline ]
       │ (Mono 16kHz PCM WAV extracted, keyframes sampled, whisper.cpp ASR)
       ▼
[ Referential Evidence Grounding ]
       │ (Exact timestamps verified, verbatim citations, zero hallucinations)
       ▼
[ Rubric v0.1 Scoring ]
       │ (5 dimensions evaluated; discrete thresholds; insufficient-evidence gating)
       ▼
[ Structured Report Persistence ]
       │ (AssessmentReport + DimensionScore + EvidenceObservation committed)
       ▼
[ Web Client Report Viewer ]
       │ (High contrast badges, collapsible dimension cards, coaching advice)
       ▼
[ Scratch Cleanup Sweeper ]
         (Source media unlinked, temp files removed, zero PII retention)
```

### Detailed Path Verification:
1. **Intake to Gateway**:
   - `tests/ui/intake.test.ts` (9 tests PASS): Validates file size bounds (500MB), valid extensions (.mp4, .webm, .mov), and URL rejection for invalid schemes/hosts.
   - `tests/integration/api.test.ts` (11 tests PASS): Tests authenticated multipart file upload, `Idempotency-Key` deduplication, and safe error codes.
2. **Domain & Provider Boundary**:
   - `lib/contracts/assessment.test.ts` (14 tests PASS): Enforces strict Zod schemas on inputs and outputs.
   - `lib/domain/rubric.test.ts` (11 tests PASS): Evaluates weights, discrete anchors 0–4, and four-tier threshold classification.
   - `tests/evidence/evidence.test.ts` (9 tests PASS): Grounding against session manifest artifacts, verbatim excerpt validation, contradiction removal.
   - `tests/scoring/scoring.test.ts` (7 tests PASS): Weighted score computation, confidence calculation, and insufficient-evidence withholding.
   - `tests/report/report.test.ts` (5 tests PASS): Validates coaching envelope, strengths, opportunities, and limitations.
   - `tests/providers/adapters.test.ts` (9 tests PASS): Verifies blocked default provider, local CLI subprocess isolation, and timeout killing.
3. **Adversarial & Security Boundary**:
   - `tests/e2e/security.test.ts` (73 tests PASS): Validates SSRF prevention, directory traversal rejection (`private://`), transcript prompt injection containment, and token-based access control.
4. **Media & Background Processing**:
   - `worker/tests/test_audio.py` (12 tests PASS): Mono extraction, silence detection, clipping diagnostics.
   - `worker/tests/test_media_pipeline.py` (2 tests PASS): Offset seeking, keyframe extraction, silent video handling.
   - `worker/tests/test_adversarial.py` (5 tests PASS): Concurrent worker claims, cooperative timeout, private frame root enforcement.
   - `worker/tests/test_transcribe.py` (5 tests PASS): Offset bounds, speaker diarization uncertainty, redacted summaries.
   - `worker/tests/test_jobs.py` (3 tests PASS): Lease claiming, recovery of expired leases, heartbeat events.
