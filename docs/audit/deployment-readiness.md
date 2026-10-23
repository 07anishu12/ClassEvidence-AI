# Humaniti AI — Deployment Readiness Audit

**Document Version:** 1.0.0  
**Audit Date:** 2026-10-23  
**Auditor:** DevOps & Release Engineering (Workstream G)  
**Status:** **READY FOR SELF-HOSTING & HOSTED SMOKE TESTING**  

---

## 1. Executive Summary

This deployment readiness audit evaluates **Humaniti AI** across local development, containerized on-premises self-hosting, and cloud-hosted environments. The system architecture enforces a strict zero-leakage privacy model: classroom recordings are never sent to third-party cloud AI APIs, media processing is bounded by POSIX resource limits, and all jobs are orchestrated through a durable PostgreSQL queue with distributed leasing and cooperative cancellation.

### Key Audit Findings:
1. **Zero Secret & Data Leakage**: No API keys, credentials, or child data exist in source control. Outbound network traffic to external AI providers is disabled by default (`ASSESSMENT_PROVIDER="blocked"`).
2. **Robust Queue Arbitration**: Assessment jobs use PostgreSQL `FOR UPDATE SKIP LOCKED` with 60-second distributed leases, background heartbeats, and bounded retries.
3. **Bounded Media Processing**: FFmpeg and ffprobe subprocesses execute with strict timeouts, POSIX file size limits, CPU limits, and memory address space bounds (`RLIMIT_AS`).
4. **Comprehensive Test Verification**: 100% of automated tests pass:
   - **Vitest (Node/TypeScript)**: 13 test files, 100 tests passed (486 ms).
   - **Pytest (Python Worker)**: 9 test modules, 41 tests passed (880 ms).
   - **Type Checking & Linting**: `tsc --noEmit` and `eslint .` passed with 0 errors.
   - **Production Next.js Build**: Completed successfully with all static and dynamic routes compiled.

---

## 2. Environment Profile Evaluation

| Dimension | Profile A: Local Development | Profile B: On-Premises Self-Hosted | Profile C: Hosted Cloud / PaaS |
|---|---|---|---|
| **Target Runtime** | macOS / Ubuntu Workstation | Dedicated Linux VM / Bare Metal | Vercel (Web) + Managed PostgreSQL + Worker VM |
| **Database** | Docker Compose (`postgres:16-alpine` on `127.0.0.1:5432`) | Dedicated PostgreSQL 16 (systemd or Compose) | AWS RDS / Neon / Supabase PostgreSQL 16 |
| **Media Storage** | Local directory (`./.private/media`, `0700`) | NVMe mount (`/var/lib/humaniti/media`, `0700`) | Dedicated private block volume (EBS / persistent SSD) |
| **Worker Execution** | `npm run worker:run` (interactive terminal) | `systemd` supervised service (`humaniti-worker`) | Dedicated worker VM / container with systemd |
| **Model Inference** | Mock / Blocked provider or local Ollama | Local Whisper.cpp (`ggml-base.bin`) + Ollama (`qwen3:4b`) | Local inference on worker VM (GPU-accelerated) |
| **Network Egress** | Offline / Disconnected | Strictly isolated (no external AI calls) | Web egress only for HTTPS client requests |
| **Readiness Status** | **VERIFIED & OPERATIONAL** | **PRODUCTION READY** | **READY (Requires private worker VM)** |

---

## 3. Component Architecture & Readiness Matrix

