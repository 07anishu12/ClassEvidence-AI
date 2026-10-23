# Provider policy — Stage 10

No organiser approval for remote AI is recorded. `getAssessmentProvider()` and the environment default remain blocked. A job cannot select an adapter, endpoint, approval, executable, or price. There is no production mock fallback.

## Runtime contract

`lib/providers/manifest.ts` accepts a versioned manifest with opaque job/artifact IDs, original source timestamps, SHA-256 digests, bounded transcript segments and inline PNG/JPEG frames. No source URL, storage path, name, or credential is sent. Signature checks are format checks, not complete image decoding; trusted FFmpeg must generate frames. `worker/src/providers/manifest.py` prepares these artifacts from private local outputs. The TypeScript boundary revalidates them.

Local integration: `createLocalProvider({executable, args})` runs a trusted absolute executable, with JSON on stdin and one JSON response on stdout. The executable must run an offline model in an egress-restricted deployment. This adapter cannot sandbox a deliberately network-enabled executable; do not configure one as local. It inherits PATH/LANG/NODE_ENV only, discards stderr, bounds stdout and kills the process group on timeout. No local model is installed or claimed to work yet.

Remote integration: `createRemoteProvider` requires a trusted server-side approval reference, exact HTTPS endpoint, unexpired UTC approval, permitted modalities and credential. The deployment owner must verify the approval record against organiser evidence. No approval has been populated. The generic JSON gateway protocol below must be implemented by the approved processor; this is not a claim of compatibility with any vendor API. There are no invented vendor endpoints or SDK calls. DNS is checked and pinned to a public IPv4 address, TLS validates the original hostname, special-use addresses and redirects are rejected. IPv6-only endpoints are unsupported.

Request: `{input, instructions, outputSchema, maxOutputTokens}`. Response: `{output: {observations, ratings, limitations, providerVersion}, usage: {inputTokens, outputTokens}}`. The output JSON schema is generated from Zod. Model text is untrusted; strict parsing rejects unknown fields, overall labels, invalid scores and malformed evidence. Grounding is a separate mandatory domain step before reporting.

## Bounds and errors

Input <=8 MB serialized, <=2000 artifacts, each frame <=2 MB, duration <=24 h; output <=100 KB. Timeout defaults to 30 s (maximum 120 s). Requested and returned output tokens <=4000 by default (maximum 16000). Input size provides a conservative byte budget; this generic adapter cannot count a vendor tokenizer's exact input tokens. Providers must honor the explicit token bound; excess output is rejected.

At most two attempts, retrying only malformed/schema-invalid output. Timeouts, 429s, budget failures and unavailable processors are never silently replayed. Rate defaults to six attempts/minute per adapter instance. Reuse one adapter per worker; deployments with multiple workers need a shared external rate limiter before raising concurrency.

Errors expose only `provider_blocked`, `provider_timeout`, `provider_rate_limited`, `provider_invalid_output`, `provider_unavailable`, `provider_input_invalid`, or `provider_budget_exceeded`. Provider bodies, paths, stack traces, transcript text and credentials are excluded from audit events. Safe counts, attempts and status are logged. Cost is null unless verified server-side prices and valid usage are supplied; retried or failed calls have unknown total cost, never a fabricated zero. Provider version is retained privately in analysis results, not logged verbatim.

`createTestProvider` checks `NODE_ENV=test` on every invocation and marks audit events `testOnly=true`. It cannot execute in development or production. All current fixtures are explicitly synthetic.

## Verification limit

Tests exercise the actual local subprocess protocol, timeout termination, strict schema/digest validation, output/token limits, rate limiting and blocked approvals. No remote request or real-model semantic run has been made. Database persistence, real media ingestion, a local model and organiser approval remain prerequisites for an end-to-end assessment.

## Stage 14 local runtime

The offline wrapper in `scripts/local-model.ts` uses the documented fixed-loopback Ollama JSON-schema API; remote/cloud model tags are rejected. Run Ollama with `OLLAMA_NO_CLOUD=1`, request logging disabled, and loopback binding. Official references checked: https://docs.ollama.com/api/generate and https://docs.ollama.com/faq. Local Qwen3:4b weights were downloaded without sending recordings. The text-only local path does not claim visual analysis. Offline whisper.cpp samples opening/middle/ending speech; ASR timestamps/wording require source review. Model downloads are distinct from transferring private data.

## Grounded local adapter v2

After a real held-out `scoring_invalid` failure, the local wrapper now uses two bounded passes: extract observations, validate/canonicalize them against source artifacts, then request ratings constrained to actual IDs in each dimension. Missing/high-uncertainty dimensions permit only null ratings. Technical usability is null on this text-only path. The combined output-token budget remains 4000 and the wrapper has one 105-second deadline, inside the adapter timeout. Usage sums actual counters from both local calls; logical analysis rate limiting applies to the pair. Duplicate identical citation IDs are normalized as a set; unsupported IDs are still rejected. Model digest and `grounded-v2` are stamped by the trusted wrapper. This refinement does not convert earlier held-out failures into passes; new validation must use a fresh recording. New reports retain source timing/digest metadata without full transcript/frame payloads for later mechanical audits.
