"""Long-running worker orchestration outside HTTP request handlers."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .artifacts import artifact_name, private_workspace
from .models import QueuedJob
from .repository import JobRepository


class RetryableJobError(RuntimeError):
    """A bounded failure that may be retried by the repository."""


class JobCancelledError(RuntimeError):
    """Raised when a cancellation request is observed at a safe checkpoint."""


class JobTimeoutError(RetryableJobError):
    """Raised when cooperative execution exceeds the configured deadline."""


@dataclass(frozen=True, slots=True)
class WorkerConfig:
    worker_id: str
    scratch_root: Path
    lease_seconds: float = 60.0
    heartbeat_seconds: float = 15.0
    max_runtime_seconds: float = 3600.0
    poll_seconds: float = 2.0

    def __post_init__(self) -> None:
        if not self.worker_id:
            raise ValueError("worker_id is required")
        if self.lease_seconds <= 0 or self.heartbeat_seconds <= 0:
            raise ValueError("lease and heartbeat intervals must be positive")
        if self.heartbeat_seconds >= self.lease_seconds:
            raise ValueError("heartbeat_seconds must be less than lease_seconds")
        if self.max_runtime_seconds <= 0 or self.poll_seconds <= 0:
            raise ValueError("runtime and poll intervals must be positive")


class CancellationToken:
    def __init__(self, repository: JobRepository, job: QueuedJob) -> None:
        self._repository = repository
        self._job = job
        self._local_event = threading.Event()

    def cancel_locally(self) -> None:
        self._local_event.set()

    def is_cancelled(self) -> bool:
        return self._local_event.is_set() or self._repository.is_cancel_requested(self._job)

    def raise_if_cancelled(self) -> None:
        if self.is_cancelled():
            raise JobCancelledError("Job cancellation requested")


class ProgressReporter:
    def __init__(self, repository: JobRepository, job: QueuedJob, config: WorkerConfig) -> None:
        self._repository = repository
        self._job = job
        self._config = config
        self._last_heartbeat = 0.0

    def update(self, stage: str, progress: int, message: str) -> None:
        self._job = self._heartbeat_if_due(force=True)
        self._repository.record_progress(self._job, stage, progress, message)

    def checkpoint(self, token: CancellationToken) -> None:
        token.raise_if_cancelled()
        self._job = self._heartbeat_if_due()

    def _heartbeat_if_due(self, force: bool = False) -> QueuedJob:
        now = time.monotonic()
        if force or now - self._last_heartbeat >= self._config.heartbeat_seconds:
            self._job = self._repository.heartbeat(self._job, self._config.lease_seconds)
            self._last_heartbeat = now
        return self._job

    @property
    def job(self) -> QueuedJob:
        return self._job


@dataclass(frozen=True, slots=True)
class JobExecutionContext:
    job: QueuedJob
    reporter: ProgressReporter
    cancellation: CancellationToken
    workspace: Path
    artifact_name: Callable[[str, str], str]
    deadline: float

    def checkpoint(self) -> None:
        if time.monotonic() >= self.deadline:
            raise JobTimeoutError("Job exceeded the cooperative runtime limit")
        self.reporter.checkpoint(self.cancellation)


JobHandler = Callable[[JobExecutionContext], None]


class JobWorker:
    """Claims one job, runs it with cooperative timeout, and records its result."""

    def __init__(self, repository: JobRepository, config: WorkerConfig) -> None:
        self._repository = repository
        self._config = config
        self._stop_event = threading.Event()

    def stop(self) -> None:
        self._stop_event.set()

    def run_once(self, handler: JobHandler) -> bool:
        claimed = self._repository.claim_next(self._config.worker_id, self._config.lease_seconds)
        if claimed is None:
            return False

        cancellation = CancellationToken(self._repository, claimed)
        reporter = ProgressReporter(self._repository, claimed, self._config)
        deadline = time.monotonic() + self._config.max_runtime_seconds

        try:
            with private_workspace(self._config.scratch_root, claimed.job_id) as workspace:
                context = JobExecutionContext(
                    job=claimed,
                    reporter=reporter,
                    cancellation=cancellation,
                    workspace=workspace,
                    artifact_name=lambda kind, extension: artifact_name(
                        claimed.job_id, kind, extension
                    ),
                    deadline=deadline,
                )
                handler(context)
                context.checkpoint()
            self._repository.complete(reporter.job)
            return True
        except JobCancelledError:
            self._repository.fail(reporter.job, "cancelled", "Job cancellation requested.", False)
        except JobTimeoutError as error:
            self._repository.fail(reporter.job, "timeout", str(error), True)
        except RetryableJobError as error:
            self._repository.fail(reporter.job, "retryable_error", str(error), True)
        except Exception as error:  # noqa: BLE001 - boundary converts failures to safe job state
            self._repository.fail(reporter.job, "worker_error", type(error).__name__, False)
        return True

    def run_forever(self, handler: JobHandler) -> None:
        """Run independently of web requests until stop() is called."""

        while not self._stop_event.is_set():
            if not self.run_once(handler):
                self._stop_event.wait(self._config.poll_seconds)