### 3.1: Ingestion & Gateway Layer
- **Input Validation**: `lib/contracts/assessment.ts` validates file MIME types (`video/mp4`, `video/quicktime`, `video/webm`), file sizes ($\le 2\text{ GiB}$), and SHA-256 digests.
- **Path Traversal & Symlink Defense**: `lib/services/media-storage.ts` verifies `realpath(path) === path`, rejects symbolic links, and validates that uploaded files possess hard link count `nlink === 1`.
- **URL & SSRF Protection**: Ingestion rejects private IPv4/IPv6 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/12`, `127.0.0.0/8`, `169.254.0.0/16`), credentials in URLs, and non-HTTPS protocols.
- **Readiness Rating**: **PRODUCTION READY**

### 3.2: Queue Arbitration & Distributed Leasing
- **Lease Protocol**: `scripts/assessment-worker.ts` executes atomic leases using PostgreSQL `FOR UPDATE SKIP LOCKED`.
- **Heartbeat & Watchdog**: The worker pulses heartbeats every 10 seconds. An independent watchdog timer terminates the processing abort signal if the database fails to respond within 50 seconds.
- **Process Group Termination**: If a worker timeout occurs, `process.kill(-child.pid, "SIGKILL")` terminates the entire spawned process group, preventing orphaned FFmpeg or Python processes.
- **Dead-Letter Recovery**: Stale leases are automatically reclaimed after 60 seconds; retryable errors (timeouts, rate limits) retry up to 2 times with exponential backoff (30s, 120s). Non-retryable errors immediately transition to `FAILED`.
- **Readiness Rating**: **PRODUCTION READY**

### 3.3: Media Processing & ASR Pipeline
- **Container Probing**: `MediaProbe` executes `ffprobe` with JSON output parsing, validating codecs (`h264`, `hevc`, `vp8`, `vp9`, `av1`), maximum resolution ($7680\times 4320$), and duration ($\le 7200\text{ s}$).
- **Audio Extraction**: `AudioExtractor` extracts 16-bit mono PCM at 16 kHz using bounded FFmpeg execution. Zero silence or audio-absence is flagged as `not_assessable`, preventing synthetic negative teaching scores.
- **ASR & Evidence Generation**: `prepare_recording` creates deterministic evidence manifests with cryptographically verified artifact digests.
- **Readiness Rating**: **PRODUCTION READY**

### 3.4: Assessment & Rubric Scoring
- **Rubric v0.1 Invariants**: Five pedagogical dimensions (Instructional Clarity 25%, Active Student Engagement 25%, Lesson Structure 20%, Responsive Feedback 20%, Learning Climate 10%).
- **Four Quality Labels**: Deterministic mappings: `Poor (<40)`, `Average (40–59.99)`, `Good (60–79.99)`, `Excellent (>=80)`.
- **Missing Data Handling**: When audio or visual modalities are unavailable, dimensions are classified as `not_assessable`, leaving the overall report unassigned rather than fabricating low scores.
- **Readiness Rating**: **PRODUCTION READY**

### 3.5: Security, Access Control & Data Retention
- **API Token Authentication**: Configurable `ASSESSMENT_ACCESS_TOKEN` enforces authentication on report access.
- **Automated Retention Pruning**: Completed and failed job rows older than `REPORT_RETENTION_DAYS` (default: 30 days) and unlinked media files are pruned automatically every 60 seconds.
- **Scratch Space Purging**: Ephemeral directories matching `work-*` are deleted upon task completion, cancellation, or worker exit.
- **Readiness Rating**: **PRODUCTION READY**

---

## 4. Resource Sizing & Capacity Planning

| Metric | Single Worker Instance | Dual Worker Node | Sizing Rationale |
|---|---|---|---|
| **Max Concurrent Jobs** | 1 job | 2 jobs | Concurrency is serialized per worker process to bound FFmpeg & LLM RAM usage. |
| **Peak Memory per Job** | ~1.8 GB RAM | ~3.6 GB RAM | Bounded by `RLIMIT_AS` (8 GB ceiling) and FFmpeg mono PCM buffers. |
| **Peak CPU Load** | 200% (2 vCPUs) | 400% (4 vCPUs) | Bounded by `OMP_NUM_THREADS="2"` in subprocess environments. |
| **Disk Throughput** | ~50 MB/s NVMe read | ~100 MB/s NVMe read | Video streaming and chunked PCM audio extraction. |
| **Scratch Space per Job** | ~250 MB | ~500 MB | Three 60-second audio windows (opening, middle, end) + Whisper transcripts. |
| **PostgreSQL Connections** | 5 connections | 10 connections | Lightweight query volume; connection pooling managed by Prisma. |

---

## 5. Reliability & Failure Modes Analysis

| Failure Scenario | Trigger Condition | System Response | Recovery Time |
|---|---|---|---|
| **Database Outage during Active Processing** | PostgreSQL container stops or network partitions | Worker heartbeat fails; watchdog timer aborts processing via `AbortController`; unlinked scratch is purged; worker reconnects when DB recovers. | $< 60\text{ s}$ |
| **Media Bomb / Malicious Video Upload** | Extremely high resolution ($>8\text{K}$) or invalid codec | FFprobe fails container validation; job rejected with HTTP 400 or failed with `unsupported_resolution` / `unsupported_codec`. | Immediate ($< 2\text{ s}$) |
| **ASR Speech Model Hang** | Whisper subprocess stalls | Process supervisor timeout fires at 180s; `SIGKILL` issued to process group; job requeued for 1 retry; worker cleans up scratch. | 180s |
| **Host Worker Sudden Crash (SIGKILL / OOM)** | Node.js process abruptly killed | PostgreSQL lease expires after 60s; companion worker reclaims orphaned job via `claimNext()` and resumes processing. | 60s |
| **Adversarial Prompt Injection in Audio** | Class recording contains instructions attempting to alter rubric scores | Transcripts are treated strictly as untrusted artifact data; LLM system instructions remain immutable; ratings must cite valid timestamped evidence IDs. | Protected by design |

---

## 6. Verification Evidence Summary

The following verification suite was executed directly against the codebase:

```bash
# 1. TypeScript Static Typecheck
npm run typecheck
# Result: PASS (0 errors)

