# Handoff — DevOps & Release Engineering (Workstream G)

**Date:** 2026-10-23  
**Workstream:** Workstream G (DevOps, CI & Release Engineering)  
**Specialist:** DevOps & Release Engineer  
**Status:** Complete  
**Git Branches / Baseline:** Baseline commit `0a97ac0`, work branch `work/devops`  

---

## 1. Scope & Ownership

The scope for Workstream G is strictly bounded to the following owned files:
- `.github/workflows/ci.yml` (Created)
- `compose.yaml` (Updated for production-ready self-hosting & zero secret leakage)
- `.env.example` (Updated with comprehensive configuration and security documentation)
- `docs/deployment/self-hosting.md` (Created)
- `docs/audit/deployment-readiness.md` (Created)
- `docs/handoffs/devops.md` (Created)

No files outside this owned scope were modified.

---

## 2. Work Completed

1. **GitHub Actions CI Pipeline (`.github/workflows/ci.yml`)**:
   - Configured an automated CI workflow triggered on pushes to `main` and pull requests.
   - Sets up Node.js 22.x LTS and Python 3.12 with pip and npm dependency caching.
   - Installs system multimedia tools (`ffmpeg`, `ffprobe`).
   - Executes static analysis and typechecking: `npm run prisma:generate`, `npm run typecheck`, `npm run lint`.
   - Runs full Vitest suite (13 test files, 100 unit/integration tests).
   - Installs Python worker dependencies (`pip install -e "./worker[test]"`).
   - Executes worker smoke check (`npm run worker:smoke`) and full Pytest suite (41 tests).
   - Builds TypeScript background worker daemon (`npm run worker:build`).
   - Executes Next.js production build (`npm run build`).
   - Validated workflow YAML syntax against the GitHub Actions schema.

2. **Docker Compose Hardening (`compose.yaml`)**:
   - Maintained strict loopback binding (`127.0.0.1:5432:5432`) to prevent remote access or LAN exposure.
   - Parameterized service environment (`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST_AUTH_METHOD`) to support both development trust authentication and secured production authentication without file edits.
   - Added container restart policy (`restart: unless-stopped`) and startup period to database healthcheck.
   - Verified zero secret leakage (no hardcoded passwords).
   - Validated with `docker compose config`.

3. **Environment Security & Self-Hosting Reference (`.env.example`)**:
   - Structured into 8 clear sections: Core Environment, Database Connection, Assessment Provider Policy, Access Control, Private Media Storage & Quotas, Offline AI Runtimes, Background Worker Lifecycle, and Feature Ingestion Flags.
   - Enforced default safe state (`ASSESSMENT_PROVIDER="blocked"`, `URL_IMPORT_ENABLED="false"`, `DRIVE_IMPORT_ENABLED="false"`).
   - Documented token generation via `openssl rand -hex 32` for `ASSESSMENT_ACCESS_TOKEN`.
   - Completely free of credentials, tokens, or external API keys.

4. **Self-Hosting Manual (`docs/deployment/self-hosting.md`)**:
   - Authored comprehensive guide detailing architecture, hardware/OS prerequisites (Ubuntu, Debian, macOS, RHEL), package installation, directory setup (`.private/media` with `0700` permissions), database provisioning, Prisma migrations, Next.js and worker build procedures, and process supervision using `systemd` service units.
   - Documented local offline model runtimes for Whisper.cpp and Ollama (`qwen3:4b`).
   - Provided production Nginx reverse proxy configuration with TLS and 2 GiB upload streaming limits.
   - Detailed operational health checks (`/api/health`), database queue inspection, and retention maintenance (`--cleanup`).

5. **Deployment Readiness Audit (`docs/audit/deployment-readiness.md`)**:
   - Evaluated Local Development, On-Premises Self-Hosted, and Cloud PaaS deployment profiles.
   - Analyzed component readiness across Ingestion, Queue/Leasing, Media/ASR, Rubric Scoring, Security, and Retention.
   - Formulated capacity planning guidelines and failure mode analyses (DB loss, media bombs, worker crash, adversarial prompt injection).
   - Signed off all deployment readiness gates as **PASS**.

---

## 3. Verification Evidence

All verification checks were run locally and passed:

| Command | Status | Output Evidence |
|---|---|---|
| `npm run typecheck` | **PASS** | `tsc --noEmit` completed with 0 errors |
| `npm run lint` | **PASS** | `eslint .` completed with 0 warnings, 0 errors |
| `npm test` | **PASS** | Vitest: 13 test files, 100 tests passed in 486 ms |
| `npm run worker:smoke` | **PASS** | `PYTHONPATH=worker/src python3 -m humaniti_worker --smoke` -> `humaniti_worker import ok` |
| `worker/.venv/bin/pytest worker/tests -v` | **PASS** | Pytest: 9 test files, 41 tests passed in 880 ms |
| `npm run worker:build` | **PASS** | `tsc -p tsconfig.worker.json` compiled successfully to `.worker-build/` |
| `npm run build` | **PASS** | Next.js 16.4.2 production build completed successfully; 6 static/dynamic routes generated |
| `docker compose config` | **PASS** | Validated compose service schema and loopback port mapping |
| CI YAML Syntax Validation | **PASS** | Parsed and validated `.github/workflows/ci.yml` via YAML validator |

---

## 4. Configuration Checklists

### 4.1: CI / GitHub Actions Checklist
- [x] Workflow file placed at `.github/workflows/ci.yml`.
- [x] Node.js 22.x LTS and Python 3.12 configured.
- [x] Caching enabled for npm (`package-lock.json`) and pip (`pyproject.toml`).
- [x] FFmpeg and ffprobe installed via `apt-get` on runner.
- [x] Prisma client generated before typechecking and building.
- [x] Typecheck (`npm run typecheck`), Lint (`npm run lint`), and Unit Tests (`npm test`) executed.
- [x] Worker dependencies installed and Pytest suite executed.
- [x] Production Next.js build verified with test environment variables.

### 4.2: Self-Hosting / Deployment Checklist
- [x] `compose.yaml` binds PostgreSQL strictly to `127.0.0.1:5432`.
- [x] `.env.example` provides complete configuration with zero secrets.
- [x] Private media directory (`.private/media`) enforces `0700` POSIX permissions.
- [x] Background worker (`scripts/assessment-worker.ts`) implements cooperative timeouts, heartbeat watchdog, and process group `SIGKILL`.
- [x] Automated retention cleanup script prunes stale scratch directories and unlinked files.
- [x] Comprehensive documentation provided in `docs/deployment/self-hosting.md`.

---

## 5. Coordination & Next Steps for Integration Lead

1. **Merge to Main / Release Candidate**:
   - The changes in Workstream G are self-contained and ready to merge into `integration/release-candidate`.
2. **Automated Pipeline Trigger**:
   - Once merged to GitHub `main`, `.github/workflows/ci.yml` will automatically validate every future commit and pull request.
3. **Hosted Smoke Test**:
   - Follow the runbook in `docs/deployment/self-hosting.md` to launch the PostgreSQL container, apply migrations, and verify `/api/health`.
