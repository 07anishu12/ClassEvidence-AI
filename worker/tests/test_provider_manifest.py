"""Synthetic local media only; no external processor calls."""
from pathlib import Path

import pytest

from analysis.transcribe import parse_transcription_payload
from providers.manifest import frame_artifact, transcript_artifacts


def test_transcript_uses_real_offsets_and_digest() -> None:
    result = parse_transcription_payload({"segments": [{"start_sec": 1, "end_sec": 2, "text": "Synthetic"}]},
                                         duration_seconds=3, provider_name="synthetic", provider_version="1")
    artifact = transcript_artifacts(result, duration_sec=3)[0]
    assert artifact["startSec"] == 1 and artifact["endSec"] == 2
    assert len(str(artifact["sha256"])) == 64
    with pytest.raises(ValueError):
        transcript_artifacts(result, duration_sec=1)


def test_frames_require_private_existing_content_and_bounded_time(tmp_path: Path) -> None:
    private = tmp_path / "private"
    private.mkdir()
    frame = private / "frame.png"
    frame.write_bytes(b"\x89PNG\r\n\x1a\nsynthetic")
    assert frame_artifact(frame, private_root=private, frame_id="frame_1", timestamp_sec=2, duration_sec=3)["modality"] == "video"
    with pytest.raises(ValueError):
        frame_artifact(frame, private_root=private, frame_id="frame_1", timestamp_sec=4, duration_sec=3)
    with pytest.raises(ValueError):
        frame_artifact(frame, private_root=private / "absent", frame_id="frame_1", timestamp_sec=2, duration_sec=3)
