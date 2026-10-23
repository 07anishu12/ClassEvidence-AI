"""Typed job lifecycle values shared by the worker and repository adapters."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from pathlib import Path


class JobStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass(frozen=True, slots=True)
class QueuedJob:
    """The private input reference and lease data given to one worker attempt."""

    job_id: str
    source_path: Path
    attempt: int
    max_attempts: int
    worker_id: str
    lease_until: datetime


@dataclass(frozen=True, slots=True)
class WorkerEvent:
    """A privacy-safe progress event; messages must not contain media content."""

    job_id: str
    stage: str
    progress: int
    message: str
    created_at: datetime
