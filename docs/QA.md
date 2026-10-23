# Humaniti AI — Stage 17 QA Plan and Results

Status: **contract/adversarial coverage added; full release gate blocked**.

## QA matrix

| Scenario | Current evidence | Status |
|---|---|---|
| Invalid HTTP/private URL | `tests/e2e/security.test.ts` source-schema cases | PASS at contract level |
| Credentials/fragments/path traversal | Source and private-storage schema tests | PASS at contract level |
| Transcript prompt injection | Local provider receives transcript as artifact data; fixed instructions remain separate | PASS synthetic boundary |
| Unknown/forged/duplicate provider artifacts | Manifest digest and duplicate tests | PASS synthetic boundary |
| Provider unavailable | Default provider returns `provider_blocked` | PASS |
| Provider timeout | Existing adapter tests plus worker cooperative-timeout test | PASS synthetic boundary |
| Unauthorized frame access | `worker/tests/test_adversarial.py` private-root test | PASS synthetic boundary |
| Concurrent worker claims | In-memory repository concurrent-claim test | PASS test adapter only |
| Duplicate submit/idempotency | Current HTTP route has no idempotency-key contract | BLOCKED; documented gap |
| No-audio recording | Explicit diagnostics return `not_assessable` limitation | PASS fixture/contract |
| Corrupt or unsupported codec | Existing media-probe malformed/unsupported tests | PASS fixture level |
| 34+ minute recording | 34-minute manifest/diagnostic boundary only | BLOCKED; no permitted real file/tools |
| Real FFmpeg/audio extraction | FFmpeg unavailable in sandbox | BLOCKED |
| Real PostgreSQL restart/concurrency | PostgreSQL/Docker unavailable; durable adapter absent | BLOCKED |
| Hosted unseen-video path | No deployment or approved sample | BLOCKED |

## Budgets and adversarial limits

- Provider manifest limits: duration <=24 hours, <=2,000 artifacts, <=8 MB serialized input, <=2 MB per frame, <=100 KB output.
- Provider calls: bounded timeout, maximum two attempts, retry only malformed output, per-adapter request rate limit, output-token and byte budgets.
- Worker: lease/heartbeat/retry/cancellation/cleanup boundaries are tested without real media.
- Transcript: offsets must be finite and within validated duration; speaker labels are optional and uncertain.
- Technical audio signals are limitations, not pedagogical penalties.

## Known QA gaps

1. No authorised recording or Drive inventory is available, so there is no real 34+ minute, silent, corrupt-codec, or held-out recording result.
2. No real PostgreSQL repository adapter or idempotency-key HTTP contract is implemented.
3. No authentication/authorisation layer exists for assessment records; current APIs do not expose raw media paths, but hosted access control is not proven.
4. FFmpeg, ffprobe, Node dependencies, and the worker virtual environment are unavailable in this sandbox.

No QA result in this document is an accuracy claim or a substitute for a permitted hosted test.
