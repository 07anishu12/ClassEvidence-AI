"""Sanitized evaluation summaries. No model execution, media upload, or inferred ground truth."""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

LABELS = ("Poor", "Average", "Good", "Excellent")


class EvaluationError(ValueError):
    pass


def _object(value: object, keys: set[str]) -> dict:
    if not isinstance(value, dict) or set(value) != keys:
        raise EvaluationError("invalid_fields")
    return value


def _count(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise EvaluationError("invalid_count")
    return value


def _number(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise EvaluationError("invalid_timing")
    return float(value)


def summarize(payload: object) -> dict[str, object]:
    root = _object(payload, {"version", "rubricVersion", "synthetic", "records"})
    if root["version"] != "1" or root["rubricVersion"] != "0.1" or not isinstance(root["synthetic"], bool):
        raise EvaluationError("invalid_version")
    records = root["records"]
    if not isinstance(records, list) or len(records) > 1000:
        raise EvaluationError("invalid_records")
    seen: set[str] = set()
    outcomes = {key: 0 for key in ("completed", "insufficient_evidence", "failed")}
    splits = {"calibration": 0, "heldout": 0}
    matrix = {actual: {predicted: 0 for predicted in LABELS} for actual in LABELS}
    labeled = checked = human_checked = timing_errors = claims_checked = unsupported = contradictions = 0
    for record in records:
        row = _object(record, {"contentSha256", "split", "status", "prediction", "reference", "durationSec",
                               "observationTimes", "timestampAudit", "claimAudit"})
        digest = row["contentSha256"]
        if not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest) or digest in seen:
            raise EvaluationError("duplicate_or_invalid_content_checksum")
        seen.add(digest)
        if row["split"] not in splits or row["status"] not in outcomes:
            raise EvaluationError("invalid_split_or_status")
        splits[row["split"]] += 1
        outcomes[row["status"]] += 1
        if row["status"] == "completed":
            if row["prediction"] not in LABELS:
                raise EvaluationError("invalid_prediction")
        elif row["prediction"] is not None:
            raise EvaluationError("failure_cannot_have_label")
        duration = _number(row["durationSec"])
        if not 0 < duration <= 86400 or not isinstance(row["observationTimes"], list) or len(row["observationTimes"]) > 18:
            raise EvaluationError("invalid_observation_registry")
        for raw in row["observationTimes"]:
            moment = _object(raw, {"startSec", "endSec", "artifactStartSec", "artifactEndSec", "artifactSha256", "provenanceSha256"})
            start, end = _number(moment["startSec"]), _number(moment["endSec"])
            if not 0 <= start <= end <= duration or start != _number(moment["artifactStartSec"]) or end != _number(moment["artifactEndSec"]):
                raise EvaluationError("source_timing_mismatch")
            if not isinstance(moment["artifactSha256"], str) or not re.fullmatch(r"[a-f0-9]{64}", moment["artifactSha256"]) or moment["artifactSha256"] != moment["provenanceSha256"]:
                raise EvaluationError("source_digest_mismatch")
            checked += 1
        reference = row["reference"]
        if reference is not None:
            reference = _object(reference, {"label", "provenance", "rubricVersion", "verified"})
            if reference["label"] not in LABELS or reference["provenance"] not in {"organiser", "independent_human"} or reference["rubricVersion"] != "0.1" or reference["verified"] is not True:
                raise EvaluationError("unverified_or_incompatible_reference")
            if row["split"] == "heldout" and row["status"] == "completed":
                matrix[reference["label"]][row["prediction"]] += 1
                labeled += 1
        audit = row["timestampAudit"]
        if audit is not None:
            audit = _object(audit, {"reviewed", "errors", "reviewer"})
            reviewed, errors = _count(audit["reviewed"]), _count(audit["errors"])
            if audit["reviewer"] != "human" or errors > reviewed or reviewed > len(row["observationTimes"]):
                raise EvaluationError("invalid_human_audit")
            human_checked += reviewed
            timing_errors += errors
        audit = row["claimAudit"]
        if audit is not None:
            audit = _object(audit, {"reviewed", "unsupported", "contradictions", "reviewer"})
            reviewed, bad, conflict = _count(audit["reviewed"]), _count(audit["unsupported"]), _count(audit["contradictions"])
            if audit["reviewer"] != "human" or bad > reviewed or conflict > reviewed or reviewed > len(row["observationTimes"]):
                raise EvaluationError("invalid_claim_audit")
            claims_checked += reviewed
            unsupported += bad
            contradictions += conflict
    return {"dataKind": "synthetic" if root["synthetic"] else "permitted_recordings", "recordings": len(records),
            "splits": splits, "outcomes": outcomes, "mechanicallyCheckedObservations": checked,
            "humanTimestampAudit": {"reviewed": human_checked, "errors": timing_errors} if human_checked else None,
            "humanClaimAudit": {"reviewed": claims_checked, "unsupported": unsupported, "contradictions": contradictions} if claims_checked else None,
            "trustedLabeledHeldoutPredictions": labeled, "confusionMatrix": matrix if labeled else None}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="private evaluation manifest; never raw recordings or transcripts")
    args = parser.parse_args()
    try:
        if args.input.stat().st_size > 2_000_000:
            raise EvaluationError("manifest_too_large")
        summary = summarize(json.loads(args.input.read_text()))
        print(json.dumps(summary, sort_keys=True, indent=2))
        return 0
    except (OSError, ValueError, TypeError):
        print("evaluation_manifest_invalid", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
