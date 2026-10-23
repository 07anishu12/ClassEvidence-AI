"""Repository boundary for durable job state.

The production adapter belongs behind this protocol so Python remains focused
on media processing. The in-memory implementation is deliberately test/smoke
only; it is not used by the user-facing application.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Protocol

from .models import JobStatus, QueuedJob, WorkerEvent


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class JobLeaseError(RuntimeError):
    """Raised when a worker tries to update a job it no longer owns."""


class JobRepository(Protocol):
    """The minimal persistence contract required by the worker loop."""

    def claim_next(self, worker_id: str, lease_seconds: float) -> QueuedJob | None:
        ...

    def heartbeat(self, job: QueuedJob, lease_seconds: float) -> QueuedJob:
        ...

    def record_progress(self, job: QueuedJob, stage: str, progress: int, message: str) -> None:
        ...

    def complete(self, job: QueuedJob) -> None:
        ...

    def fail(self, job: QueuedJob, error_code: str, message: str, retryable: bool) -> bool:
        """Fail or requeue the job; return whether another attempt was queued."""
        ...

    def request_cancel(self, job_id: str) -> bool:
        ...

    def is_cancel_requested(self, job: QueuedJob) -> bool:
        ...


@dataclass(slots=True)
class _StoredJob:
    job_id: str
    source_path: Path
    status: JobStatus = JobStatus.QUEUED
    attempt: int = 0
    max_attempts: int = 3
    worker_id: str | None = None
    lease_until: datetime | None = None
    cancel_requested: bool = False
    progress: int = 0
    stage: str = "queued"
    error_code: str | None = None
    error_message: str | None = None
    events: list[WorkerEvent] = field(default_factory=list)


class InMemoryJobRepository:
    """Deterministic repository for lifecycle tests and local smoke checks."""

    def __init__(self) -> None:
        self._jobs: dict[str, _StoredJob] = {}
        self._lock = threading.RLock()

    def enqueue(self, job_id: str, source_path: str | Path, max_attempts: int = 3) -> None:
        if not job_id or "/" in job_id or "\\" in job_id:
            raise ValueError("job_id must be a non-empty opaque identifier")
        if max_attempts < 1:
            raise ValueError("max_attempts must be positive")
        with self._lock:
            if job_id in self._jobs:
                raise ValueError("job_id already exists")
            self._jobs[job_id] = _StoredJob(
                job_id=job_id,
                source_path=Path(source_path),
                max_attempts=max_attempts,
            )

    def claim_next(self, worker_id: str, lease_seconds: float) -> QueuedJob | None:
        if not worker_id:
            raise ValueError("worker_id is required")
        if lease_seconds <= 0:
            raise ValueError("lease_seconds must be positive")
        now = utc_now()
        with self._lock:
            self._recover_expired(now)
            candidates = [job for job in self._jobs.values() if job.status == JobStatus.QUEUED]
            if not candidates:
                return None
            stored = sorted(candidates, key=lambda job: job.job_id)[0]
            stored.status = JobStatus.PROCESSING
            stored.attempt += 1
            stored.worker_id = worker_id
            stored.lease_until = now + timedelta(seconds=lease_seconds)
            stored.stage = "processing"
            return self._claimed(stored)

    def heartbeat(self, job: QueuedJob, lease_seconds: float) -> QueuedJob:
        with self._lock:
            stored = self._owned_processing(job)
            stored.lease_until = utc_now() + timedelta(seconds=lease_seconds)
            return self._claimed(stored)

    def record_progress(self, job: QueuedJob, stage: str, progress: int, message: str) -> None:
        if not stage or not message:
            raise ValueError("stage and message are required")
        if not 0 <= progress <= 100:
            raise ValueError("progress must be between 0 and 100")
        with self._lock:
            stored = self._owned_processing(job)
            stored.stage = stage
            stored.progress = progress
            stored.events.append(
                WorkerEvent(job.job_id, stage, progress, message, utc_now())
            )

    def complete(self, job: QueuedJob) -> None:
        with self._lock:
            stored = self._owned_processing(job)
            if stored.cancel_requested:
                raise JobLeaseError("cancelled job cannot be completed")
            stored.status = JobStatus.COMPLETED
            stored.progress = 100
            stored.stage = "completed"
            stored.lease_until = None
            stored.worker_id = None

    def fail(self, job: QueuedJob, error_code: str, message: str, retryable: bool) -> bool:
        if not error_code or not message:
            raise ValueError("error_code and message are required")
        with self._lock:
            stored = self._owned_processing(job)
            should_retry = retryable and not stored.cancel_requested and stored.attempt < stored.max_attempts
            stored.error_code = error_code
            stored.error_message = message
            stored.lease_until = None
            stored.worker_id = None
            if should_retry:
                stored.status = JobStatus.QUEUED
                stored.stage = "queued"
                stored.progress = 0
                stored.events.append(
                    WorkerEvent(job.job_id, "retry", 0, "Retry scheduled", utc_now())
                )
            else:
                stored.status = JobStatus.FAILED
                stored.stage = "failed"
            return should_retry

    def request_cancel(self, job_id: str) -> bool:
        with self._lock:
            stored = self._jobs.get(job_id)
            if stored is None or stored.status in {JobStatus.COMPLETED, JobStatus.FAILED}:
                return False
            stored.cancel_requested = True
            return True

    def is_cancel_requested(self, job: QueuedJob) -> bool:
        with self._lock:
            stored = self._jobs.get(job.job_id)
            return stored is None or stored.cancel_requested

    def snapshot(self, job_id: str) -> dict[str, object]:
        with self._lock:
            stored = self._jobs[job_id]
            return {
                "status": stored.status.value,
                "attempt": stored.attempt,
                "progress": stored.progress,
                "stage": stored.stage,
                "error_code": stored.error_code,
                "events": tuple(stored.events),
            }

    def _recover_expired(self, now: datetime) -> None:
        for stored in self._jobs.values():
            if (
                stored.status == JobStatus.PROCESSING
                and stored.lease_until is not None
                and stored.lease_until <= now
            ):
                if stored.attempt < stored.max_attempts and not stored.cancel_requested:
                    stored.status = JobStatus.QUEUED
                    stored.worker_id = None
                    stored.lease_until = None
                    stored.stage = "queued"
                else:
                    stored.status = JobStatus.FAILED
                    stored.stage = "failed"
                    stored.error_code = "lease_expired"
                    stored.error_message = "Worker lease expired without a retry remaining."

    def _owned_processing(self, job: QueuedJob) -> _StoredJob:
        stored = self._jobs.get(job.job_id)
        if (
            stored is None
            or stored.status != JobStatus.PROCESSING
            or stored.worker_id != job.worker_id
            or stored.attempt != job.attempt
        ):
            raise JobLeaseError("worker does not own the processing lease")
        return stored

    @staticmethod
    def _claimed(stored: _StoredJob) -> QueuedJob:
        if stored.lease_until is None or stored.worker_id is None:
            raise JobLeaseError("processing job has no active lease")
        return QueuedJob(
            job_id=stored.job_id,
            source_path=stored.source_path,
            attempt=stored.attempt,
            max_attempts=stored.max_attempts,
            worker_id=stored.worker_id,
            lease_until=stored.lease_until,
        )
