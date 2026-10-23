"""All checks below use synthetic hashes, labels and timestamps; no accuracy claim."""
import copy
import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location("evaluation", Path(__file__).parents[2] / "scripts/evaluate.py")
assert spec and spec.loader
evaluation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evaluation)


def fixture() -> dict:
    return {"version": "1", "rubricVersion": "0.1", "synthetic": True, "records": [{
        "contentSha256": "0" * 64, "split": "heldout", "status": "completed", "prediction": "Good", "reference": None,
        "durationSec": 10, "observationTimes": [{"startSec": 1, "endSec": 2, "artifactStartSec": 1, "artifactEndSec": 2,
                                                  "artifactSha256": "1" * 64, "provenanceSha256": "1" * 64}],
        "timestampAudit": None, "claimAudit": None}]}


def test_missing_labels_and_human_checks_never_become_zero_error_claims() -> None:
    summary = evaluation.summarize(fixture())
    assert summary["confusionMatrix"] is None and summary["humanTimestampAudit"] is None
    assert summary["humanClaimAudit"] is None and summary["dataKind"] == "synthetic"


def test_matrix_requires_explicit_compatible_verified_reference() -> None:
    payload = fixture()
    payload["records"][0]["reference"] = {"label": "Average", "provenance": "independent_human", "rubricVersion": "0.1", "verified": True}
    assert evaluation.summarize(payload)["confusionMatrix"]["Average"]["Good"] == 1
    payload["records"][0]["reference"]["label"] = "Weak"
    with pytest.raises(evaluation.EvaluationError):
        evaluation.summarize(payload)


@pytest.mark.parametrize("change", ["leakage", "fake_time", "fake_digest", "private_name", "fake_human"])
def test_leakage_fabrication_and_private_fields_fail(change: str) -> None:
    payload = copy.deepcopy(fixture())
    row = payload["records"][0]
    if change == "leakage":
        payload["records"].append({**row, "split": "calibration"})
    elif change == "fake_time":
        row["observationTimes"][0]["startSec"] = 1.5
    elif change == "fake_digest":
        row["observationTimes"][0]["provenanceSha256"] = "2" * 64
    elif change == "private_name":
        row["filename"] = "synthetic-private-name"
    else:
        row["timestampAudit"] = {"reviewed": 1, "errors": 0, "reviewer": "AI"}
    with pytest.raises(evaluation.EvaluationError):
        evaluation.summarize(payload)
