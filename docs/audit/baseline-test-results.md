# Baseline Test Results & Verification Record

**Test Execution Date:** 2026-10-23T23:22:00+05:30  
**Baseline Git Commit:** `73776c5` (`chore(baseline): snapshot Stage 17 working state`)  
**Hardware & OS:** Apple Silicon (macOS Darwin 26.x arm64)  
**Runtimes:** Node.js v26.10.0, npm 11.19.1, Python 3.14.7, FFmpeg 8.0, Vitest 5.0.5, Pytest 9.1.1  

---

## 1. Executive Summary

| Test Suite / Check | Command Executed | Result | Duration | Notes / Evidence |
|---|---|---|---|---|
| **TypeScript Typecheck** | `npm run typecheck` | **PASS** | 1.8s | 0 errors across all TypeScript files |
| **ESLint Static Analysis** | `npm run lint` | **PASS** | 2.1s | 0 errors, Next.js / React 19 rules pass |
| **Next.js Production Build** | `npm run build` | **PASS** | 6.8s | Webpack production bundle generated for all 6 routes |
| **Worker TypeScript Build** | `npm run worker:build` | **PASS** | 1.2s | `scripts/assessment-worker.ts` compiled to `.worker-build/` |
| **Vitest Test Suite** | `npm test` | **PASS** | 0.54s | 13 test files, 100/100 tests passed |
| **Python Pytest Suite** | `./worker/.venv/bin/pytest worker/tests` | **FAIL (5/41)** | 0.37s | 36 passed, 5 failed due to macOS `resource.RLIMIT_AS` error |

---

## 2. Vitest Test Breakdown (100% Passing)

```
✓ lib/contracts/assessment.test.ts (14 tests)
✓ tests/ui/intake.test.ts (9 tests)
✓ tests/evidence/evidence.test.ts (9 tests)
✓ tests/scoring/scoring.test.ts (7 tests)
✓ tests/report/report.test.ts (5 tests)
✓ tests/ui/render.test.tsx (7 tests)
✓ tests/integration/api.test.ts (11 tests)
✓ tests/e2e/security.test.ts (12 tests)
✓ lib/domain/rubric.test.ts (11 tests)
✓ lib/domain/job-state.test.ts (2 tests)
✓ lib/providers/types.test.ts (2 tests)
✓ lib/config/env.test.ts (2 tests)
✓ tests/providers/adapters.test.ts (9 tests)

Test Files: 13 passed (13)
Tests:      100 passed (100)
```

---

## 3. Python Pytest Breakdown (5 Failed, 36 Passed)

### Failing Tests:
1. `worker/tests/test_audio.py::test_extracts_mono_audio_with_source_offset_metadata`
2. `worker/tests/test_media.py::test_malformed_ffprobe_output_fails_without_echoing_output`
3. `worker/tests/test_media.py::test_valid_ffprobe_output_becomes_structured_metadata`
4. `worker/tests/test_media_pipeline.py::test_extraction_really_seeks_and_bounds_source_audio`
5. `worker/tests/test_media_pipeline.py::test_real_silent_video_has_no_invented_transcript`

### Failure Diagnostics:
- **Traceback**:
  ```python
  worker/src/humaniti_worker/process.py:25: in run_bounded
      with subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                            stderr=subprocess.DEVNULL, preexec_fn=limits) as child:
      ...
  subprocess.SubprocessError: Exception occurred in preexec_fn.
  ```
- **Root Cause**:
  In `worker/src/humaniti_worker/process.py`, the `limits()` function calls:
  ```python
  resource.setrlimit(resource.RLIMIT_AS, (8 * 1024**3, 8 * 1024**3))
  ```
  On macOS Darwin, setting `RLIMIT_AS` raises `ValueError: current limit exceeds maximum limit`. Wrapping this call with `try ... except (ValueError, OSError): pass` resolves the error and restores full compatibility on both macOS and Linux.

---

## 4. Verification Baseline Conclusion

The core TypeScript application, domain logic, contracts, API routes, and UI components are in an exceptionally strong and passing state.
The only active defect blocking test perfection is the platform resource limit in `worker/src/humaniti_worker/process.py`, which is targeted for immediate remediation in Workstream D (Media Worker).
