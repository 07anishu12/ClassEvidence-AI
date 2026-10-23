# Workstream F Handoff — Application Security & Privacy Review

**Workstream:** Workstream F (Application Security Engineer & Privacy Reviewer)  
**Date:** 2026-10-23  
**Status:** Audit & Specification Complete — 73 Security Tests Verified  
**Primary Deliverables:**
- `docs/security-and-privacy.md` (Formal Security & Privacy Architecture Specification)
- `docs/audit/security-findings.md` (Ranked Vulnerability Ledger: P0/P1/P2/P3 with CVSS v3.1)
- `tests/e2e/security.test.ts` (Expanded Vitest Adversarial & Security Boundary Test Suite)
- `docs/handoffs/security.md` (Workstream Handoff & Release Verification Evidence)

---

## 1. Executive Summary & Audit Conclusions

Workstream F conducted a rigorous application security and privacy audit of Humaniti AI, covering classroom recording confidentiality, student PII protection, network ingestion and SSRF boundaries, object-level access controls (IDOR), idempotency mechanisms, prompt injection resilience, secret hygiene, and storage lifecycle management.

### Key Conclusions:
1. **Strong Architectural Foundations:** The platform implements exemplary defensive depth in multiple critical areas:
   - **Zero Silent Mock Fallbacks:** In production, unconfigured AI providers fail explicitly (`ProviderBlockedError`); fake or synthetic evaluation grades are never fabricated.
   - **Verbatim Evidence Grounding:** `extractEvidence` verifies literal substring inclusion, exact timestamp alignment, and modality matching against trusted source artifacts, preventing LLM hallucination of evidence.
   - **Deterministic Mathematical Scoring:** Quality labels (`Poor`, `Average`, `Good`, `Excellent`) are computed deterministically via weighted rubric algorithms; the LLM is prohibited from issuing the final overall evaluation label.
   - **Ephemeral Media Lifecycle:** Uploaded source recordings are immediately deleted from disk when an assessment reaches a terminal state (`COMPLETED` or `FAILED`). Scratch directories are removed in the worker `finally` block.
   - **Timing-Safe Auth Comparisons:** Secret token matching uses SHA-256 digests evaluated via `crypto.timingSafeEqual` with strict length bounding (≤ 256 bytes).
   - **Hardened Subprocess Invocation:** Media extraction tools enforce `-protocol_whitelist file,pipe`, parameter arrays without shell invocation, bounded timeouts, and process-group `SIGKILL` termination.
2. **Identified Production Blockers:** Two P1 (High) and two P2 (Medium) architectural risks require remediation prior to public or multi-tenant hosting:
   - **FINDING-01 (P1 / CVSS 7.5):** Insecure Direct Object Reference (IDOR) on `/api/assessments/[id]` due to a single shared access token and absence of tenant/user ownership columns.
   - **FINDING-02 (P1 / CVSS 7.2):** SSRF schema blind spot for cloud internal metadata hostnames (`metadata.google.internal`) and wildcard DNS services (`169.254.169.254.nip.io`). (Mitigated at runtime by Drive import block, but open in schema).
   - **FINDING-03 (P2 / CVSS 5.3):** In-memory mutation rate limiting (`attempts: number[]`) ineffective across distributed instances.
   - **FINDING-04 (P2 / CVSS 5.3):** Missing client-supplied `Idempotency-Key` and deduplication on standard user uploads.

---

## 2. Deliverables & Work Completed

### 2.1. `docs/security-and-privacy.md`
- Authored a comprehensive formal security and privacy specification for Humaniti AI.
- Covers STRIDE threat model, 4-tier data classification matrix (Tier 1 Student PII to Tier 4 Public metadata), boundary defense-in-depth architecture, cryptographic standards, COPPA/FERPA compliance invariants, explicit exclusion of biometric/accent/emotion proxies, and privacy-safe logging policy.

### 2.2. `docs/audit/security-findings.md`
- Authored a ranked vulnerability ledger with 7 distinct findings (FINDING-01 through FINDING-07) detailing CVSS v3.1 scores, CWE classifications, affected files, technical root causes, concrete attack scenarios, recommended remediations, and verification test cases.
- Documents positive security controls empirically validated during the audit.

