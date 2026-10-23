# Security Policy — Humaniti AI

The Humaniti AI team takes the security and privacy of classroom recordings, student information, and teaching assessments with the highest priority.

---

## 1. Supported Versions

| Version | Supported | Security Updates |
| :--- | :--- | :--- |
| `0.1.x` | :white_check_mark: | Active release candidate |
| `< 0.1.0` | :x: | Development snapshots only |

---

## 2. Reporting a Vulnerability

If you discover a potential security vulnerability or privacy flaw within Humaniti AI, please **do not report it through public GitHub issues or discussions**.

Instead, send a detailed advisory via encrypted email or direct message to:
- **Email:** `security@humaniti.ai`
- **Response SLA:** Within 48 hours acknowledging receipt, with a formal mitigation timeline within 7 calendar days.

### What to Include
1. Type of issue (e.g., SSRF, directory traversal, IDOR, prompt injection, PII leakage).
2. Location of the vulnerability (file path, line numbers, API endpoint).
3. Step-by-step reproduction instructions or a minimal proof-of-concept.
4. Assessment of impact and potential exploit scenarios.

---

## 3. Core Security & Privacy Invariants

- **Zero Student PII Retention:** Raw classroom recordings and audio streams are processed in ephemeral scratch storage (`.private/scratch/`) and unlinked immediately upon job completion or failure.
- **Referential Grounding:** Observations must cite verified artifact locators and verbatim transcript substrings; hallucinated citations are automatically rejected.
- **No Demographics or Biometrics:** Face recognition, accent evaluation, emotion analysis, and child biometric scoring are prohibited by architectural design.
- **Blocked-by-Default Inference:** Remote AI processing requires explicit, cryptographic server-side authorization. Production environments never silently fall back to mock adapters.

For complete architectural details, threat models, and classification matrices, see [docs/security-and-privacy.md](docs/security-and-privacy.md) and [docs/SECURITY.md](docs/SECURITY.md).
