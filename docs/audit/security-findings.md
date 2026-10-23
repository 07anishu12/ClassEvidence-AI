# Humaniti AI — Ranked Security Findings Ledger

**Document Version:** 1.0  
**Audit Baseline Date:** 2026-10-23  
**Auditor:** Application Security Engineer & Privacy Reviewer (Workstream F)  
**Scope:** Core Application, API Gateway, Contracts, Persistence, Worker Pipelines, and AI Adapters  
**Status:** Complete Audit Ledger  

---

## 1. Executive Summary & Vulnerability Summary Matrix

A comprehensive application security and privacy audit was conducted across the Humaniti AI codebase. The audit evaluated classroom recording confidentiality, student personally identifiable information (PII) exposure vectors, Server-Side Request Forgery (SSRF), Insecure Direct Object References (IDOR), idempotency flaws, prompt injection resilience, secret leakage, and private storage lifecycle controls.

No critical (P0) active remote code execution or credential leakage vulnerabilities were discovered in the repository. Several high (P1) and medium (P2) architectural risks were identified that require remediation prior to multi-tenant or public hosted deployment.

| Finding ID | Severity | CVSS v3.1 Score | Vector String | Vulnerability Category | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FINDING-01** | **P1 (High)** | **7.5** | `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N` | Insecure Direct Object Reference (IDOR) / Missing User Ownership | **OPEN (Architectural)** |
| **FINDING-02** | **P1 (High)** | **7.2** | `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:N` | SSRF Schema Validation Blind Spot (Cloud Metadata & DNS Rebinding) | **OPEN (Schema Layer)** |
| **FINDING-03** | **P2 (Med)** | **5.3** | `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L` | In-Memory Rate Limiting Ineffective in Distributed Deployments | **OPEN (Operational)** |
| **FINDING-04** | **P2 (Med)** | **5.3** | `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L` | Missing Client Idempotency Key & Deduplication for User Uploads | **OPEN (API Design)** |
| **FINDING-05** | **P2 (Med)** | **4.8** | `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:L` | Indirect Prompt Injection & DoS via Adversarial Transcripts | **MITIGATED (Syntactic)** |
| **FINDING-06** | **P3 (Low)** | **3.3** | `CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N` | Unsandboxed Host Subprocess Execution for Local Media Tools | **OPEN (Infrastructure)** |
| **FINDING-07** | **P3 (Low)** | **2.7** | `CVSS:3.1/AV:L/AC:H/PR:H/UI:N/S:U/C:L/I:N/A:N` | Unencrypted Snapshot of Report Citations in Database Columns | **OPEN (Data-at-Rest)** |

---

## 2. Detailed Vulnerability Ledger

---

