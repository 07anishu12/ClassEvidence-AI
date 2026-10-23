# Architecture: Target State Specification

**System:** Humaniti AI — Open-Source Classroom Assessment Platform  
**Target Release:** `v0.1.0-rc1` (Production-Grade Open-Source Candidate)  
**Security & Governance Target:** Self-hostable, zero PII leakage, verifiable provenance, resilient concurrent processing.

---

## 1. Target Goals & Architectural Objectives

1. **Deterministic Four-Label Assessment**:
   - Exact mapping: `Poor` (<40), `Average` (40–59.99), `Good` (60–79.99), `Excellent` (>=80).
   - Strict gating: Missing critical modalities or <70% assessable weight MUST trigger `insufficient_evidence` withholding rather than a false score.
2. **Robust Multi-Modal Evidence Integrity**:
   - Every observation linked to concrete, verifiable audio/video artifacts.
   - Exact timestamp validation; rejection of hallucinated or out-of-bounds citations.
3. **Enterprise-Grade Security & Privacy**:
   - Intranet & cloud metadata SSRF protection via strict IP and DNS resolution verification.
   - Role/token-based access control protecting all assessment endpoints.
   - Guaranteed automatic cleanup of temporary media in `.private/scratch/`.
   - Never commit or log student PII, faces, audio recordings, or transcripts.
4. **Resilient Background Execution**:
   - Distributed worker lease claiming with deterministic heartbeat renewal and stale lease reclamation.
   - Cross-platform process resource limits (Linux cgroups/rlimits, macOS Darwin fallback).
5. **Turnkey Self-Hosting & Open Source Standard**:
   - Reproducible Docker Compose for PostgreSQL.
   - Comprehensive CI with automated typecheck, linting, Vitest, Pytest, and build tests.
   - Permissive Apache 2.0 or MIT licensing with contributor guidelines and code of conduct.

---

## 2. Component Target Specifications

```
                       ┌───────────────────────────────┐
                       │      Web Client (Browser)     │
                       │   - Upload & URL Intake Form  │
                       │   - Status Poller & Visualizer│
                       │   - Interactive Report Viewer │
                       │   - Demo Mode Sandbox         │
                       └───────────────┬───────────────┘
                                       │ HTTPS / Auth Bearer
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          API Gateway & Security Layer                       │
│  - Bearer Token Auth Guard (`ASSESSMENT_ACCESS_TOKEN`)                      │
│  - Idempotency Interceptor (Deduplication via `idempotencyKey`)             │
│  - SSRF Guard (Hostname & DNS IP range filtering against loopback/metadata) │
│  - Streamed Intake & MIME Sniffer (Magic byte inspection)                   │
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │                               │
                       ▼                               ▼
        ┌─────────────────────────────┐  ┌─────────────────────────────┐
        │       PostgreSQL 16         │  │   Encrypted Private Storage │
        │  - AssessmentJob (Leases)   │  │  - .private/scratch (Temp)  │
        │  - JobEvent (Telemetry)     │  │  - .private/artifacts       │
        │  - AssessmentReport         │  │  - Scheduled Purge Worker   │
        │  - DimensionScore / Evidence│  └──────────────┬──────────────┘
        └──────────────▲──────────────┘                 │
                       │                                ▼
                       │ Atomic Lease Claim ┌─────────────────────────┐
        ┌──────────────┴──────────────┐     │  Python Media Worker    │
        │    Node.js Job Worker       ├────►│  - Audio 16kHz WAV Extr │
        │  - scripts/assessment-      │     │  - Keyframe Sampler     │
        │    worker.ts                │     │  - whisper.cpp ASR      │
        └──────────────┬──────────────┘     │  - Darwin/Linux Limits  │
                       │                    └───────────┬─────────────┘
                       ▼                                │
        ┌─────────────────────────────┐                 │
        │  Inference & Domain Engine  │◄────────────────┘
        │  - Local LLM via Subprocess │  Artifact Registry & Manifest
        │  - Evidence Grounding Engine│
        │  - Rubric v0.1 Calculation  │
        │  - Decision Support Envelope│
        └─────────────────────────────┘
```

---

## 3. Key Interface & Shared Contracts

### 3.1 Job State Transition Model
Deterministic, acyclic finite state machine:
```
  [ QUEUED ] ──────────► [ PROCESSING ] ──────────► [ COMPLETED ]
       │                      │
       │                      ▼
       └───────────────► [ FAILED ]
```
- Re-entry from `COMPLETED` or `FAILED` is strictly prohibited.
- `PROCESSING` jobs emit heartbeats every 15s. Leases expire after 60s.
- Stale jobs (unrenewed lease) are reclaimed by the worker with an incremented retry counter up to `MAX_RETRIES` (3).

### 3.2 Evidence & Grounding Contract
```typescript
interface GroundedObservation {
  id: string;
  dimensionId: 'clarity' | 'engagement' | 'structure' | 'support' | 'feedback';
  finding: string;
  polarity: 'positive' | 'negative' | 'neutral';
  evidence: {
    artifactId: string;
    modality: 'audio' | 'video' | 'transcript';
    startSec: number;
    endSec: number;
    sourceExcerpt: string;
  };
  provenance: {
    providerVersion: string;
    artifactHash: string;
  };
}
```

### 3.3 Four-Label Scoring Rubric
- Overall score: $\sum (\text{Dimension Score} \times \text{Weight})$
- Eligible only if assessable weight $\ge 70\%$ and core dimensions present.
- If ineligible: `label = null`, `status = "insufficient_evidence"`.

---

## 4. Workstream Target Deliverables

| Workstream | Key Output | Success Criteria |
|---|---|---|
| **A: Frontend** | Polished UI, demo sandbox, error states, accessibility | Accessible (WCAG AA), zero runtime errors, responsive layout |
| **B: Backend** | Idempotency, token auth, SSRF DNS pinning, report API | Tested idempotency, secure endpoints, comprehensive API docs |
| **C: AI Quality** | Rubric v0.1 calibration docs, grounding tests, mock harness | 100% referential grounding, explicit uncertainty handling |
| **D: Media Worker** | Cross-platform `process.py`, FFmpeg pipeline, cleanup | All 41 pytest tests PASS on macOS and Linux |
| **E: Database** | Clean migration verification, transactional consistency | Zero orphan records, automated test DB provisioning |
| **F: Security** | Vulnerability remediation, security posture report | Zero P0/P1 security defects, sanitized logging |
| **G: DevOps** | Docker Compose, GitHub Actions CI, setup guides | Automated CI pipeline passes build and test stages |
| **H: Open Source** | LICENSE (Apache 2.0), README, CONTRIBUTING, SECURITY | Turnkey clone-and-run developer experience |
