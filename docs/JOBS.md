# Humaniti AI — Worker Jobs

Status: Stage 07 lifecycle foundation. The worker lifecycle is implemented in `worker/src/humaniti_worker/jobs/`; no user-facing assessment is claimed by this stage.

## Lifecycle contract

```text
queued -> processing -> completed
                   \-> failed
```

- A worker claims one queued job using an opaque `worker_id` and a time-bounded lease.
- Claiming increments `attempt` and records the lease owner and expiration.
- A restarted worker can reclaim an expired processing lease while retry capacity remains.
- Heartbeats extend the lease. Progress events contain only stage, bounded progress, and safe messages; they must not contain transcripts, media paths, names, or child data.
- Retryable failures return the job to `queued` until `max_attempts` is reached. Permanent failures become `failed`.
- Cancellation is cooperative: the handler checks a token at safe checkpoints. Because the current Prisma enum has no `CANCELLED` state, cancellation is stored as terminal `failed` with error code `cancelled`; the report layer must explain this as cancellation, not processing quality.
- Long work is run by `JobWorker.run_once`/`run_forever`, outside Next.js request handlers. HTTP routes only create or read jobs.

## Repository boundary

`JobRepository` is the worker's persistence contract. The current `InMemoryJobRepository` is limited to tests and local lifecycle smoke checks; it is never a production fallback. A production adapter must implement the same operations using the existing PostgreSQL job tables and transaction-safe claim/lease updates. It must not use an in-memory store after process restart.

This separation keeps Python focused on media processing and leaves database/business persistence in the typed application layer. PostgreSQL is not available in the current environment, so the durable adapter and real restart test remain blocked and are not falsely reported as complete.

## Timeouts and heartbeats

- `WorkerConfig.lease_seconds` defaults to 60 seconds.
- `heartbeat_seconds` defaults to 15 seconds and must be shorter than the lease.
- `max_runtime_seconds` defaults to one hour.
- The timeout is cooperative: handlers must call `context.checkpoint()` between bounded FFmpeg/media operations. Individual subprocesses must also use their own timeout.
- A future production adapter should use a database transaction/lease token so a late worker cannot update a job reclaimed by another worker.

## Media tools

`require_media_tools()` checks both `ffmpeg` and `ffprobe` before a job begins. Missing tools produce a safe blocked result and never cause a fake assessment. Tool paths are resolved without shell execution.

## Private artifacts and cleanup

- `artifact_name(job_id, kind, extension)` returns a deterministic relative key under `jobs/<sha256-prefix>/` and rejects unsafe path components.
- `private_workspace()` creates a mode-700 scratch directory under the configured private root.
- The context manager removes the workspace on success, cancellation, timeout, and failure. Persisted artifacts must be promoted by a later private-storage adapter using the deterministic key; they must never be placed under `public/` or committed to Git.

## Verification status

- Lifecycle tests cover retry/requeue, expired-lease reclaim, cancellation, workspace cleanup, and deterministic artifact names.
- System-level Python pytest was unavailable in the current sandbox because `worker/.venv` does not exist. Compile/import and direct smoke checks must be recorded separately; no database-backed sample completion is claimed.
