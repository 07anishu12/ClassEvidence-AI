"""Bounded offline speech preparation for the TypeScript assessment worker."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Callable

from analysis.evidence import prepare_evidence_manifest
from analysis.transcribe import parse_transcription_payload
from humaniti_worker.media import FFProbeUnavailableError, MediaProbe, MediaProbeError
from humaniti_worker.process import run_bounded
from media.audio import AudioExtractor, AudioError, AudioToolUnavailableError


def prepare_recording(path: Path, *, job_id: str, model: Path | None = None, scratch_root: Path | None = None,
                      max_seconds: int = 7200, max_bytes: int = 2_147_483_648, provider_blocked: bool = False,
                      expected_sha256: str | None = None, expected_bytes: int | None = None,
                      on_stage: Callable[[str], None] = lambda _: None) -> dict[str, object]:
    if not 1 <= max_seconds <= 7200 or not 1 <= max_bytes <= 10_000_000_000:
        raise ValueError("invalid_media")
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= max_bytes or path.stat().st_nlink != 1:
        raise ValueError("invalid_media")
    if expected_bytes is not None and path.stat().st_size != expected_bytes:
        raise ValueError("source_integrity_failed")
    on_stage("probing")
    with path.open("rb") as source:
        magic = source.read(16)
        if not (magic[4:8] == b"ftyp" or magic[:4] == b"\x1aE\xdf\xa3"):
            raise ValueError("invalid_media")
        source.seek(0)
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    if expected_sha256 is not None and (not re.fullmatch(r"[a-f0-9]{64}", expected_sha256) or digest != expected_sha256):
        raise ValueError("source_integrity_failed")
    try:
        metadata = MediaProbe().probe(path)
    except FFProbeUnavailableError:
        raise ValueError("media_tools_unavailable") from None
    except MediaProbeError as error:
        raise ValueError("media_timeout" if isinstance(error.__cause__, subprocess.TimeoutExpired) else "invalid_media") from None
    duration = metadata.duration_seconds
    if duration is None or not math.isfinite(duration) or not 0 < duration <= max_seconds:
        raise ValueError("unsupported_duration")
    if not any(s.codec_type == "video" and s.codec_name in {"h264", "hevc", "vp8", "vp9", "av1", "mpeg4"} for s in metadata.streams):
        raise ValueError("unsupported_codec")
    if any((s.width or 0) > 7680 or (s.height or 0) > 4320 for s in metadata.streams):
        raise ValueError("unsupported_resolution")
    if not any(s.codec_type == "audio" for s in metadata.streams):
        return {"manifest": prepare_evidence_manifest(job_id=job_id, duration_sec=duration, transcript=None, frames=[], private_root=path.parent, source_sha256=digest),
                "hasAudio": False, "transcriptionVersion": None}
    if provider_blocked:
        raise ValueError("provider_blocked")
    if model is None or model.is_symlink() or not model.is_file() or not 0 < model.stat().st_size <= 4 * 1024**3:
        raise ValueError("transcription_unavailable")
    with model.open("rb") as weights:
        model_version = "sha256:" + hashlib.file_digest(weights, "sha256").hexdigest()
    if scratch_root is not None and (scratch_root.is_symlink() or not scratch_root.is_dir() or scratch_root.resolve() != scratch_root.absolute()):
        raise ValueError("invalid_media")
    on_stage("transcribing")
    # Bounded source sampling: opening, middle and ending, up to 60 s each. No completeness claim.
    window = min(60.0, duration / 3)
    starts = sorted({0.0, max(0.0, duration / 2 - window / 2), max(0.0, duration - window)})
    segments: list[dict[str, object]] = []
    with tempfile.TemporaryDirectory(prefix="work-", dir=scratch_root or path.parent) as scratch:
        root = Path(scratch)
        for index, start in enumerate(starts):
            wav = root / f"audio-{index}.wav"
            try:
                AudioExtractor(timeout_seconds=120).extract(path, wav, source_start_sec=start, source_duration_sec=window)
            except AudioToolUnavailableError:
                raise ValueError("media_tools_unavailable") from None
            except AudioError as error:
                raise ValueError("media_timeout" if isinstance(error.__cause__, subprocess.TimeoutExpired) else "invalid_media") from None
            output = root / f"transcript-{index}"
            try:
                completed = run_bounded(["whisper-cli", "-m", str(model), "-f", str(wav), "-l", "auto", "-oj", "-of", str(output), "-np", "-t", "2", "-p", "1"],
                                        timeout=180, max_output=2_000_000, max_file_bytes=2_000_000)
            except subprocess.TimeoutExpired:
                raise ValueError("transcription_timeout") from None
            except (OSError, ValueError):
                raise ValueError("transcription_unavailable") from None
            if completed.returncode != 0:
                raise ValueError("transcription_unavailable")
            json_path = output.with_suffix(".json")
            if json_path.is_symlink() or not json_path.is_file() or json_path.stat().st_size > 2_000_000:
                raise ValueError("transcript_invalid")
            try:
                with json_path.open("rb") as content:
                    bounded = content.read(2_000_001)
                if len(bounded) > 2_000_000:
                    raise ValueError("transcript_invalid")
                payload = json.loads(bounded)
            except (ValueError, UnicodeError):
                raise ValueError("transcript_invalid") from None
            if not isinstance(payload, dict) or not isinstance(payload.get("transcription"), list) or len(payload["transcription"]) > 2000:
                raise ValueError("transcript_invalid")
            for raw in payload["transcription"]:
                if not isinstance(raw, dict) or not isinstance(raw.get("text"), str) or len(raw["text"]) > 10_000:
                    raise ValueError("transcript_invalid")
                text = raw.get("text", "").strip()
                if not text or text.startswith("[") and text.endswith("]"):
                    continue
                offsets = raw.get("offsets")
                if not isinstance(offsets, dict) or any(type(offsets.get(k)) not in (int, float) or not math.isfinite(offsets[k]) for k in ("from", "to")):
                    raise ValueError("transcript_invalid")
                lo = start + offsets["from"] / 1000
                hi = start + offsets["to"] / 1000
                if not start <= lo < hi <= min(duration, start + window):
                    raise ValueError("transcript_invalid")
                segments.append({"start_sec": lo, "end_sec": hi, "text": text})
                if len(segments) > 2000:
                    raise ValueError("transcript_invalid")
        transcript = parse_transcription_payload({"segments": segments, "limitations": ["Sampled offline ASR; speaker identity and visual activity unassessed."]},
                                                  duration_seconds=duration, provider_name="whisper-local", provider_version=model_version)
        return {"manifest": prepare_evidence_manifest(job_id=job_id, duration_sec=duration, transcript=transcript, frames=[], private_root=root, source_sha256=digest),
                "hasAudio": True, "transcriptionVersion": model_version}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--model", type=Path)
    parser.add_argument("--scratch", type=Path)
    parser.add_argument("--max-seconds", type=int, default=7200)
    parser.add_argument("--max-bytes", type=int, default=2_147_483_648)
    parser.add_argument("--expected-sha256")
    parser.add_argument("--expected-bytes", type=int)
    parser.add_argument("--provider-blocked", action="store_true")
    args = parser.parse_args()
    try:
        os.umask(0o077)
        result = prepare_recording(args.path, job_id=args.job_id, model=args.model, scratch_root=args.scratch,
                                   max_seconds=args.max_seconds, max_bytes=args.max_bytes, provider_blocked=args.provider_blocked,
                                   expected_sha256=args.expected_sha256, expected_bytes=args.expected_bytes,
                                   on_stage=lambda stage: print(f"stage:{stage}", file=sys.stderr, flush=True))
        print(json.dumps(result))
        return 0
    except Exception as error:
        # No stderr from media/ASR providers, paths, transcript text or traceback enters logs.
        allowed = {"invalid_media", "unsupported_duration", "unsupported_codec", "unsupported_resolution", "transcription_unavailable",
                   "transcription_timeout", "transcript_invalid", "media_timeout", "media_tools_unavailable", "provider_blocked", "source_integrity_failed"}
        code = str(error) if isinstance(error, ValueError) and str(error) in allowed else "media_preparation_failed"
        print(code, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