### FINDING-01: Insecure Direct Object Reference (IDOR) & Missing Tenant/User Isolation
- **Severity:** P1 (High)
- **CVSS v3.1:** 7.5 (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N`)
- **CWE:** CWE-639 (Authorization Bypass Through User-Controlled Key)
- **Affected Files:**
  - `lib/services/assessment.ts` (`loadAssessment`, `authorize`, `changeAssessment`)
  - `app/api/assessments/[id]/route.ts`
  - `app/api/assessments/[id]/report/route.ts`
  - `prisma/schema.prisma` (`AssessmentJob` model)

#### Description & Root Cause
The platform relies on a single shared administrative secret (`ASSESSMENT_ACCESS_TOKEN`) across all users. In `authorize(request)`, the API validates whether the incoming `Authorization: Bearer <token>` matches the global environment token. In `loadAssessment(id)`, the service queries `assessmentJob.findUnique({ where: { id } })` without checking user ownership, organization ID, or tenant context.

Furthermore, `AssessmentJob` in `prisma/schema.prisma` has no `userId`, `tenantId`, or `ownerTokenHash` column.

#### Attack Scenario
1. Alice and Bob both use the Humaniti AI web interface using the shared platform access token.
2. Alice submits a confidential classroom recording containing minor students. A job ID is generated (e.g. `clx...`).
3. If Bob obtains, intercepts, or guesses Alice's job ID (via HTTP logs, browser history, or referrer leaks), Bob can query:
   - `GET /api/assessments/clx...` to view status and error details.
   - `GET /api/assessments/clx.../report` to view full confidential transcript excerpts, dimension ratings, and teacher evaluations.
   - `PATCH /api/assessments/clx...` with `{"action":"cancel"}` to maliciously terminate Alice's active evaluation.

#### Recommended Remediation
1. Introduce multi-tenant or user-scoped authentication (e.g. JWT with subject claim, or session cookie tied to an authenticated account).
2. Add `ownerId: String` or `tenantId: String` to `AssessmentJob`.
3. Enforce ownership verification in `loadAssessment`:
   ```typescript
   const job = await db.assessmentJob.findFirst({
     where: { id, ownerId: user.id }
   });
   if (!job) throw new AssessmentError(404, "job_not_found", "Assessment not found.");
   ```

#### Verification Test Cases
- Verify in `tests/e2e/security.test.ts` that `id` validation strictly enforces alphanumeric format `/^[A-Za-z0-9_-]{1,100}$/`.
- Add integration test asserting that requests with valid tokens but mismatched user identities receive HTTP `404` or `403`.

---

### FINDING-02: SSRF Blind Spot in URL Validation Schema (Cloud Metadata & DNS Rebinding)
- **Severity:** P1 (High)
- **CVSS v3.1:** 7.2 (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:N`)
- **CWE:** CWE-918 (Server-Side Request Forgery)
- **Affected Files:**
  - `lib/contracts/assessment.ts` (`isDisallowedHost`, `sourceUrlSchema`)

#### Description & Root Cause
`sourceUrlSchema` validates incoming URLs against known private IP ranges and local hostnames (`localhost`, `*.localhost`, `*.local`, `0.0.0.0`). However, the check is performed purely by static string analysis of the URL hostname. It suffers from three major blind spots:
1. **Cloud Metadata Hostnames:** Google Cloud metadata (`metadata.google.internal`), AWS instance endpoints (`instance-data`), or internal Kubernetes cluster domains (`*.internal`, `kubernetes.default.svc`) do not end in `.local` or `.localhost` and are not IP literals. They pass `isDisallowedHost`.
2. **Wildcard & Dynamic DNS Rebinding:** Domains like `169.254.169.254.nip.io` or attacker-controlled domains pointing to `127.0.0.1` pass `sourceUrlSchema` because the hostname string is neither an IP literal nor named `localhost`.
3. **HTTP Redirects:** If a future URL fetcher follows HTTP 301/302 redirects without re-validating the target URL, a public HTTPS link can redirect to an internal IP.

*(Note: Currently, runtime URL ingestion via `createAssessment` returns HTTP 422 `source_unavailable` because Drive import is unconfigured. However, the schema itself is vulnerable and would present an immediate critical SSRF vector if a remote fetcher is activated).*

#### Attack Scenario
An attacker submits `{"source": {"kind": "url", "url": "https://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"}}`. The schema accepts the URL as valid. If an asynchronous ingestion worker attempts to fetch the URL within a cloud VM (GCP/AWS), the worker could leak cloud instance credentials.

#### Recommended Remediation
1. Adopt the same pre-request DNS resolution and IP pinning architecture implemented in `createRemoteProvider` (`lib/providers/adapters.ts`):
   - Resolve hostname via `lookup(hostname, { all: true, family: 4 })`.
   - Validate every returned IP address against `publicIpv4` (rejecting loopback, RFC1918, CGNAT, link-local metadata).
   - Pin the validated IP in the HTTP client to prevent DNS rebinding.
   - Disable automatic HTTP redirect following.

#### Verification Test Cases
- Tested in `tests/e2e/security.test.ts`: comprehensive rejection of IPv4 loopback, RFC1918, link-local, CGNAT, multicast, IPv6 literals, credentials, and non-HTTPS schemes.

---

