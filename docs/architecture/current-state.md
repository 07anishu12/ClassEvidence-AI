# Architecture: Current State Audit

**System:** Humaniti AI — Classroom Recording Quality Assessment Platform  
**Audit Baseline Date:** 2026-10-23  
**Baseline Git Commit:** `73776c5` (`chore(baseline): snapshot Stage 17 working state`)  
**Environment:** macOS Darwin (arm64), Node.js v26.10.0, npm 11.19.1, Python 3.14.7, FFmpeg 8.0, PostgreSQL (Local Docker Compose port 55432)

---

## 1. System Overview

Humaniti AI is designed to analyze classroom video/audio recordings and assign exactly one of four pedagogical quality labels:
- `Poor` (< 40.0)
- `Average` (40.0 – 59.99)
- `Good` (60.0 – 79.99)
- `Excellent` (>= 80.0)

Every substantive observation must be substantiated by observable evidence containing provenance, modality (`audio`, `video`, `transcript`), valid timestamp ranges, and unmanipulated transcript/frame citations. When evidence is incomplete or critical modalities are missing, the system explicitly withholds a rating as `insufficient_evidence` rather than fabricating negative or positive scores.

---

## 2. Component Boundaries & Current Implementation

```
                                 ┌─────────────────────────────┐
                                 │     Next.js Web Client      │
                                 │  (App Router, React 19 UI)  │
                                 └──────────────┬──────────────┘
                                                │ HTTP / REST
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Next.js API Gateway                                    │
│  - /api/health                                                                         │
│  - /api/assessments (POST intake, GET list)                                            │
│  - /api/assessments/[id] (GET status, PATCH cancel, DELETE)                            │
│  - /api/assessments/[id]/report (GET full report snapshot)                             │
└───────────────┬───────────────────────────────┬────────────────────────────────────────┘
                │                               │
                ▼                               ▼
 ┌─────────────────────────────┐  ┌──────────────────────────────────────────────────────┐
 │  PostgreSQL 16 (Prisma ORM) │  │               Private Staging Storage                │
 │  - AssessmentJob            │  │  - Upload streaming intake (.private/scratch)        │
 │  - JobEvent (Heartbeats)    │  │  - Keyframe extractions (.private/frames)            │
 │  - AssessmentReport         │  │  - Mono 16kHz PCM audio (.private/audio)             │
 │  - DimensionScore           │  └──────────────────────┬───────────────────────────────┘
 │  - EvidenceItem             │                         │
 └──────────────▲──────────────┘                         ▼
                │                          ┌───────────────────────────┐
                │ Worker Lease Polling     │  Python Media Extraction  │
                │                          │  - FFmpeg / ffprobe       │
 ┌──────────────┴──────────────┐           │  - Audio diagnostics      │
 │   Background Job Worker     ├──────────►│  - Keyframe sampler       │
 │  - scripts/assessment-      │           │  - whisper.cpp ASR        │
 │    worker.ts                │           └─────────────┬─────────────┘
 └──────────────┬──────────────┘                         │
                │                                        ▼
                ▼                          ┌───────────────────────────┐
 ┌─────────────────────────────┐           │  Domain Scoring & Rubric  │
 │  Inference Provider Gateway │           │  - Evidence grounding     │
 │  - lib/providers/adapters.ts├──────────►│  - Rubric v0.1 calculation│
 │  - Local CLI/Subprocess     │           │  - 4-label determination  │
 │  - Blocked default remote   │           │  - Insufficient-evidence  │
 └─────────────────────────────┘           └───────────────────────────┘
```

### 2.1 Frontend (`app/`, `components/`)
- **Pages**:
  - `app/page.tsx`: Single-page app with `AssessmentForm`, active job polling, and `AssessmentReport` renderer.
  - `app/demo/page.tsx`: Isolated interactive showcase with synthetic mock payloads, enabling full UI inspection without external dependencies or GPU workers.
- **Components**:
  - `components/assessment-form.tsx`: URL validation, drag-and-drop file upload, participant privacy consent checkbox, client-side progress simulation.
  - `components/assessment-report.tsx`: High-contrast rubric visualization, collapsible dimension cards, timestamped evidence viewer, coaching recommendations, and technical limitations banner.
  - `components/assessment-status.tsx`: Real-time state tracker (`queued`, `processing`, `completed`, `failed`) with retry and cancellation actions.
  - `components/recording-intake.tsx`: Direct streaming intake utility with abort handling.
- **Design & Accessibility**:
  - Strict semantic HTML (`main`, `header`, `section`, `article`, `figure`).
  - High contrast color palette meeting WCAG 2.1 AA standards.
  - Responsive down to 390px mobile screens.

