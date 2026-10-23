"""Build the trusted source-artifact registry; semantic/domain validation stays in TypeScript."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

from analysis.transcribe import TranscriptResult
from providers.manifest import frame_artifact, transcript_artifacts


def prepare_evidence_manifest(*, job_id: str, duration_sec: float, transcript: TranscriptResult | None,
                              frames: list[tuple[str, Path, float]], private_root: Path, source_sha256: str | None = None) -> dict[str, object]:
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,79}", job_id):
        raise ValueError("Invalid job identity")
    if not math.isfinite(duration_sec) or not 0 < duration_sec <= 86400:
        raise ValueError("Invalid source duration")
    artifacts = transcript_artifacts(transcript, duration_sec=duration_sec) if transcript else []
    for frame_id, path, timestamp in frames:
        artifacts.append(frame_artifact(path, private_root=private_root, frame_id=frame_id,
                                        timestamp_sec=timestamp, duration_sec=duration_sec))
    if len(artifacts) > 2000 or len({a["id"] for a in artifacts}) != len(artifacts):
        raise ValueError("Artifact count or identity invalid")
    manifest: dict[str, object] = {"version": "1", "jobId": job_id, "durationSec": duration_sec, "artifacts": artifacts}
    if source_sha256 is not None:
        if not re.fullmatch(r"[a-f0-9]{64}", source_sha256):
            raise ValueError("Invalid source digest")
        manifest["sourceSha256"] = source_sha256
    if len(json.dumps(manifest).encode()) > 7_500_000:
        raise ValueError("Manifest byte limit exceeded")
    return manifest