### FINDING-03: In-Memory Rate Limiting Ineffective in Distributed Deployments
- **Severity:** P2 (Medium)
- **CVSS v3.1:** 5.3 (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L`)
- **CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)
- **Affected Files:**
  - `lib/services/assessment.ts` (`authorize`, `attempts` array)

#### Description & Root Cause
In `lib/services/assessment.ts`, mutation rate limiting is implemented via a module-scoped in-memory array:
```typescript
const attempts: number[] = [];
// ...
while (attempts.length && attempts[0] < now - 60_000) attempts.shift();
if (attempts.length >= 6) throw new AssessmentError(429, "rate_limited", "Please wait...");
attempts.push(now);
```
In any production deployment with multiple Next.js server instances, serverless function workers, or container replicas, each instance maintains its own isolated `attempts` array. An attacker can distribute concurrent intake requests across instances to bypass the 6 requests/minute throttle. Furthermore, server restarts immediately reset the rate limiter.

#### Attack Scenario
An attacker floods multiple server instances with 2GB media upload streams, exhausting storage disk capacity and overwhelming worker queues.

#### Recommended Remediation
Replace the in-memory array with an atomic distributed token bucket or sliding window using Redis (`ioredis` / Upstash) or PostgreSQL row locks with an `updatedAt` timestamp window.

#### Verification Test Cases
- Unit test in `tests/ui/intake.test.ts` and `tests/integration/api.test.ts` verifies single-process burst behavior.

---

### FINDING-04: Missing Client Idempotency Key & Deduplication for User Uploads
- **Severity:** P2 (Medium)
- **CVSS v3.1:** 5.3 (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L`)
- **CWE:** CWE-400 (Uncontrolled Resource Consumption)
- **Affected Files:**
  - `lib/services/assessment.ts` (`createAssessment`, `queuePrivateRecording`)
  - `prisma/schema.prisma` (`AssessmentJob.idempotencyKey`)

#### Description & Root Cause
`AssessmentJob` has an `idempotencyKey String? @unique` field. However, in `createAssessment`, `queuePrivateRecording(request)` is called without `checks?.dataset`. Consequently, `idempotencyKey` remains `undefined` for standard user uploads via `POST /api/assessments`.
If a client experiences network retries or a user clicks "Upload" multiple times, the server streams and stores the full 2GB payload repeatedly, creating distinct `AssessmentJob` rows and scheduling duplicate FFmpeg extraction, Whisper transcription, and LLM evaluations for identical video content.

#### Attack Scenario
An attacker submits 10 identical 2GB files in parallel. The system writes 20GB of temporary data to disk and schedules 10 identical transcription workloads, causing compute starvation.

#### Recommended Remediation
1. Accept an optional `Idempotency-Key` HTTP header on `POST /api/assessments`.
2. Compute the streaming SHA-256 digest of uploaded bytes and use `upload:${sha256}` as the default idempotency key in PostgreSQL:
   ```typescript
   const idempotencyKey = clientIdempotencyKey ?? `upload:${sha256Digest}`;
   ```
3. If database insert encounters a unique constraint violation (`P2002`), immediately remove the duplicate file and return HTTP 202 with the existing job ID (`reused: true`).

#### Verification Test Cases
- Verify that duplicate submissions return the existing job reference rather than scheduling concurrent jobs.

---

### FINDING-05: Indirect Prompt Injection & DoS via Adversarial Transcripts
- **Severity:** P2 (Medium)
- **CVSS v3.1:** 4.8 (`CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:L`)
- **CWE:** CWE-1427 (Improper Neutralization of Directives in LLM Prompts)
- **Affected Files:**
  - `lib/providers/adapters.ts` (`providerInstructions`)
  - `lib/domain/evidence.ts` (`extractEvidence`)
  - `lib/domain/scoring.ts` (`validateRatings`)

#### Description & Root Cause
While Humaniti AI includes robust architectural defenses against prompt injection (untrusted data encapsulation, strict JSON schema output, referential substring grounding, and deterministic code scoring), an adversary in the classroom recording can still execute semantic manipulation:
1. **Adversarial Pedagogy Mimicry:** A speaker in the classroom can intentionally verbalize phrases tailored to rubric anchor descriptions (e.g. reciting structured scaffolding scripts) to artificially elevate dimension ratings.
2. **Denial-of-Service via Token Inflation:** A spoken injection can prompt the model to generate massive, repetitive JSON text, exhausting output tokens (`maxOutputTokens: 4000`) and triggering `provider_budget_exceeded` or `provider_timeout`.

