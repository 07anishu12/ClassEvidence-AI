# Humaniti AI

Private recording assessment with Next.js, strict TypeScript/Zod, PostgreSQL/Prisma, FFmpeg, offline speech preparation and permission-gated model adapters.

Current release status: code and local API/UI checks pass. Three distinct permitted recordings reached local inference: two returned insufficient evidence and one failed scoring validation, with no fabricated quality label. A reliable completed assessment and independent held-out/human validation remain release gates. There is no hosted deployment or claimed classification accuracy. See `docs/EVALUATION.md` and the stage handoffs.

## Run locally

1. Install Node dependencies with `npm ci`. Provide PostgreSQL and apply `npx prisma migrate deploy` with a private `DATABASE_URL`. `compose.yaml` supplies a development-only loopback PostgreSQL option.
2. Copy `.env.example` to an ignored `.env.local`. Configure `DATABASE_URL`, a randomly generated `ASSESSMENT_ACCESS_TOKEN` of at least 32 characters, `APP_ORIGIN` and an absolute/private media location. Never commit this file or print the token in logs. The UI requires the token; it keeps it in browser memory only.
3. Install Python 3.12–3.14, FFmpeg/ffprobe and optionally offline whisper.cpp/model weights. Python worker package: `python3 -m venv worker/.venv`, then `worker/.venv/bin/python -m pip install -e 'worker[test]'`. Media subprocesses use `python3` with `PYTHONPATH=worker/src`; there are no production Python package dependencies.
4. For local semantic processing, install a local Ollama model and whisper.cpp weights. Run Ollama bound to `127.0.0.1:11434` with `OLLAMA_NO_CLOUD=1` and request logging disabled. Configure `ASSESSMENT_PROVIDER=local`, `LOCAL_MODEL` and `WHISPER_MODEL_PATH`. Cloud model tags are rejected. The default blocked mode never generates mock reports. See `docs/PROVIDER_POLICY.md` for the verified protocol and limitations.
5. Run `npm run build`, then `npm run start -- -H 127.0.0.1 -p 3000`. Open the configured `APP_ORIGIN` (for example localhost:3000); mutation requests from other origins are rejected.
6. In another terminal run `npm run worker:build`, then `node --env-file=.env.local .worker-build/scripts/assessment-worker.js`. Use `--once` for one queued job or `--cleanup` for retention cleanup. This is a separate durable worker, outside request handlers.

The tested workspace currently uses a separate loopback PostgreSQL instance on port 55432 and app on port 3010, configured only in ignored `.env.local`. Those local services are not production credentials or hosting.

## Data and API

`POST /api/assessments` accepts a streamed MP4/MOV/WebM body with its video Content-Type, `Authorization: Bearer …` and `X-Recording-Consent: true`; it returns a durable job ID. Declared filenames are not used. MIME signatures, byte limits, codecs, source duration and private paths are checked. The worker samples up to three 60-second audio windows and preserves original offsets; the local text model does not assess visible activity.

`GET /api/assessments/:id` returns safe status/progress. `GET /api/assessments/:id/report` returns a strict coaching envelope when available. `PATCH` with `{ "action": "cancel" }` cancels queued/processing work. Retry requires a new upload after source deletion. Drive import is explicitly unavailable; download a permitted file normally and upload it. There is no arbitrary remote URL fetcher.

Only adequately supported assessments receive one of Poor/Average/Good/Excellent. Missing/uncertain evidence withholds a label and remains inspectable. Reports separate source quotations, provisional interpretations and future recommendations. Confidence is an uncalibrated coverage index. No personality, accent, appearance or emotion proxies are used.

Uploaded source and temporary media are deleted after terminal processing. Running workers expire unfinished jobs after one hour and remove their files; schedule `--cleanup` independently if workers may be stopped. Reports and cited excerpts remain private in PostgreSQL and need a deployment-specific deletion policy before hosting. Private evaluation references are separate, ignored local files; never publish them, their names or transcripts.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run worker:build
worker/.venv/bin/python -m pytest worker/tests
npm run prisma:validate
python3 scripts/evaluate.py tests/fixtures/evaluation.synthetic.json
```

With the local server/database configured and an explicitly synthetic generated video, `node --env-file=.env.local scripts/smoke-integration.mjs <synthetic-video.mp4>` checks real concurrent claims, durable blocked-provider failure, cancellation and retention cleanup. It does not call a mock or claim teaching accuracy. Evaluation manifests and media must remain private; `scripts/evaluate.py` prints sanitized aggregate results only.
