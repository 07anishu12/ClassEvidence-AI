# Humaniti AI — Security Review

Status: Stage 17 adversarial review. This is a threat register, not a claim that the application is production-secure.

## Protected data

Recordings may contain children. Source videos, transcripts, frames, names, credentials, private URLs, and derived artifacts are confidential. They must stay out of Git, public buckets, logs, test fixtures, screenshots, and provider requests unless the organiser has explicitly approved the processor and retention path.

## Controls currently present

- HTTPS-only URL schema rejects credentials, fragments, obvious local/private IPs, and local hostnames.
- Private storage references reject traversal and public schemes.
- Provider manifests use opaque IDs, bounded source timestamps, SHA-256 digests, artifact count/byte limits, and strict schemas.
- Provider instructions explicitly treat artifacts as untrusted data and forbid overall labels, identity, emotion, accent, and personal-trait judgments.
- Provider defaults are blocked; remote adapters require trusted server-side approval, exact HTTPS endpoint, expiry, permitted modalities, DNS/IP checks, and bounded requests.
- Local provider processes receive a reduced environment, discard stderr, bound output, and kill the process group on timeout.
- Transcript and audio summaries omit source text, paths, and private identifiers.
- Frame artifacts must reside under a configured private root and are rejected otherwise.
- Worker scratch directories are private and cleaned on exit.

## Threat review

| Threat | Control/status |
|---|---|
| SSRF/private metadata endpoint | URL checks cover obvious IP/host forms; DNS rebinding protection for generic source URL fetching is not implemented. **OPEN.** |
| Prompt injection in transcript/frame content | Content is sent as manifest data with fixed instructions; provider output is schema/manifest-grounded. Semantic model obedience cannot be proven without a real provider. |
| Public media exposure | No public media endpoint is implemented; hosted ACL/presigned URL behavior is not tested. **OPEN.** |
| Unauthorized assessment/report access | Current API has no authentication/ownership layer. Random IDs are not authorization. **HIGH OPEN ISSUE.** |
| Path traversal | Storage keys and artifact names are validated; frame paths are required under private root. |
| Malicious media / resource exhaustion | Size/duration/provider budgets are specified, but upload intake and real FFmpeg sandboxing are not implemented. **OPEN.** |
| Transcript/child PII in logs | Safe summaries and redacted provider audits are designed; hosted log inspection is not available. |
| Provider secret leakage | Credentials stay server-side in the adapter contract; no secret is committed. Remote approval remains absent. |
| Duplicate processing | In-memory lifecycle claims are single-owner; durable idempotency and duplicate HTTP submission are not implemented. **OPEN.** |
| Worker race/stale lease | Test repository checks single claim and expiry recovery; PostgreSQL transaction behavior is not proven. |

## Release blockers

Do not claim a secure hosted release until authentication/authorization, private storage ACLs, upload validation, DNS-safe URL fetching, durable idempotency, FFmpeg resource limits, approved processing, retention/deletion, and a real unseen-video smoke test are verified.

## Safe logging rule

Logs may contain opaque job IDs, stage names, bounded counters, durations, error codes, attempt counts, and redacted status. Logs must not contain source paths, URLs, transcript text, frame bytes, child names, provider bodies, credentials, or model reasoning.
