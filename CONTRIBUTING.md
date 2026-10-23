# Contributing to Humaniti AI

Thank you for your interest in contributing to **Humaniti AI**! We welcome contributions from educators, researchers, software engineers, and open-source advocates passionate about building ethical, grounded, and privacy-preserving artificial intelligence tools for educational support.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Core Invariants & Ethical Commitments](#core-invariants--ethical-commitments)
- [Architecture & Repository Layout](#architecture--repository-layout)
- [Development Environment Setup](#development-environment-setup)
  - [Prerequisites](#prerequisites)
  - [1. Clone and Install Dependencies](#1-clone-and-install-dependencies)
  - [2. Configure Environment Variables](#2-configure-environment-variables)
  - [3. Start PostgreSQL Database](#3-start-postgresql-database)
  - [4. Apply Database Migrations](#4-apply-database-migrations)
  - [5. Set Up the Python Media Worker](#5-set-up-the-python-media-worker)
- [Running the Application](#running-the-application)
  - [Next.js Web Application](#nextjs-web-application)
  - [Asynchronous Background Worker](#asynchronous-background-worker)
  - [Zero-Dependency Demo Mode](#zero-dependency-demo-mode)
- [Testing & Quality Verification](#testing--quality-verification)
- [Contribution Workflow](#contribution-workflow)
  - [Git Branch Naming](#git-branch-naming)
  - [Conventional Commits](#conventional-commits)
  - [Submitting a Pull Request](#submitting-a-pull-request)
  - [PR Verification Checklist](#pr-verification-checklist)
- [Security and Responsible Disclosure](#security-and-responsible-disclosure)

---

## Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md) (Contributor Covenant v2.1). Please review it to understand our community standards and reporting procedures.

---

## Core Invariants & Ethical Commitments

Humaniti AI is governed by strict technical and ethical constraints designed to protect learners and educators. Any contribution must respect these invariants:

1. **Evidence Grounding Over Speculation**:
   - The platform never fabricates or hallucinates pedagogical quality scores.
   - Every observation must have provenance: a stable evidence ID, start/end seconds within the recording, modality (`audio`, `video`, `transcript`, or `metadata`), and an unmanipulated excerpt or observable description.
2. **Missing Evidence is NOT Negative Evidence**:
   - If an audio segment is inaudible, video frames are sparse, or a modality is unavailable, the dimension must be marked `not_assessable` (`null`), never given a score of zero.
   - Zero scores require affirmative, substantiated evidence of pedagogical obstruction or severe factual inaccuracies.
3. **Four Discrete Pedagogical Labels**:
   - Quality is assessed strictly against four defined labels: `Poor` (< 40.0), `Average` (40.0–59.9), `Good` (60.0–79.9), and `Excellent` (>= 80.0).
   - If essential rubric dimensions are missing or assessable weight is below 70%, the system withholds a grade and returns `insufficient_evidence`.
4. **Child and Teacher Privacy by Design**:
   - No real student faces, voices, classroom video recordings, or identifying data may ever be committed to git, included in test fixtures, logged to stdout/stderr, or transmitted to unapproved third parties.
   - Synthetic fixtures (`evaluation.synthetic.json`) must be used for all automated tests and benchmarking.
5. **Anti-Bias & Excluded Proxies**:
   - Accents, speech cadence alone, physical appearance, emotional affect, lighting aesthetics, or student socio-economic indicators must never be used as proxies for instructional quality.
6. **Blocked-by-Default Inference Providers**:
   - External cloud AI provider requests are blocked by default. All semantic evaluation runs through locally hosted or verified offline models (such as whisper.cpp and Ollama).
7. **Architectural Separation**:
   - Maintain clear boundaries between UI components, API gateway validation, domain scoring logic, database persistence (Prisma), and Python media processing.

---

## Architecture & Repository Layout

```text
├── app/                  # Next.js App Router (UI routes & API endpoints)
│   ├── api/assessments/  # REST endpoints for intake, polling, cancellation, reports
│   ├── demo/             # Client-side synthetic demo page (zero external dependencies)
│   ├── layout.tsx        # Root HTML layout and font loading
│   └── page.tsx          # Main intake and live report view
├── components/           # Accessible, reusable UI components (React 19, Tailwind CSS)
│   ├── assessment-form.tsx
│   ├── assessment-report.tsx
│   ├── assessment-status.tsx
│   └── recording-intake.tsx
├── docs/                 # Architectural specifications, audits, rubrics, and handoffs
│   ├── architecture/     # Current and target system architecture
│   ├── audit/            # Quality matrices, baseline audits, test reports
│   ├── handoffs/         # Structured stage handoffs
│   ├── RUBRIC.md         # Pedagogical rubric specification and score anchors
│   └── SECURITY.md       # Threat model and vulnerability register
├── lib/                  # Core application libraries
│   ├── contracts/        # Zod validation schemas for requests, responses, and events
│   ├── domain/           # Pedagogical rubric scoring, evidence validation, and report building
│   ├── providers/        # AI inference adapters (Local CLI, Mock, Blocked)
│   └── services/         # Storage management and assessment orchestrator
├── prisma/               # Prisma ORM schema and PostgreSQL migrations
├── scripts/              # Utility scripts, durable workers, and evaluation CLI
│   ├── assessment-worker.ts # Durable background job processor
│   ├── evaluate.py       # Aggregate benchmarking runner
│   └── smoke-integration.mjs # Integration smoke test suite
├── tests/                # Automated test suites (Vitest & Playwright)
│   ├── contracts/        # API and domain schema validation tests
│   ├── domain/           # Rubric calculation, evidence verification tests
│   ├── e2e/              # Integration and end-to-end security tests
│   ├── fixtures/         # Strictly synthetic media and JSON manifests
│   ├── providers/        # Adapter contract tests
│   └── ui/               # Component rendering and accessibility tests
└── worker/               # Python media processing pipeline (FFmpeg, Whisper.cpp)
    ├── src/humaniti_worker/ # Audio extraction, frame sampling, ASR
    └── tests/            # Python pytest suite (41 media processing tests)
```

---

## Development Environment Setup

### Prerequisites

Ensure the following tools are installed on your workstation:
- **Node.js**: `v20.x` or later (LTS recommended; tested up to Node `v26.x`)
- **npm**: `v10.x` or later
- **Python**: `v3.12` to `v3.14`
- **FFmpeg & ffprobe**: `v6.x` or later (`ffmpeg -version` must succeed)
- **PostgreSQL**: `v16.x` (or Docker / Docker Compose to run PostgreSQL)
- *(Optional)* **whisper.cpp** and **Ollama** for offline local speech-to-text and reasoning.

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/humaniti-ai/humaniti-ai.git
cd humaniti-ai

# Install Node dependencies
npm ci
```

### 2. Configure Environment Variables

Copy the example configuration to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` to match your local setup:

```dotenv
DATABASE_URL="postgresql://humaniti@127.0.0.1:5432/humaniti_ai?schema=public"
ASSESSMENT_PROVIDER="blocked"
APP_ORIGIN="http://localhost:3000"
PRIVATE_MEDIA_ROOT="./.private/media"
MAX_UPLOAD_BYTES="2147483648"

# Generate a secure 32+ character token for intake authorization:
ASSESSMENT_ACCESS_TOKEN="dev-token-must-be-at-least-32-chars-long"

# Optional local offline model configuration:
# LOCAL_MODEL="qwen3:4b"
# WHISPER_MODEL_PATH="/path/to/ggml-model.bin"
```

> [!WARNING]
> Never commit `.env.local` or upload real credentials or tokens to version control.

### 3. Start PostgreSQL Database

You can run PostgreSQL via the included Docker Compose configuration:

```bash
docker compose up -d
```

This binds PostgreSQL to `127.0.0.1:5432` with user `humaniti` and database `humaniti_ai`.

### 4. Apply Database Migrations

Generate the Prisma client and apply database migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 5. Set Up the Python Media Worker

Create a Python virtual environment and install the media processing package in editable mode:

```bash
python3 -m venv worker/.venv
worker/.venv/bin/python -m pip install --upgrade pip
worker/.venv/bin/python -m pip install -e 'worker[test]'
```

Verify that the Python media worker smoke test passes:

```bash
npm run worker:smoke
```

---

## Running the Application

### Next.js Web Application

Start the development server:

```bash
npm run dev
```

Or build and run the production server:

```bash
npm run build
npm run start -- -H 127.0.0.1 -p 3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Asynchronous Background Worker

In a separate terminal, compile and run the background assessment worker:

```bash
# Compile TypeScript worker
npm run worker:build

# Run worker continuously
node --env-file=.env.local .worker-build/scripts/assessment-worker.js

# Or process a single queued job and exit
node --env-file=.env.local .worker-build/scripts/assessment-worker.js --once

# Run orphaned file and expired job cleanup
node --env-file=.env.local .worker-build/scripts/assessment-worker.js --cleanup
```

### Zero-Dependency Demo Mode

To evaluate the user interface and coaching reports without requiring PostgreSQL, FFmpeg, or AI models:

1. Start the web app (`npm run dev`).
2. Navigate to [http://localhost:3000/demo](http://localhost:3000/demo).
3. Switch between synthetic classroom presets:
   - **Math Fractions (Good - 74.2%)**: Clear conceptual demonstration, active student dialogue.
   - **Physics Momentum (Average - 54.0%)**: Solid subject matter, limited wait-time and student participation.
   - **Literature Discussion (Excellent - 88.5%)**: High engagement, inquiry-led scaffolding, strong evidence.
   - **Inconclusive Audio (Withheld Label)**: Demonstration of the `insufficient_evidence` fail-safe.

---

## Testing & Quality Verification

Before opening a pull request or submitting code changes, execute the full validation suite:

```bash
# 1. Typecheck TypeScript across application and worker
npm run typecheck

# 2. Lint JavaScript/TypeScript files
npm run lint

# 3. Run all Vitest contract, domain, UI, and integration tests
npm test

# 4. Run Python pytest suite for media extraction and worker logic
npm run worker:test

# 5. Validate Prisma schema consistency
npm run prisma:validate

# 6. Verify production build
npm run build
npm run worker:build

# 7. Run synthetic evaluation benchmark
python3 scripts/evaluate.py tests/fixtures/evaluation.synthetic.json
```

All checks must pass with zero errors and zero warnings.

---

## Contribution Workflow

### Git Branch Naming

Create a feature branch branching off `main`:

```bash
git checkout -b <type>/<short-description>
```

Branch naming prefixes:
- `feat/` for new features or capabilities
- `fix/` for bug fixes and defect remediations
- `docs/` for documentation updates
- `test/` for new test cases or fixture improvements
- `refactor/` for code refactoring with no behavioral change
- `chore/` for tooling, dependency, or configuration updates

### Conventional Commits

We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification:

```text
<type>(<scope>): <short description in present tense>

[optional body explaining motivation and changes]

[optional footer(s)]
```

Examples:
- `feat(rubric): add check for minimum assessable weight threshold`
- `fix(worker): handle macOS memory limit error in audio extraction`
- `docs(readme): add troubleshooting section for docker postgres`
- `test(contracts): add test cases for malformed evidence timestamp ranges`

### Submitting a Pull Request

1. Push your branch to your fork or origin:
   ```bash
   git push origin feat/your-feature-name
   ```
2. Open a Pull Request against the `main` branch.
3. Fill out the PR template completely, providing context, changes made, and validation command outputs.
4. Ensure all CI checks and automated workflows pass.

### PR Verification Checklist

Before requesting a review, verify:

- [ ] Changes adhere to the [Core Invariants](#core-invariants--ethical-commitments).
- [ ] No real student or teacher PII, faces, audio, or credentials are included in commits.
- [ ] TypeScript strict mode passes (`npm run typecheck`).
- [ ] Vitest test suite passes (`npm test`).
- [ ] Python pytest suite passes (`npm run worker:test`).
- [ ] Prisma schema is valid (`npm run prisma:validate`).
- [ ] Code builds cleanly for production (`npm run build` and `npm run worker:build`).
- [ ] New functionality includes corresponding unit and integration tests.
- [ ] Documentation is updated for any changed behavior, flags, or configuration options.

---

## Security and Responsible Disclosure

If you discover a security vulnerability or privacy flaw (such as unintentional data exposure, SSRF bypass, or path traversal), please do **not** open a public issue.

Follow the instructions in our [Security Policy](docs/SECURITY.md) or email [security@humaniti.ai](mailto:security@humaniti.ai).

---

## License

By contributing to Humaniti AI, you agree that your contributions will be licensed under the [Apache License, Version 2.0](LICENSE).