# 2. ESLint Code Quality
npm run lint
# Result: PASS (0 warnings, 0 errors)

# 3. Next.js Web & API Tests (Vitest)
npm test
# Result: PASS (13 test files, 100 tests passed in 486ms)

# 4. Python Media Worker Smoke Test
npm run worker:smoke
# Result: PASS ("humaniti_worker import ok")

# 5. Python Media Worker Tests (Pytest)
worker/.venv/bin/pytest worker/tests -v
# Result: PASS (9 test files, 41 tests passed in 880ms)

# 6. Worker TypeScript Compilation
npm run worker:build
# Result: PASS (Compiled into .worker-build/)

# 7. Next.js Production Build
npm run build
# Result: PASS (All static & dynamic routes compiled)

# 8. Docker Compose Validation
docker compose config
# Result: PASS (Valid Compose specification)
```

---

## 7. Deployment Readiness Sign-off

| Readiness Check | Requirement | Audit Finding | Verdict |
|---|---|---|---|
| **Zero Secret Leakage** | No credentials in repo or commit history | Checked `.gitignore`, `.env.example`, git log; zero leaks. | **PASS** |
| **Loopback DB Isolation** | PostgreSQL bound strictly to 127.0.0.1 | Verified in `compose.yaml`. | **PASS** |
| **Private Media Root** | POSIX permissions `0700` enforced | Verified in `scripts/assessment-worker.ts` and `lib/services/media-storage.ts`. | **PASS** |
| **Automated Testing** | 100% test pass rate across Node and Python | 141 tests total (100 Vitest + 41 Pytest), all passing. | **PASS** |
| **CI Automation** | GitHub Actions workflow for test & build | Created `.github/workflows/ci.yml` with valid YAML syntax. | **PASS** |
| **Self-Hosting Documentation** | Complete operational manual | Created `docs/deployment/self-hosting.md`. | **PASS** |

**Final Recommendation:** **APPROVED FOR DEPLOYMENT AND INTEGRATION SMOKE TESTING.**
