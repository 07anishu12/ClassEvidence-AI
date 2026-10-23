"""Prepare bounded model artifacts from local media outputs without network I/O."""

from __future__ import annotations

import base64
import hashlib
import math
from pathlib import Path

from analysis.transcribe import TranscriptResult


def transcript_artifacts(result: TranscriptResult, *, duration_sec: float) -> list[dict[str, object]]:
    if not math.isfinite(duration_sec) or duration_sec <= 0 or duration_sec > 86400:
        raise ValueError("Invalid recording duration")
    if len(result.segments) > 2000:
        raise ValueError("Model artifact limit exceeded; select bounded source segments")
    artifacts: list[dict[str, object]] = []
    ids: set[str] = set()
    for segment in result.segments:
        if segment.segment_id in ids or not 0 <= segment.start_sec < segment.end_sec <= duration_sec:
            raise ValueError("Invalid transcript identity or source timing")
        ids.add(segment.segment_id)
        artifacts.append({"id": segment.segment_id, "modality": "transcript",
                          "startSec": segment.start_sec, "endSec": segment.end_sec,
                          "text": segment.text, "sha256": hashlib.sha256(segment.text.encode()).hexdigest()})
    return artifacts


def frame_artifact(path: Path, *, private_root: Path, frame_id: str, timestamp_sec: float,
                   duration_sec: float) -> dict[str, object]:
    import re

    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,79}", frame_id):
        raise ValueError("Invalid frame identity")
    if not math.isfinite(duration_sec) or not 0 < duration_sec <= 86400 or not 0 <= timestamp_sec <= duration_sec:
        raise ValueError("Invalid frame timing")
    try:
        resolved = path.resolve(strict=True)
        root = private_root.resolve(strict=True)
    except OSError:
        raise ValueError("Private frame is unavailable") from None
    if not resolved.is_relative_to(root) or not resolved.is_file():
        raise ValueError("Frame is outside private storage")
    with resolved.open("rb") as source:
        data = source.read(2_000_001)
    if len(data) > 2_000_000:
        raise ValueError("Frame byte limit exceeded")
    mime = "image/png" if data.startswith(b"\x89PNG\r\n\x1a\n") else "image/jpeg" if data.startswith(b"\xff\xd8\xff") else None
    if mime is None:
        raise ValueError("Unsupported frame content")
    return {"id": frame_id, "modality": "video", "startSec": timestamp_sec, "endSec": timestamp_sec,
            "mime": mime, "base64": base64.b64encode(data).decode("ascii"), "sha256": hashlib.sha256(data).hexdigest()}
