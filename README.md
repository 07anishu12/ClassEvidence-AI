# Humaniti AI

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.4.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.12%20--%203.14-yellow?logo=python)](https://www.python.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19.3-teal?logo=prisma)](https://www.prisma.io/)
[![Accessibility](https://img.shields.io/badge/WCAG-2.1_AA-green)](https://www.w3.org/WAI/WCAG21/quickref/)

**Humaniti AI** is an open-source, privacy-first artificial intelligence platform designed to assess observable teaching practices in classroom recordings. Built with Next.js App Router, strict TypeScript, PostgreSQL, and an isolated Python media worker, it assigns exactly one of four pedagogical labels—**`Poor`**, **`Average`**, **`Good`**, or **`Excellent`**—grounded exclusively in verifiable, timestamped evidence.

---

## Table of Contents

- [Mission & Core Principles](#mission--core-principles)
- [Core Invariants & Ethical Safeguards](#core-invariants--ethical-safeguards)
- [System Architecture & Component Map](#system-architecture--component-map)
- [Pedagogical Rubric & Classification](#pedagogical-rubric--classification)
- [Quickstart Guide](#quickstart-guide)
  - [Prerequisites](#prerequisites)
  - [1. Clone and Install Dependencies](#1-clone-and-install-dependencies)
  - [2. Configure Environment Variables](#2-configure-environment-variables)
  - [3. Start Database and Run Migrations](#3-start-database-and-run-migrations)
  - [4. Prepare the Python Media Worker](#4-prepare-the-python-media-worker)
  - [5. Run the Application](#5-run-the-application)
- [Zero-Dependency Demo Mode](#zero-dependency-demo-mode)
- [API Reference](#api-reference)
- [Testing & Quality Verification](#testing--quality-verification)
- [Inference Providers & Local Execution](#inference-providers--local-execution)
- [Ethical Disclaimer & Intended Use](#ethical-disclaimer--intended-use)
- [Contributing & Community](#contributing--community)
- [License](#license)

---

## Mission & Core Principles

Classroom instruction is nuanced, human, and context-dependent. Traditional automated assessment tools frequently suffer from generative hallucinations, opaque scoring, and demographic bias.

Humaniti AI was created with a singular mission: **to provide transparent, verifiable, and respectful instructional coaching feedback without compromise.** Every finding emitted by Humaniti AI can be audited directly against the source recording, ensuring educators and coaches receive actionable insights rooted in what actually transpired in the classroom.

```
       Observable Classroom Practice (Video / Audio)
                             │
                             ▼
  ┌──────────────────────────────────────────────────────┐
  │         Humaniti Grounded Assessment Engine          │
  │   - Verifiable Timestamps & Provenance Locators      │
  │   - Strict Non-Hallucination Invariants              │
  │   - Ephemeral Media & Zero PII Retention             │
  │   - Excluded Demographics & Anti-Bias Filtering      │
  └──────────────────────────┬───────────────────────────┘
                             │
                             ▼
     Deterministic Four-Tier Classification + Coaching Report
       [ Poor (1.0) | Average (2.0) | Good (3.0) | Excellent (4.0) ]
```

---

## Core Invariants & Ethical Safeguards

The platform is engineered around six non-negotiable architectural and ethical invariants:

### 1. Grounded Evidence Over Speculation
Every score and observation must cite a verified evidence item with:
- A stable identifier.
- Exact `startSec` and `endSec` offsets within the recording.
- Valid modality (`audio`, `video`, `transcript`, or `metadata`).
- An unmanipulated direct quotation or observable physical demonstration.
- A provenance locator linking to a specific transcript token or audio diagnostic.

### 2. Missing Evidence is NOT Negative Evidence
Absence of data is never penalized as poor instruction. If audio is unclear, frames are sparse, or a modality is unavailable, that dimension is marked `not_assessable` (`null`), **never zero**. A score of zero requires direct, affirmative proof of pedagogical obstruction or severe factual distortion.

### 3. Fail-Safe Grade Withholding (`insufficient_evidence`)
To prevent misleading classifications from incomplete recordings:
- At least **70%** of the rubric weight must be assessable.
- All three essential core dimensions (*Conceptual Clarity*, *Learner Interaction*, and *Lesson Structure*) must be observable.
- If either condition is not met, the system withholds a grade and returns an explicit `insufficient_evidence` report explaining which observations were unavailable.

### 4. Zero Child PII & Ephemeral Storage
- Classroom recordings are processed in private, local staging paths (`.private/media/`).
- Temporary audio segments and frames are automatically scrubbed upon completion or cancellation.
- Real child faces, voices, names, and classroom footage are strictly barred from version control, logs, and external model APIs.

### 5. Explicitly Excluded Proxies
Humaniti AI strictly rejects subjective and demographic proxies:
- ❌ **No accent or vocal cadence scoring.**
- ❌ **No facial emotion or perceived student attention proxies.**
- ❌ **No camera equipment or video production aesthetics.**
- ❌ **No penalties for external network buffering or technical drops.**

### 6. Blocked-by-Default Provider Architecture
External cloud LLM calls are disabled by default. The system runs offline via local models (e.g., whisper.cpp and Ollama) or deterministic scoring rules. Cloud adapters require explicit administrative configuration and DNS/IP validation.

---

## System Architecture & Component Map

The application is structured into decoupled layers, isolating web presentation, job scheduling, media extraction, and scoring logic:

```mermaid
flowchart TD
    subgraph Client["Presentation Layer"]
        Browser["Next.js Web Client\n(React 19 / Tailwind CSS)"]
        DemoView["Synthetic Demo Route\n(/demo)"]
    end

    subgraph Gateway["API Gateway (Next.js App Router)"]
        IntakeAPI["POST /api/assessments\n(Streaming Intake & Consent Check)"]
        PollAPI["GET /api/assessments/:id\n(Status Polling)"]
        ReportAPI["GET /api/assessments/:id/report\n(Coaching Report Snapshot)"]
        CancelAPI["PATCH /api/assessments/:id\n(Cancellation Handler)"]
    end

    subgraph Storage["Persistence & Media Staging"]
        PG[("PostgreSQL 16 (Prisma ORM)\nJobs, Reports, Evidence Items")]
        PrivateMedia["Private Staging Storage (.private/)\nEphemeral Audio, Frames, Scratches"]
    end

    subgraph Worker["Background Media Worker"]
        JobScheduler["Durable Worker Loop\n(scripts/assessment-worker.ts)"]
        PyMedia["Python Subprocess (worker/src)\nFFmpeg Extraction & whisper.cpp ASR"]
    end

    subgraph Domain["Pedagogical Evaluation Engine"]
        EvidenceValidator["Evidence Grounding Engine\n(lib/domain/evidence.ts)"]
        RubricScorer["Rubric v0.1 Calculation\n(lib/domain/rubric.ts)"]
        ProviderAdapter["Inference Gateway\n(lib/providers/adapters.ts)"]
    end

    Browser --> IntakeAPI
    Browser --> PollAPI
    Browser --> ReportAPI
    Browser --> CancelAPI
    DemoView -.-> Browser

    IntakeAPI --> PG
    IntakeAPI --> PrivateMedia

    JobScheduler -->|Atomic Lease & Heartbeat| PG
    JobScheduler -->|Orchestrates| PyMedia
    PyMedia -->|Extracts Frames & Audio| PrivateMedia
    PyMedia -->|Returns Session Manifest| JobScheduler

    JobScheduler --> ProviderAdapter
    ProviderAdapter --> EvidenceValidator
    EvidenceValidator --> RubricScorer
    RubricScorer -->|Persists Final Report| PG
    JobScheduler -->|Scrubs Ephemeral Media| PrivateMedia
```

### Component Map

| Layer | Primary Technology | Key Files | Responsibility |
|---|---|---|---|
| **Web UI** | Next.js 16, React 19, Tailwind CSS | `app/page.tsx`<br>`components/*.tsx` | Accessible intake form, consent validation, live progress polling, and high-contrast coaching reports. |
| **Demo Showcase** | React 19 Client Components | `app/demo/page.tsx` | Instant, zero-dependency exploration using pre-calibrated synthetic fixtures. |
| **API Gateway** | Next.js Route Handlers, Zod | `app/api/assessments/*`<br>`lib/contracts/*` | Streaming file intake, MIME signature verification, token authorization, and job cancellation. |
| **Database** | PostgreSQL 16, Prisma ORM | `prisma/schema.prisma`<br>`lib/db/client.ts` | Durable job tracking, state leases, heartbeat events, and persisted report snapshots. |
| **Worker Daemon** | Node.js, TypeScript | `scripts/assessment-worker.ts` | Decoupled background queue processor with lease renewal and orphan cleanup. |
| **Media Pipeline** | Python 3.12+, FFmpeg, whisper.cpp | `worker/src/humaniti_worker/*` | Audio extraction (16kHz PCM), silence detection, keyframe sampling, and offline transcription. |
| **Scoring Engine** | Strict TypeScript | `lib/domain/rubric.ts`<br>`lib/domain/evidence.ts` | Provenance verification, weighted dimension score calculation, and 4-tier grade assignment. |

---

## Pedagogical Rubric & Classification

Humaniti AI calculates instructional quality across five weighted dimensions defined in [docs/RUBRIC.md](docs/RUBRIC.md):

| Dimension Key | Dimension Name | Weight | Primary Observable Evidence |
|---|---|:---:|---|
| `clarity_accuracy` | **Conceptual Clarity & Factual Accuracy** | **25%** | Explanations, accurate subject matter, scaffolding, responsive handling of student misconceptions. |
| `interaction_responsiveness` | **Learner Interaction & Responsiveness** | **25%** | Teacher questioning, student participation, wait time, dialogic feedback loops. |
| `lesson_structure` | **Lesson Structure & Progression** | **20%** | Clear objectives, sequence, logical scaffolding, transitions, recap, and purposeful closure. |
| `instructional_practice` | **Instructional Practice & Activity** | **20%** | Demonstration, modeling, guided practice, active student tasks, and timely feedback. |
| `technical_usability` | **Audio/Video Usability** | **10%** | Speech intelligibility and visual legibility. *(Deliberately capped at 10% to prevent technical issues from skewing pedagogical rating).* |

### Discrete Label Thresholds

Composite scores are normalized over assessable dimensions:

$$\text{Composite Score} = 100 \times \frac{\sum (\text{weight} \times \frac{\text{score}}{4})}{\sum (\text{assessable weights})}$$

| Quality Tier | Composite Score Range | Description |
|---|:---:|---|
| **`Poor`** | `< 40.0` | Instruction exhibits severe conceptual inaccuracies, disorganization, or continuous blockage of student learning. |
| **`Average`** | `40.0 – 59.9` | Understandable and largely accurate delivery with a basic sequence, but limited student interaction or scaffolding. |
| **`Good`** | `60.0 – 79.9` | Clear, accurate instruction with coherent pacing, purposeful student interaction, and structured practice. |
| **`Excellent`** | `≥ 80.0` | Consistently exemplary instruction: highly responsive to misconceptions, dynamic dialogue, and rich active learning. |

---

## Quickstart Guide

### Prerequisites

| Dependency | Minimum Version | Installation / Verification |
|---|---|---|
| **Node.js** | `>= 20.x` | `node -v` |
| **npm** | `>= 10.x` | `npm -v` |
| **Python** | `3.12` to `3.14` | `python3 --version` |
| **FFmpeg** | `>= 6.x` | `ffmpeg -version` and `ffprobe -version` |
| **PostgreSQL** | `16.x` | Native install or Docker / Docker Compose |

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/humaniti-ai/humaniti-ai.git
cd humaniti-ai

# Install Node dependencies
npm ci
```

### 2. Configure Environment Variables

```bash
cp .env.example .env.local
```

Configure `.env.local` with your database connection and generate a random 32+ character access token:

```dotenv
DATABASE_URL="postgresql://humaniti@127.0.0.1:5432/humaniti_ai?schema=public"
ASSESSMENT_PROVIDER="blocked"
APP_ORIGIN="http://localhost:3000"
PRIVATE_MEDIA_ROOT="./.private/media"
MAX_UPLOAD_BYTES="2147483648"

# Generate a 32+ character random string for intake authorization:
ASSESSMENT_ACCESS_TOKEN="change-this-to-a-secure-32-char-random-token"
```

### 3. Start Database and Run Migrations

Start PostgreSQL via Docker Compose:

```bash
docker compose up -d
```

Generate Prisma client types and apply schema migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Prepare the Python Media Worker

Create a dedicated virtual environment for the media extraction engine:

```bash
python3 -m venv worker/.venv
worker/.venv/bin/python -m pip install --upgrade pip
worker/.venv/bin/python -m pip install -e 'worker[test]'

# Verify worker environment
npm run worker:smoke
```

### 5. Run the Application

#### Terminal 1: Start Next.js Web App

```bash
# Development mode
npm run dev

# Or production mode
npm run build
npm run start -- -H 127.0.0.1 -p 3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Terminal 2: Run Background Assessment Worker

```bash
# Build the TypeScript worker bundle
npm run worker:build

# Start the continuous worker loop
node --env-file=.env.local .worker-build/scripts/assessment-worker.js
```

---

## Zero-Dependency Demo Mode

Want to test the user interface, scoring visualizer, and coaching reports without spinning up PostgreSQL, FFmpeg, or AI models?

Navigate to **[http://localhost:3000/demo](http://localhost:3000/demo)**.

Demo mode provides pre-compiled synthetic classroom scenarios:
- 🟢 **Math Fractions (Good - 74.2%)**: Clear demonstration of fraction equivalence with active student responses.
- 🟡 **Physics Momentum (Average - 54.0%)**: Accurate content delivery with limited student dialogue and pacing gaps.
- 🔵 **Literature Discussion (Excellent - 88.5%)**: High-order questioning, student debate, and exemplary scaffolding.
- ⚪ **Inconclusive Audio (Withheld Label)**: Realistic demonstration of the `insufficient_evidence` fail-safe when audio intelligibility is compromised.

---

## API Reference

All assessment mutations require the configured `Authorization: Bearer <ASSESSMENT_ACCESS_TOKEN>` header.

### Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/assessments` | Stream classroom video file for assessment intake. |
| `GET` | `/api/assessments/:id` | Poll job processing status (`queued`, `processing`, `completed`, `failed`). |
| `GET` | `/api/assessments/:id/report` | Retrieve completed coaching report with score breakdown and citations. |
| `PATCH` | `/api/assessments/:id` | Cancel a queued or active assessment job (`{ "action": "cancel" }`). |
| `GET` | `/api/health` | Healthcheck verifying database connectivity and storage roots. |

### Sample Intake Request

```bash
curl -X POST http://127.0.0.1:3000/api/assessments \
  -H "Authorization: Bearer dev-token-must-be-at-least-32-chars-long" \
  -H "Content-Type: video/mp4" \
  -H "X-Recording-Consent: true" \
  -H "Idempotency-Key: upload-lesson-20261023-01" \
  --data-binary "@/path/to/classroom-recording.mp4"
```

### Sample Report Response

```json
{
  "jobId": "cm3a4b9c0001...",
  "status": "completed",
  "overallLabel": "Good",
  "compositeScore": 74.2,
  "confidenceScore": 0.88,
  "dimensions": [
    {
      "key": "clarity_accuracy",
      "score": 3,
      "weight": 0.25,
      "status": "assessed",
      "summary": "Teacher clearly demonstrated fraction equivalence using visual area models.",
      "evidenceItemIds": ["ev-clarity-01"]
    }
  ],
  "evidence": [
    {
      "id": "ev-clarity-01",
      "modality": "transcript",
      "startSec": 142.5,
      "endSec": 158.0,
      "directQuote": "Notice how folding the paper in half twice gives us four equal quarters.",
      "claim": "Teacher provided concrete geometric demonstration of fraction division."
    }
  ],
  "recommendations": [
    "Increase student response wait time from 2 seconds to 5 seconds during concept introduction."
  ]
}
```

---

## Testing & Quality Verification

Humaniti AI maintains strict validation gates. You can execute the entire suite locally:

```bash
# 1. Typecheck TypeScript across client, server, and worker
npm run typecheck

# 2. Lint JavaScript, TypeScript, and JSX
npm run lint

# 3. Execute Vitest suite (Domain, contracts, UI, and integration)
npm test

# 4. Execute Python pytest suite (Media extraction, FFmpeg, Whisper)
npm run worker:test

# 5. Validate Prisma schema integrity
npm run prisma:validate

# 6. Verify production builds
npm run build
npm run worker:build

# 7. Run synthetic benchmark evaluation
python3 scripts/evaluate.py tests/fixtures/evaluation.synthetic.json
```

---

## Inference Providers & Local Execution

Humaniti AI supports three provider modes configured via `ASSESSMENT_PROVIDER`:

1. **`blocked` (Default)**:
   - Forbids all network and external inference requests.
   - Emits structured diagnostic states and protects against accidental cloud data transfer.
2. **`local` (Offline CLI)**:
   - Invokes local [Ollama](https://ollama.com/) models (e.g. `qwen3:4b`) bound strictly to `127.0.0.1:11434`.
   - Transcribes speech via local [whisper.cpp](https://github.com/ggerganov/whisper.cpp) binaries.
   - Cloud model tags and external network requests are actively rejected.
3. **`mock` (Testing Only)**:
   - Returns deterministic fixture reports for integration testing. Clearly marked as mock data; rejected in production environments.

For security guidelines and provider constraints, refer to [docs/PROVIDER_POLICY.md](docs/PROVIDER_POLICY.md).

---

## Ethical Disclaimer & Intended Use

> [!IMPORTANT]
> **Humaniti AI is a teacher coaching and professional development decision-support tool. It is NOT an autonomous personnel evaluation or high-stakes employment decision system.**

1. **Human-in-the-Loop Requirement**:
   Automated instructional feedback must always be reviewed by qualified instructional leaders, peer mentors, or the educators themselves. It must never be used as the sole basis for teacher hiring, tenure, compensation, or disciplinary action.
2. **Pedagogical Calibration**:
   The rubric anchors and weights in Rubric v0.1 represent a baseline operational hypothesis. They must be calibrated and validated against local curricular standards, grade levels, and language contexts before operational deployment.
3. **Participant Privacy**:
   Recording classroom activity requires affirmative consent from educators, students, and legal guardians in compliance with COPPA, FERPA, GDPR, and local privacy regulations.

---

## Contributing & Community

We welcome contributions! Please review our community documentation before submitting code:
- **[Code of Conduct](CODE_OF_CONDUCT.md)**: Our commitment to a welcoming, respectful, and harassment-free community.
- **[Contributing Guidelines](CONTRIBUTING.md)**: Development setup, commit conventions, architecture patterns, and pull request verification.
- **[Security Policy](docs/SECURITY.md)**: Responsible disclosure instructions for security and privacy vulnerabilities.

---

## License

Humaniti AI is licensed under the [Apache License, Version 2.0](LICENSE).
You are free to use, modify, and distribute this software in accordance with the terms of the Apache 2.0 License.
