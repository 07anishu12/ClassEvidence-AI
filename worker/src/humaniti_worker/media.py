"""Safe ffprobe access and supported media-type validation.

This module only reads structured metadata from a local path. It does not
decode, upload, transcribe, or log media content.
"""

from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from humaniti_worker.process import run_bounded


class MediaProbeError(RuntimeError):
    """Base error for safe media probing failures."""


class FFProbeUnavailableError(MediaProbeError):
    """Raised when the configured ffprobe executable is not available."""


class MediaProbeInputError(MediaProbeError):
    """Raised when the local media input is not a readable regular file."""


class MediaProbeExecutionError(MediaProbeError):
    """Raised when ffprobe cannot complete successfully."""


class MediaProbeOutputError(MediaProbeError):
    """Raised when ffprobe output is not valid structured metadata."""


class UnsupportedMediaTypeError(MediaProbeError):
    """Raised when a filename and MIME type are not a supported pair."""


@dataclass(frozen=True, slots=True)
class SupportedMediaType:
    """A supported filename extension and its corresponding MIME type."""

    extension: str
    mime_type: str


SUPPORTED_MEDIA_TYPES: tuple[SupportedMediaType, ...] = (
    SupportedMediaType(".mp4", "video/mp4"),
    SupportedMediaType(".mov", "video/quicktime"),
    SupportedMediaType(".webm", "video/webm"),
)

_MEDIA_TYPES_BY_EXTENSION = {
    media_type.extension: media_type for media_type in SUPPORTED_MEDIA_TYPES
}


def validate_supported_media_type(
    filename: str, mime_type: str
) -> SupportedMediaType:
    """Validate an explicitly supported extension/MIME pair.

    MIME parameters are ignored after the media type, while the extension and
    MIME value must still agree. Content validation remains the probe's job.
    """

    extension = Path(filename).suffix.lower()
    normalized_mime = mime_type.split(";", 1)[0].strip().lower()
    expected = _MEDIA_TYPES_BY_EXTENSION.get(extension)
    if expected is None or normalized_mime != expected.mime_type:
        raise UnsupportedMediaTypeError("unsupported or mismatched media type")
    return expected


@dataclass(frozen=True, slots=True)
class MediaStream:
    """Structured metadata for one ffprobe stream."""

    index: int | None
    codec_type: str | None
    codec_name: str | None
    duration_seconds: float | None
    width: int | None
    height: int | None
    sample_rate_hz: int | None
    channels: int | None


@dataclass(frozen=True, slots=True)
class MediaMetadata:
    """Structured media metadata returned by ffprobe."""

    format_name: str | None
    duration_seconds: float | None
    size_bytes: int | None
    bit_rate_bps: int | None
    streams: tuple[MediaStream, ...]


