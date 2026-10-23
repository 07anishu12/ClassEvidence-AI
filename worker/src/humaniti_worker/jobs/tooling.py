"""Availability checks for local media tools."""

from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path


class MediaToolUnavailableError(RuntimeError):
    """Raised before a job starts when a required local tool is unavailable."""


@dataclass(frozen=True, slots=True)
class MediaTools:
    ffmpeg: str
    ffprobe: str


def resolve_executable(configured_path: str) -> str | None:
    candidate = Path(configured_path)
    if candidate.parent != Path("."):
        if candidate.is_file() and candidate.stat().st_mode & 0o111:
            return str(candidate)
        return None
    return shutil.which(configured_path)


def require_media_tools(ffmpeg_path: str = "ffmpeg", ffprobe_path: str = "ffprobe") -> MediaTools:
    ffmpeg = resolve_executable(ffmpeg_path)
    ffprobe = resolve_executable(ffprobe_path)
    missing = [name for name, path in (("ffmpeg", ffmpeg), ("ffprobe", ffprobe)) if path is None]
    if missing:
        raise MediaToolUnavailableError(f"Required media tool unavailable: {', '.join(missing)}")
    return MediaTools(ffmpeg=ffmpeg, ffprobe=ffprobe)