### 2.2 Backend & Gateway (`app/api/`, `lib/services/`, `lib/contracts/`)
- **API Routes**:
  - `POST /api/assessments`: Ingests video file (multipart stream) or verified source URL. Validates against basic SSRF (loopback/private IP blocking). Creates `AssessmentJob` in PostgreSQL.
  - `GET /api/assessments/[id]`: Returns real-time execution state, lease status, and error diagnostic codes.
  - `GET /api/assessments/[id]/report`: Returns validated `AssessmentReport` and coaching breakdown.
  - `GET /api/health`: Database connection liveness check.
- **Contracts (`lib/contracts/`)**:
  - `assessment.ts`: Zod schemas for source inputs (`AssessmentSourceSchema`), job lifecycle states, and report payload.
  - `report.ts`: Pure browser-safe Zod schema for client components.
  - `job.ts`: Database job model typing.
- **Services (`lib/services/`)**:
  - `assessment.ts`: Atomic job creation, lease acquisition, status transitions, and cancellation.
  - `media-storage.ts`: File streaming into `.private/scratch/` with SHA-256 digest verification.
  - `report.ts`: Orchestrates provider evidence extraction, referential grounding, rubric scoring, and persistence.

### 2.3 AI & Domain Quality (`lib/domain/`, `lib/providers/`)
- **Rubric v0.1 (`lib/domain/rubric.ts`)**:
  - 5 core dimensions:
    1. *Clarity & Explanation* (Weight: 25%)
    2. *Student Engagement* (Weight: 25%)
    3. *Structure & Pacing* (Weight: 20%)
    4. *Pedagogical Support* (Weight: 20%)
    5. *Assessment & Feedback* (Weight: 10%)
  - Score range: 0.0 – 4.0 per dimension, normalized to 0 – 100 overall score.
  - Minimum coverage requirement: >= 70% assessable weight and mandatory clarity, engagement, and structure evaluation. Missing dimensions are marked `not_assessable`, never penalized as zero.
- **Evidence Grounding (`lib/domain/evidence.ts`)**:
  - Referential integrity check: Every observation must reference a real artifact in the session manifest.
  - Filters out contradictory polarity claims and duplicate timestamps.
- **Scoring Engine (`lib/domain/scoring.ts`)**:
  - Deterministic label assignment.
  - Computes composite confidence based on coverage, excerpt fidelity, and model certainty.
- **Provider Gateway (`lib/providers/`)**:
  - Supports local subprocess adapter (e.g. Ollama / Qwen / Llama CLI) and blocked remote adapter.
  - Enforces JSON schema boundary; prevents prompt injection from altering structural output.

### 2.4 Media Processing & Background Worker (`worker/`, `scripts/`)
- **Worker Daemon (`scripts/assessment-worker.ts`)**:
  - Atomic PostgreSQL lease claiming (`UPDATE ... WHERE status = 'queued' LIMIT 1`).
  - Emits periodic heartbeat events (`JobEvent`) to prevent lease timeout.
  - Coordinates Python media extractor and Node assessment pipeline.
- **Python Media Tools (`worker/src/`)**:
  - `humaniti_worker/media.py`: Local `ffprobe` wrapper extracting duration, container, audio/video stream parameters.
  - `media/audio.py`: FFmpeg mono 16kHz PCM extraction with silence/clipping diagnostics.
  - `media/pipeline.py`: Video keyframe extraction at 0.5 fps and local whisper.cpp speech transcription.
  - `humaniti_worker/process.py`: Bounded subprocess execution with CPU, core, and file size resource limits.

### 2.5 Database & Persistence (`prisma/`)
- PostgreSQL 16 schema with tables: `AssessmentJob`, `JobEvent`, `AssessmentReport`, `DimensionScore`, `EvidenceItem`, `RubricDefinition`.
- Reproducible Prisma migrations:
  - `00000000000000_init`
  - `20261023050000_assessment_integration`

---

## 3. Discovered Defects & Gaps

1. **Subprocess Resource Limit on macOS Darwin**:
   - `worker/src/humaniti_worker/process.py` sets `resource.RLIMIT_AS`. Darwin raises `ValueError: current limit exceeds maximum limit`. This causes 5 pytest failures in the media test suite.
2. **Missing Duplicate Submission Idempotency**:
   - `POST /api/assessments` accepts `idempotencyKey` in the schema but does not enforce a unique constraint or check existing active jobs with the same key.
3. **Open Access Control on Assessment Retrieval**:
   - `GET /api/assessments/[id]` relies solely on unguessable UUIDs without tenant token verification when `ASSESSMENT_ACCESS_TOKEN` is configured.
4. **Source URL DNS Pinning**:
   - URL validation checks the hostname against IP regexes, but does not resolve DNS to check if the target IP is an intranet or AWS/GCP metadata address (SSRF via DNS rebinding).
5. **Open Source Packaging Gaps**:
   - Missing `LICENSE` file.
   - Missing `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`.
   - CI workflow (`.github/workflows/ci.yml`) is not configured.
