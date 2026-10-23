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


def require_media_tools(ffmpeg_path: str = "ffmpeg", ffprobe_path: str = "ffprobe") -> MediaTools:
    ffmpeg = shutil.which(ffmpeg_path)
    ffprobe = shutil.which(ffprobe_path)
    missing = [name for name, path in (("ffmpeg", ffmpeg), ("ffprobe", ffprobe)) if path is None]
    if missing:
        raise MediaToolUnavailableError(f"Required media tool unavailable: {', '.join(missing)}")
    return MediaTools(ffmpeg=ffmpeg, ffprobe=ffprobe)
