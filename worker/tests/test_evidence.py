from pathlib import Path

import pytest

from analysis.evidence import prepare_evidence_manifest


def test_missing_modalities_are_empty_not_negative(tmp_path: Path) -> None:
    result = prepare_evidence_manifest(job_id="job_synthetic", duration_sec=5, transcript=None, frames=[], private_root=tmp_path)
    assert result["artifacts"] == []


def test_fabricated_frame_and_timestamp_fail(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        prepare_evidence_manifest(job_id="job_synthetic", duration_sec=5, transcript=None,
                                  frames=[("frame_1", tmp_path / "absent", 1)], private_root=tmp_path)
    with pytest.raises(ValueError):
        prepare_evidence_manifest(job_id="job_synthetic", duration_sec=float("nan"), transcript=None, frames=[], private_root=tmp_path)