def _optional_string(value: Any, field: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise MediaProbeOutputError(f"ffprobe field {field} has an invalid type")
    return value or None


def _optional_float(value: Any, field: str) -> float | None:
    if value is None:
        return None
    if isinstance(value, str) and value.strip().upper() in {"", "N/A"}:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise MediaProbeOutputError(f"ffprobe field {field} is not numeric") from exc
    if not math.isfinite(number):
        raise MediaProbeOutputError(f"ffprobe field {field} is not finite")
    return number


def _optional_int(value: Any, field: str) -> int | None:
    if value is None:
        return None
    if isinstance(value, str) and value.strip().upper() in {"", "N/A"}:
        return None
    if isinstance(value, bool):
        raise MediaProbeOutputError(f"ffprobe field {field} is not an integer")
    try:
        number = int(value)
    except (OverflowError, TypeError, ValueError) as exc:
        raise MediaProbeOutputError(f"ffprobe field {field} is not an integer") from exc
    if isinstance(value, float) and value != number:
        raise MediaProbeOutputError(f"ffprobe field {field} is not an integer")
    return number


def _parse_stream(raw_stream: Any, position: int) -> MediaStream:
    if not isinstance(raw_stream, dict):
        raise MediaProbeOutputError(f"ffprobe stream {position} is malformed")
    return MediaStream(
        index=_optional_int(raw_stream.get("index"), f"streams[{position}].index"),
        codec_type=_optional_string(
            raw_stream.get("codec_type"), f"streams[{position}].codec_type"
        ),
        codec_name=_optional_string(
            raw_stream.get("codec_name"), f"streams[{position}].codec_name"
        ),
        duration_seconds=_optional_float(
            raw_stream.get("duration"), f"streams[{position}].duration"
        ),
        width=_optional_int(raw_stream.get("width"), f"streams[{position}].width"),
        height=_optional_int(raw_stream.get("height"), f"streams[{position}].height"),
        sample_rate_hz=_optional_int(
            raw_stream.get("sample_rate"), f"streams[{position}].sample_rate"
        ),
        channels=_optional_int(
            raw_stream.get("channels"), f"streams[{position}].channels"
        ),
    )


def _parse_metadata(payload: Any) -> MediaMetadata:
    if not isinstance(payload, dict):
        raise MediaProbeOutputError("ffprobe output is not a JSON object")

    raw_format = payload.get("format", {})
    if raw_format is None:
        raw_format = {}
    if not isinstance(raw_format, dict):
        raise MediaProbeOutputError("ffprobe format metadata is malformed")

    raw_streams = payload.get("streams", [])
    if not isinstance(raw_streams, list):
        raise MediaProbeOutputError("ffprobe streams metadata is malformed")

    return MediaMetadata(
        format_name=_optional_string(raw_format.get("format_name"), "format.format_name"),
        duration_seconds=_optional_float(
            raw_format.get("duration"), "format.duration"
        ),
        size_bytes=_optional_int(raw_format.get("size"), "format.size"),
        bit_rate_bps=_optional_int(raw_format.get("bit_rate"), "format.bit_rate"),
        streams=tuple(_parse_stream(stream, index) for index, stream in enumerate(raw_streams)),
    )


class MediaProbe:
    """Run a bounded, non-shell ffprobe command and parse JSON metadata."""

    def __init__(self, ffprobe_path: str = "ffprobe", timeout_seconds: float = 30.0):
        if not math.isfinite(timeout_seconds) or timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")
        self._ffprobe_path = ffprobe_path
        self._timeout_seconds = timeout_seconds

    def probe(self, media_path: str | Path) -> MediaMetadata:
        """Probe a local media file without logging its path or contents."""

        configured_path = Path(self._ffprobe_path)
        executable = (
            str(configured_path)
            if configured_path.parent != Path(".")
            and configured_path.is_file()
            and os.access(configured_path, os.X_OK)
            else shutil.which(self._ffprobe_path)
        )
        if executable is None:
            raise FFProbeUnavailableError("ffprobe is unavailable")

        path = Path(media_path)
        if path.is_symlink() or not path.is_file():
            raise MediaProbeInputError("media input is not a readable regular file")

        command = [
            executable,
            "-protocol_whitelist",
            "file,pipe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_entries",
            "format=format_name,duration,size,bit_rate:stream=index,codec_type,codec_name,duration,width,height,sample_rate,channels",
            str(path),
        ]
        try:
            completed = run_bounded(command, timeout=self._timeout_seconds)
        except FileNotFoundError as exc:
            raise FFProbeUnavailableError("ffprobe is unavailable") from exc
        except PermissionError as exc:
            raise MediaProbeExecutionError("ffprobe could not be executed") from exc
        except subprocess.TimeoutExpired as exc:
            raise MediaProbeExecutionError("ffprobe timed out") from exc
        except OSError as exc:
            raise MediaProbeExecutionError("ffprobe could not be executed") from exc
        except UnicodeError as exc:
            raise MediaProbeOutputError("ffprobe returned undecodable output") from exc
        except ValueError as exc:
            raise MediaProbeOutputError("ffprobe output limit exceeded") from exc
        if completed.returncode != 0:
            raise MediaProbeExecutionError(
                f"ffprobe exited with status {completed.returncode}"
            )

        try:
            payload = json.loads(completed.stdout)
        except (json.JSONDecodeError, UnicodeError) as exc:
            raise MediaProbeOutputError("ffprobe returned malformed JSON") from exc
        return _parse_metadata(payload)