### 2.3. `tests/e2e/security.test.ts`
- Substantially expanded the test suite from 12 initial baseline tests to **73 automated adversarial tests** across six distinct security suites:
  1. **SSRF & Network Ingestion Boundaries (32 tests):** Verifies rejection of non-HTTPS protocols, loopback IPv4, RFC1918 private IPv4, Carrier-Grade NAT (RFC6598), cloud metadata IP literals (169.254.169.254), multicast/reserved IPs, IPv6 literals, local hostnames (`localhost`, `*.local`), credential injections, fragments, oversized URLs (>2048 chars), and acceptance of valid public HTTPS URLs.
  2. **Private Storage & Path Traversal Boundaries (13 tests):** Verifies rejection of parent traversals (`..`), non-private schemes (`public://`, `s3://`, `file://`), invalid characters, and verifies `privateMediaRoot` rejects escaping to project root or public web assets.
  3. **Manifest & Provenance Integrity (3 tests):** Verifies synthetic 34+ minute manifest acceptance without budget expansion, rejection of forged SHA-256 digests, duplicate artifacts, and inverted timestamps (`endSec < startSec`).
  4. **Prompt Injection & Grounding Resistance (6 tests):** Verifies untrusted artifact isolation, system prompt constraints banning personal proxies, rejection of hallucinated quotes, timing mismatches, modality spoofing, and contradictory polarities.
  5. **Deterministic Rubric & Scoring Safeguards (3 tests):** Verifies withholding of quality labels when essential dimensions are unassessable, withholding when assessable weight is < 70%, and strict deterministic calculation of quality labels.
  6. **Access Control & Cryptographic Invariants (16 tests):** Verifies strict ID regex `/^[A-Za-z0-9_-]{1,100}$/` accepting valid CUIDs/identifiers while rejecting path traversals, SQL injection syntax, HTML tags, null bytes, and empty strings; verifies timing-safe token comparison; bounds token length (≤ 256 chars); and ensures blocked providers are not silently replaced.

---

## 3. Exact Verification Evidence & Commands

All checks were executed in the project workspace on macOS Darwin (arm64) using Node.js v26.10.0:

| Check / Command | Exit Code | Verified Evidence / Output Summary |
| :--- | :---: | :--- |
| `npx vitest run tests/e2e/security.test.ts` | **0 (PASS)** | **73 tests passed** in 247ms across all 6 adversarial suites. |
| `npm run test` (Full Vitest Suite) | **0 (PASS)** | **161 tests passed** across 13 test files (0 failures). |
| `npm run typecheck` (`tsc --noEmit`) | **0 (PASS)** | Strict TypeScript compilation succeeded with zero type errors. |
| `npm run lint` (`eslint .`) | **0 (PASS)** | ESLint completed with **0 errors, 0 warnings**. |
| Git History & Tracked Secret Scan | **0 (PASS)** | Tracked `.env.local` is strictly gitignored (mode 0600); no private keys, cloud tokens, or passwords exist in git tree. |

---

## 4. Production Release Blockers & Recommended Actions

Before exposing Humaniti AI to multi-tenant or public cloud production, the following release gates must be fulfilled:
1. **Implement Multi-Tenant Authorization:**
   - Migrate from the single shared `ASSESSMENT_ACCESS_TOKEN` to per-user or tenant-scoped authenticated identities.
   - Bind `AssessmentJob` records to `ownerId` in PostgreSQL and enforce ownership in `loadAssessment`.
2. **Harden URL Ingestion against DNS Rebinding & Metadata Endpoints:**
   - Implement pre-connect DNS resolution and IP pinning (reusing `publicIpv4` from `lib/providers/adapters.ts`) if remote video ingestion or Drive import is enabled.
3. **Upgrade Rate Limiting to Distributed Storage:**
   - Replace the in-memory `attempts: number[]` array with Redis sliding-window rate limiting.
4. **Enable Upload Deduplication:**
   - Enable `idempotencyKey` based on client headers or streaming SHA-256 for all user uploads to prevent compute and storage exhaustion.
5. **Container Sandbox for Worker Media Execution:**
   - Package the Python worker in a rootless container with dropped Linux capabilities and restricted seccomp profiles for FFmpeg and Whisper CLI execution.

---

## 5. File Inventory & Scope Compliance

The following files were authored or updated within the authorized Workstream F scope:
- `docs/security-and-privacy.md` (Created)
- `docs/audit/security-findings.md` (Created)
- `docs/handoffs/security.md` (Created)
- `tests/e2e/security.test.ts` (Updated & Expanded)

No files outside the owned scope were created or modified. All changes strictly preserve documentation and codebase integrity.
