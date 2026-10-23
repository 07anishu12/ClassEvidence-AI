from __future__ import annotations

import time
from pathlib import Path

import pytest

from humaniti_worker.jobs.artifacts import ArtifactNameError, artifact_name
from humaniti_worker.jobs.lifecycle import JobWorker, RetryableJobError, WorkerConfig
from humaniti_worker.jobs.repository import InMemoryJobRepository


def _worker(repository: InMemoryJobRepository, tmp_path: Path, **kwargs: object) -> JobWorker:
    return JobWorker(
        repository,
        WorkerConfig(worker_id="worker-test", scratch_root=tmp_path / "scratch", **kwargs),
    )


def test_retryable_failure_is_requeued_then_completes(tmp_path: Path) -> None:
    repository = InMemoryJobRepository()
    repository.enqueue("job-retry", tmp_path / "lesson.mp4", max_attempts=2)
    calls = 0

    def handler(context) -> None:
        nonlocal calls
        calls += 1
        context.reporter.update("probe", 25, "Media probe started")
        if calls == 1:
            raise RetryableJobError("temporary tool failure")

    worker = _worker(repository, tmp_path)
    assert worker.run_once(handler) is True
    assert repository.snapshot("job-retry")["status"] == "queued"
    assert worker.run_once(handler) is True
    snapshot = repository.snapshot("job-retry")
    assert snapshot["status"] == "completed"
    assert snapshot["progress"] == 100
    assert calls == 2


def test_expired_lease_is_reclaimed_by_a_restarted_worker(tmp_path: Path) -> None:
    repository = InMemoryJobRepository()
    repository.enqueue("job-restart", tmp_path / "lesson.mp4", max_attempts=2)
    first = repository.claim_next("worker-one", lease_seconds=0.01)
    assert first is not None
    time.sleep(0.03)

    second = repository.claim_next("worker-two", lease_seconds=1)
    assert second is not None
    assert second.job_id == "job-restart"
    assert second.attempt == 2
    assert second.worker_id == "worker-two"


def test_cancellation_cleans_private_workspace_and_fails_without_retry(tmp_path: Path) -> None:
    repository = InMemoryJobRepository()
    repository.enqueue("job-cancel", tmp_path / "lesson.mp4")
    repository.request_cancel("job-cancel")

    def handler(context) -> None:
        (context.workspace / "private-derived-data").write_text("do not retain", encoding="utf-8")
        context.checkpoint()

    worker = _worker(repository, tmp_path)
    assert worker.run_once(handler) is True
    snapshot = repository.snapshot("job-cancel")
    assert snapshot["status"] == "failed"
    assert snapshot["error_code"] == "cancelled"
    assert not (tmp_path / "scratch").exists() or not tuple((tmp_path / "scratch").iterdir())


def test_deterministic_artifact_names_reject_traversal() -> None:
    first = artifact_name("job-123", "transcript", ".json")
    second = artifact_name("job-123", "transcript", ".json")
    assert first == second
    assert first.endswith("/transcript.json")
    with pytest.raises(ArtifactNameError):
        artifact_name("job-123", "../private", ".json")