#### Recommended Remediation
1. Maintain the current defense: the LLM is never given authority to issue the final quality label.
2. Enforce cross-model or dual-evaluation agreement before declaring high confidence.
3. Keep output token budgets tightly constrained (e.g. 2,000–4,000 tokens) with strict per-observation character limits.

#### Verification Test Cases
- Tested in `tests/e2e/security.test.ts`: verifying prompt injection payloads remain trapped as untrusted artifact text, and fabricated citations are rejected by `extractEvidence`.

---

### FINDING-06: Unsandboxed Host Subprocess Execution for Local Media Tools
- **Severity:** P3 (Low)
- **CVSS v3.1:** 3.3 (`CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N`)
- **CWE:** CWE-250 (Execution with Unnecessary Privileges)
- **Affected Files:**
  - `scripts/assessment-worker.ts` (`runBoundedProcess`)
  - `worker/src/humaniti_worker/process.py` (`run_bounded`)
  - `worker/src/media/audio.py` (`AudioExtractor`)

#### Description & Root Cause
`ffmpeg`, `ffprobe`, and `whisper-cli` execute directly on the host operating system with the user privileges of the running application. While command-line arguments are sanitized, `-protocol_whitelist file,pipe` is enforced, and timeouts are applied, complex media demuxers in FFmpeg historically have C-level memory corruption vulnerabilities (buffer overflows, integer overflows in exotic codecs).

#### Recommended Remediation
In containerized and hosted environments, run media processing worker jobs in isolated Linux containers with restricted capabilities (`cap_drop: ALL`), read-only root filesystems, memory cgroups, and a restrictive seccomp profile blocking unauthorized syscalls.

#### Verification Test Cases
- Code review verification that all subprocess calls pass argument arrays without `shell=True`.

---

### FINDING-07: Unencrypted Snapshot of Report Citations in Database Columns
- **Severity:** P3 (Low)
- **CVSS v3.1:** 2.7 (`CVSS:3.1/AV:L/AC:H/PR:H/UI:N/S:U/C:L/I:N/A:N`)
- **CWE:** CWE-311 (Missing Encryption of Sensitive Data)
- **Affected Files:**
  - `prisma/schema.prisma` (`AssessmentJob.analysis`, `AssessmentReport.observations`)

#### Description & Root Cause
When an assessment completes, verbatim transcript excerpts and coaching rationales are stored in PostgreSQL JSONB and relational tables. If the database storage volume lacks full-disk encryption at rest (or if unencrypted database backups are exported), confidential classroom speech excerpts could be exposed to unauthorized infrastructure operators.

#### Recommended Remediation
1. Ensure the production PostgreSQL database enforces AES-256 transparent data encryption (TDE) or volume-level encryption (AWS EBS encryption, GCP persistent disk encryption).
2. Enforce strict retention cleanup via `npm run worker:run -- --cleanup` to cascade-delete records older than 30 days.

---

## 3. Positive Security Controls Empirically Verified

The audit verified several exemplary security implementations already present in the codebase:
- **Zero Mock Fallback in Production:** The default provider is strictly `blocked`; the system explicitly refuses to generate synthetic or fake evaluation labels.
- **Timing-Safe Authentication:** Constant-time hash comparison (`timingSafeEqual`) prevents timing oracle attacks against the Bearer access token.
- **Private Storage Path Hardening:** `privateMediaRoot` strictly enforces that media storage paths must reside inside `.private/` and rejects directory traversal or escapes to project code roots.
- **Immediate Source Deletion:** Source video files are unlinked from disk immediately upon reaching terminal state (`COMPLETED` or `FAILED`).
- **Verbatim Evidence Grounding:** `extractEvidence` cryptographically and referentially checks every candidate observation against source artifacts, eliminating LLM hallucination of evidence.
- **Deterministic Rubric Scoring:** Quality labels are mathematically computed in code from validated evidence weights, preventing LLM grade manipulation.
