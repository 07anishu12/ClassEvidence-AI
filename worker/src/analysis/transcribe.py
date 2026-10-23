"""Strict transcript parsing with bounded offsets and privacy-safe summaries."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Protocol


class TranscriptionError(RuntimeError):
    """Base error for transcription boundary failures."""


class TranscriptionUnavailableError(TranscriptionError):
    """Raised when no permitted local/approved transcription provider exists."""


class TranscriptSchemaError(TranscriptionError):
    """Raised when provider output is missing or contains unsupported data."""


@dataclass(frozen=True, slots=True)
class TranscriptSegment:
    segment_id: str
    start_sec: float
    end_sec: float
    text: str
    language: str | None
    speaker_id: str | None
    speaker_confidence: float | None
    diarization_uncertain: bool


@dataclass(frozen=True, slots=True)
class TranscriptResult:
    provider_name: str
    provider_version: str
    segments: tuple[TranscriptSegment, ...]
    limitations: tuple[str, ...]


class Transcriber(Protocol):
    provider_name: str

    def transcribe(self, audio_path: str, duration_seconds: float) -> TranscriptResult:
        ...


class BlockedTranscriber:
    provider_name = "blocked"

    def transcribe(self, audio_path: str, duration_seconds: float) -> TranscriptResult:
        raise TranscriptionUnavailableError(
            "No organiser-approved local or remote transcription provider is configured."
        )


def parse_transcription_payload(
    payload: object,
    *,
    duration_seconds: float,
    provider_name: str,
    provider_version: str,
) -> TranscriptResult:
    """Validate provider JSON without correcting offsets or inventing speakers."""

    if not math.isfinite(duration_seconds) or duration_seconds <= 0:
        raise ValueError("duration_seconds must be finite and positive")
    if not isinstance(payload, dict):
        raise TranscriptSchemaError("transcription output must be an object")
    allowed_top_level = {"segments", "limitations"}
    unexpected = set(payload) - allowed_top_level
    if unexpected:
        raise TranscriptSchemaError("transcription output contains unsupported fields")
    raw_segments = payload.get("segments")
    if not isinstance(raw_segments, list):
        raise TranscriptSchemaError("transcription segments must be a list")
    if len(raw_segments) > 10_000:
        raise TranscriptSchemaError("transcription contains too many segments")
    limitations = _parse_limitations(payload.get("limitations", []))
    segments: list[TranscriptSegment] = []
    previous_end = 0.0
    for index, raw_segment in enumerate(raw_segments, start=1):
        segment = _parse_segment(raw_segment, index, duration_seconds)
        if segment.start_sec < previous_end:
            limitations.append("Transcript segments overlap; source ordering is retained but uncertain.")
        previous_end = max(previous_end, segment.end_sec)
        segments.append(segment)
    return TranscriptResult(
        provider_name=_safe_provider_value(provider_name, "provider_name"),
        provider_version=_safe_provider_value(provider_version, "provider_version"),
        segments=tuple(segments),
        limitations=tuple(dict.fromkeys(limitations)),
    )


def redacted_transcript_summary(result: TranscriptResult) -> dict[str, object]:
    """Return metadata for logs without transcript text, names, or identifiers."""

    return {
        "provider": result.provider_name,
        "provider_version": result.provider_version,
        "segment_count": len(result.segments),
        "duration_seconds": round(max((segment.end_sec for segment in result.segments), default=0.0), 3),
        "language_count": len({segment.language for segment in result.segments if segment.language}),
        "speaker_label_count": sum(1 for segment in result.segments if segment.speaker_id),
        "uncertain_diarization_count": sum(
            1 for segment in result.segments if segment.diarization_uncertain
        ),
        "limitation_count": len(result.limitations),
        "text_logged": False,
    }


def _parse_segment(raw_segment: object, index: int, duration_seconds: float) -> TranscriptSegment:
    if not isinstance(raw_segment, dict):
        raise TranscriptSchemaError(f"segment {index} must be an object")
    allowed = {
        "id",
        "start_sec",
        "end_sec",
        "text",
        "language",
        "speaker_id",
        "speaker_confidence",
    }
    if set(raw_segment) - allowed:
        raise TranscriptSchemaError(f"segment {index} contains unsupported fields")
    segment_id = raw_segment.get("id", f"segment_{index:06d}")
    if not isinstance(segment_id, str) or not re.fullmatch(r"segment_[A-Za-z0-9_-]{1,64}", segment_id):
        raise TranscriptSchemaError(f"segment {index} has an invalid ID")
    start = _number(raw_segment.get("start_sec"), f"segment {index} start_sec")
    end = _number(raw_segment.get("end_sec"), f"segment {index} end_sec")
    if start < 0 or end <= start or end > duration_seconds:
        raise TranscriptSchemaError(f"segment {index} offsets are outside the audio duration")
    text = raw_segment.get("text")
    if not isinstance(text, str) or not text.strip() or len(text) > 10_000:
        raise TranscriptSchemaError(f"segment {index} text is invalid")
    language = raw_segment.get("language")
    if language is not None and (not isinstance(language, str) or len(language) > 32):
        raise TranscriptSchemaError(f"segment {index} language is invalid")
    speaker_id = raw_segment.get("speaker_id")
    if speaker_id is not None and (
        not isinstance(speaker_id, str)
        or not re.fullmatch(r"speaker_[A-Za-z0-9_-]{1,64}", speaker_id)
    ):
        raise TranscriptSchemaError(f"segment {index} speaker ID must be opaque")
    speaker_confidence = raw_segment.get("speaker_confidence")
    if speaker_confidence is not None:
        speaker_confidence = _number(speaker_confidence, f"segment {index} speaker_confidence")
        if not 0 <= speaker_confidence <= 1:
            raise TranscriptSchemaError(f"segment {index} speaker confidence is invalid")
    return TranscriptSegment(
        segment_id=segment_id,
        start_sec=start,
        end_sec=end,
        text=text.strip(),
        language=language,
        speaker_id=speaker_id,
        speaker_confidence=speaker_confidence,
        diarization_uncertain=speaker_id is not None,
    )


def _parse_limitations(value: object) -> list[str]:
    if not isinstance(value, list) or len(value) > 50:
        raise TranscriptSchemaError("limitations must be a list of at most 50 strings")
    if any(not isinstance(item, str) or not item.strip() or len(item) > 1000 for item in value):
        raise TranscriptSchemaError("limitations must contain non-empty strings")
    return [item.strip() for item in value]


def _number(value: object, field: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise TranscriptSchemaError(f"{field} must be finite numeric data")
    return float(value)


def _safe_provider_value(value: str, field: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,100}", value):
        raise TranscriptSchemaError(f"{field} is invalid")
    return value
