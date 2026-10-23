# Changelog

All notable changes to **Humaniti AI** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Audio-visual synchrony validation for multi-camera classroom recordings.
- Support for multilingual classroom transcripts with localized pedagogical rubrics.
- Presigned object storage integration (S3/GCS) with automated KMS envelope encryption for large enterprise deployments.

---

## [0.1.0-rc1] - 2026-10-23

### Added

#### Web Application & User Experience
- **Next.js 16 App Router Frontend**: Full-stack application featuring server-rendered layouts, responsive desktop and mobile UI, and high-contrast color palette compliant with WCAG 2.1 AA standards.
- **Intake Form & Consent Gate**: Drag-and-drop recording upload supporting `.mp4`, `.mov`, and `.webm` formats with explicit participant privacy consent confirmation (`X-Recording-Consent`).
- **Interactive Coaching Report Viewer**: Detailed pedagogical breakdown with score visualizations, dimension cards, verifiable quote accordions, actionable recommendations, and explicit technical limitations banners.
- **Real-Time Job Polling & Cancellation**: Asynchronous job tracker displaying progress states (`queued`, `processing`, `completed`, `failed`) with client-side cancellation controls.
- **Zero-Dependency Demo Mode (`/demo`)**: Standalone interactive showcase pre-populated with synthetic classroom scenarios (Math Fractions, Physics Momentum, Literature Discussion, and Inconclusive Audio) running entirely in browser memory without requiring external services, databases, or GPUs.

#### Assessment & Domain Scoring Engine
- **Deterministic 4-Label Classification**: Strictly maps composite pedagogical scores to one of four transparent labels:
  - `Poor` (composite score < 40.0)
  - `Average` (40.0 ≤ composite score < 60.0)
  - `Good` (60.0 ≤ composite score < 80.0)
  - `Excellent` (composite score ≥ 80.0)
- **5-Dimension Weighted Rubric v0.1**:
  - `clarity_accuracy` (25% weight): Conceptual clarity and factual accuracy.
  - `interaction_responsiveness` (25% weight): Learner interaction, wait time, and feedback loops.
  - `lesson_structure` (20% weight): Scaffolding, progression, and lesson transitions.
  - `instructional_practice` (20% weight): Modeling, guided practice, and student activity.
  - `technical_usability` (10% weight): Audio intelligibility and visual legibility (strictly capped to prevent technical artifacts from dominating pedagogical scoring).
- **Strict Evidence Grounding Engine (`lib/domain/evidence.ts`)**: Every observation is validated against the session manifest, requiring stable evidence IDs, start/end timestamps, modality flags, and exact unmanipulated quote provenance.
- **Insufficient Evidence Fail-Safe**: When essential rubric dimensions are unobservable or total assessable weight drops below 70%, the system withholds a grade and emits `insufficient_evidence` instead of scoring missing data as zero.
- **Anti-Bias Safeguards**: Explicitly forbids using accents, speaker demographics, facial expressions, perceived happiness, or network jitter as evaluation proxies.

#### Background Media Processing & Workers
- **Decoupled Background Worker (`scripts/assessment-worker.ts`)**: Asynchronous durable worker executing outside request cycles, using PostgreSQL row locks and heartbeat leases to prevent stale execution or double-processing.
- **Python Media Extraction Pipeline (`worker/src/humaniti_worker`)**: Subprocess orchestrator managing:
  - FFmpeg 16kHz mono PCM audio conversion and segment extraction.
  - RMS volume and silence interval detection.
  - Keyframe extraction at scene boundaries under private staging storage.
  - Offline local transcription using whisper.cpp.
- **Post-Processing Scratch Scrubbing**: Automatic deletion of ephemeral audio and video files immediately upon job completion or termination.

#### Backend Gateway & Infrastructure
- **REST API Endpoints**:
  - `POST /api/assessments`: Streamed video intake with magic byte MIME inspection and size limits.
  - `GET /api/assessments/:id`: Safe polling status endpoint.
  - `GET /api/assessments/:id/report`: Verifiable coaching report snapshot.
  - `PATCH /api/assessments/:id`: Graceful job cancellation handler.
  - `GET /api/health`: Database and storage health check endpoint.
- **Database Schema (Prisma ORM)**: PostgreSQL persistence with tables for `AssessmentJob`, `JobEvent`, `AssessmentReport`, `DimensionScore`, and `EvidenceItem`.
- **Docker Compose Setup**: Loopback-bound local PostgreSQL 16 container definition for streamlined local development.

### Changed
- Refactored API routes to enforce strict Zod schema validation across all request parameters and response bodies.
- Updated database queries to use atomic transactions for job lease acquisition and terminal status transitions.
- Standardized logging to prevent leakage of source media paths, transcript text, or authentication tokens.

### Fixed
- **macOS Resource Limit Crash**: Fixed `RLIMIT_AS` address space limit failures on macOS Darwin systems during media extraction subprocess execution.
- **Intake Idempotency**: Added duplicate detection using client-provided idempotency keys to eliminate redundant job spawning.
- **Authorization Coverage**: Applied mandatory bearer token verification across all assessment endpoints when `ASSESSMENT_ACCESS_TOKEN` is configured.
- **SSRF Protection**: Added strict hostname and subnet checks to reject loopback addresses, local network IPs, and cloud metadata endpoints (`169.254.169.254`).

### Security
- **Blocked-by-Default Provider Policy**: External cloud LLM calls are disabled by default; local models require explicit opt-in and bound loopback configurations.
- **Safe Logging Invariants**: Structured loggers enforce redaction of child names, speech text, API tokens, and private storage paths.
- **Zero-Storage PII Architecture**: Video files are processed strictly in `.private/` staging paths and deleted immediately after feature extraction.

---

[Unreleased]: https://github.com/humaniti-ai/humaniti-ai/compare/v0.1.0-rc1...HEAD
[0.1.0-rc1]: https://github.com/humaniti-ai/humaniti-ai/releases/tag/v0.1.0-rc1
