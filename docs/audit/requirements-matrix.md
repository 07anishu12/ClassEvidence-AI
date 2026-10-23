# Humaniti AI — Requirements Traceability Matrix

**Project:** Humaniti AI — Classroom Video Assessment Platform  
**Audit Baseline Date:** 2026-10-23  
**Target Release:** Open-Source Release Candidate v0.1.0-rc1  

---

## 1. Traceability Matrix

| ID | Requirement Area | Specification & Invariants | Baseline Status | Target Gate | Workstream Owner |
|---|---|---|---|---|---|
| **REQ-01** | **Video Intake** | Accept video via direct file upload (drag & drop) or validated HTTPS URL. Max 500MB, format mp4/webm. | **PASS (Local)** | Form & API tested; MIME sniffer verified. | Workstream A / B |
| **REQ-02** | **Four-Label Classification** | Assign exactly one of `Poor`, `Average`, `Good`, or `Excellent` based on weighted composite score. | **PASS (Domain)** | Deterministic thresholds: <40, 40-59.99, 60-79.99, >=80. | Workstream C |
| **REQ-03** | **Timestamped Evidence** | Every observation must cite valid artifact ID, modality (`audio`, `video`, `transcript`), and start/end time. | **PASS (Domain)** | Grounding engine validates all references against session manifest. | Workstream C |
| **REQ-04** | **No Hallucinated Claims** | Missing modalities or ambiguous evidence must result in `not_assessable` or withheld grade (`insufficient_evidence`). | **PASS (Domain)** | Verified in domain tests; never scores missing data as 0. | Workstream C |
| **REQ-05** | **Privacy & PII Protection** | Zero child PII, names, faces, or raw video stored in git, logs, or public buckets. | **PASS (Audit)** | Strict `.gitignore`, scratch folder in `.private/`, safe logging. | Workstream F |
| **REQ-06** | **SSRF & Network Safety** | Reject private IPs, cloud metadata IPs (`169.254.169.254`), localhost, credentials in URLs. | **PARTIAL** | Regex check exists; needs DNS resolution check before fetch. | Workstream B / F |
| **REQ-07** | **Job State Durability** | Asynchronous execution via PostgreSQL jobs; persist state across page refresh or worker restart. | **PASS (DB/Worker)** | Atomic lease claim, heartbeat events, durable status retrieval. | Workstream B / E |
| **REQ-08** | **Idempotent Submission** | Duplicate POST requests with identical `idempotencyKey` must not spawn redundant jobs. | **DEFECT** | Schema has key; API does not check existing jobs by key. | Workstream B |
| **REQ-09** | **Access Control** | Endpoints protected by bearer token when `ASSESSMENT_ACCESS_TOKEN` is set. | **PARTIAL** | Protected on `POST`; missing on `GET /api/assessments/[id]`. | Workstream B / F |
| **REQ-10** | **Media Worker Pipeline** | Extract 16kHz mono audio, sample keyframes, transcribe speech with bounded timeouts and cleanup. | **PARTIAL** | Core logic implemented; macOS `RLIMIT_AS` error causes 5 test failures. | Workstream D |
| **REQ-11** | **Accessible UI & UX** | WCAG 2.1 AA compliant, responsive layout, clear loading, error, and coaching reports. | **PASS (UI)** | Render tests pass, mobile responsive, high-contrast theme. | Workstream A |
| **REQ-12** | **Demo Showcase Mode** | Self-contained demo route (`/demo`) with synthetic fixtures for instant evaluation without GPU. | **PASS (Demo)** | Dedicated demo page runs without database or local models. | Workstream A |
| **REQ-13** | **Open Source Hygiene** | Standard LICENSE, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY. | **MISSING** | Missing LICENSE, CONTRIBUTING, and release guidelines. | Workstream H |
| **REQ-14** | **CI / CD Pipeline** | Automated CI workflow verifying typecheck, lint, Vitest, Pytest, and build. | **MISSING** | No `.github/workflows/ci.yml` exists. | Workstream G |
| **REQ-15** | **Self-Hosting Docs** | Clear instructions to spin up database, run migrations, start worker, and launch Next.js. | **PARTIAL** | Documentation scattered across handoff files; needs unified guide. | Workstream G |

---

## 2. Priority Classifications

- **P0 (Critical Blocker)**:
  - macOS Darwin `RLIMIT_AS` crash in `process.py` causing 5 media test failures (REQ-10).
  - Open GET endpoint without bearer token validation when token auth is enabled (REQ-09).
- **P1 (High Priority Core Requirements)**:
  - Idempotency enforcement in `POST /api/assessments` (REQ-08).
  - DNS resolution pinning to prevent DNS-rebinding SSRF (REQ-06).
  - Missing Open-Source assets: LICENSE, README, CONTRIBUTING, CI workflow (REQ-13, REQ-14).
- **P2 (Medium Priority Polish)**:
  - Consolidated self-hosting guide `docs/deployment/self-hosting.md` (REQ-15).
  - Complete end-to-end integration test harness.
- **P3 (Low Priority Enhancements)**:
  - Styling refinements and micro-interactions in report view.
