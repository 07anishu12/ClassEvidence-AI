# Handoff — Workstream D: Media Pipeline and Background-Job Engineer

**Date:** 2026-10-23  
**Workstream:** Workstream D (Media Pipeline and Background-Job Engineer)  
**Assigned Scope:**
- `worker/src/humaniti_worker/process.py`
- `worker/src/media/` (`audio.py`, `pipeline.py`, `__init__.py`)
- `scripts/assessment-worker.ts`
- `worker/tests/`

---

## 1. Objectives & Summary

Workstream D resolved the macOS Darwin execution incompatibility, brought the Python test suite to 100% passing (41/41 tests passing), and conducted an in-depth audit of worker lifecycle, lease management, timeout enforcement, and private scratch cleanup.

### Key Deliverables:
- `docs/audit/media-worker-review.md`: Architectural audit report detailing process isolation, lease mechanics, watchdog timer, POSIX resource bounding, and storage lifecycle.
- `docs/handoffs/media-worker.md`: Workstream handoff record with exact changes, decisions, and verification evidence.

---

## 2. Work Completed

### 2.1 Fixed macOS Darwin `RLIMIT_AS` Subprocess Issue
- **Root Cause**: In `worker/src/humaniti_worker/process.py`, `resource.setrlimit(resource.RLIMIT_AS, (8 * 1024**3, 8 * 1024**3))` threw `ValueError: current limit exceeds maximum limit` in the `preexec_fn` hook on macOS Darwin arm64.
- **Fix**: Wrapped the `RLIMIT_AS` limit setting in a `try...except (ValueError, OSError): pass` block. On Linux, this continues enforcing the 8 GB virtual memory ceiling; on macOS Darwin, it gracefully continues without crashing child process initialization.
- **Result**: Immediate unblocking of all subprocess-based tests in `worker/tests/`.

### 2.2 Contract Alignment in Pipeline Tests
- In `worker/tests/test_media_pipeline.py`, `test_real_silent_video_has_no_invented_transcript` previously attempted to access `manifest["artifacts"]` directly on the returned dict of `prepare_recording`.
- In production, `prepare_recording` returns a structured envelope `{ "manifest": prepare_evidence_manifest(...), "hasAudio": False, "transcriptionVersion": None }` as required by `mediaResultSchema` in `scripts/assessment-worker.ts`.
- Updated the test assertion to check `result["manifest"]["artifacts"] == []` and `result["hasAudio"] is False`.

### 2.3 Comprehensive Worker & Media Pipeline Audit
- Audited `scripts/assessment-worker.ts`, `worker/src/humaniti_worker/process.py`, and `worker/src/media/`:
  - **Worker Lifecycle**: Verified single-job concurrency (`busy` gate) and clean signal shutdown (`SIGTERM`/`SIGINT` with `AbortController`).
  - **Lease Management**: Confirmed atomic PostgreSQL row claims (`FOR UPDATE SKIP LOCKED`), 10-second heartbeats (`heartbeatClaim`), and the 50-second local lease watchdog (`armWatchdog`) to avert split-brain execution if database queries hang.
  - **Timeout Enforcement**: Verified outer timeout with process-group kill (`process.kill(-pid, "SIGKILL")`), inner selector-based read timeouts, and kernel-level `RLIMIT_CPU` limits.
  - **Scratch & Source Lifecycle**: Confirmed `0o700` ephemeral scratch creation (`work-${job.leaseToken}`), deterministic deletion in `finally` blocks, source removal on completion, and 60-second periodic sweeping of orphaned work directories and expired files.

---

## 3. Files Modified and Created

### Owned Files Modified:
- `worker/src/humaniti_worker/process.py`: Catch `(ValueError, OSError)` when setting `RLIMIT_AS`.
- `worker/tests/test_media_pipeline.py`: Unpack `manifest` from pipeline result envelope.

### Documentation Deliverables Created:
- `docs/audit/media-worker-review.md`: Complete architectural audit report.
- `docs/handoffs/media-worker.md`: This handoff document.

---

## 4. Verification Evidence & Exact Commands

| Command | Status | Output Evidence |
|---|---|---|
| `./worker/.venv/bin/pytest worker/tests` | **PASS (41/41)** | `41 passed in 0.80s` |
| `npm run typecheck` | **PASS** | `tsc --noEmit` exited 0 with 0 errors |
| `npm run worker:build` | **PASS** | `tsc -p tsconfig.worker.json` exited 0 |
| `npm test` | **PASS (100/100)** | 13 test files passed, 100 tests passed in 455ms |

### Full Pytest Breakdown:
- `worker/tests/test_adversarial.py` (5 tests): PASS
- `worker/tests/test_audio.py` (12 tests): PASS
- `worker/tests/test_evaluation.py` (3 tests): PASS
- `worker/tests/test_evidence.py` (1 test): PASS
- `worker/tests/test_jobs.py` (3 tests): PASS
- `worker/tests/test_media.py` (8 tests): PASS
- `worker/tests/test_media_pipeline.py` (2 tests): PASS
- `worker/tests/test_provider_manifest.py` (2 tests): PASS
- `worker/tests/test_transcribe.py` (5 tests): PASS
- **Total:** 41 passed, 0 failed, 0 skipped.

---

## 5. Architectural Decisions & Invariants

1. **Strict Process Isolation**: Node.js worker and Python media tools interact purely through spawned CLI invocations over stdin/stdout with bounded byte transfers. No raw transcripts, file paths, or child stderr are logged.
2. **Deterministic Ephemeral Storage**: Scratch directories use the job's unique `leaseToken`. If a worker crashes or loses its lease, the next claim generates a new token and fresh scratch, avoiding collisions. The background cleaner sweeps any unowned scratch directories older than 1 hour.
3. **Double Invariant on Leases**: Lease safety does not rely solely on database clock renewal; the autonomous local watchdog cancels running subprocesses 10 seconds before lease expiry, ensuring no worker ever executes after its lease expires.
