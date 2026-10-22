from __future__ import annotations

import json
import stat
from pathlib import Path

import pytest

from humaniti_worker import (
    FFProbeUnavailableError,
    MediaProbe,
    MediaProbeOutputError,
    UnsupportedMediaTypeError,
    validate_supported_media_type,
)


def _fake_ffprobe(
    tmp_path: Path, output: str, *, returncode: int = 0
) -> str:
    executable = tmp_path / "ffprobe-fixture"
    executable.write_text(
        "#!/usr/bin/env python3\n"
        "import sys\n"
        f"sys.stdout.write({output!r})\n"
        f"sys.exit({returncode})\n",
        encoding="utf-8",
    )
    executable.chmod(executable.stat().st_mode | stat.S_IXUSR)
    return str(executable)


def _fixture_media(tmp_path: Path) -> Path:
    media = tmp_path / "lesson.mp4"
    media.write_bytes(b"synthetic fixture; not a recording")
    return media


def test_missing_ffprobe_fails_clearly_without_media_content(tmp_path: Path) -> None:
    media = _fixture_media(tmp_path)

    with pytest.raises(FFProbeUnavailableError, match="ffprobe is unavailable") as error:
        MediaProbe(str(tmp_path / "missing-ffprobe")).probe(media)

    assert "synthetic" not in str(error.value)


def test_malformed_ffprobe_output_fails_without_echoing_output(tmp_path: Path) -> None:
    media = _fixture_media(tmp_path)
    ffprobe = _fake_ffprobe(tmp_path, "not-json-media-content")

    with pytest.raises(MediaProbeOutputError, match="malformed JSON") as error:
        MediaProbe(ffprobe).probe(media)

    assert "not-json-media-content" not in str(error.value)


def test_valid_ffprobe_output_becomes_structured_metadata(tmp_path: Path) -> None:
    media = _fixture_media(tmp_path)
    ffprobe = _fake_ffprobe(
        tmp_path,
        json.dumps(
            {
                "format": {
                    "format_name": "matroska,webm",
                    "duration": "12.5",
                    "size": "1024",
                    "bit_rate": "65536",
                },
                "streams": [
                    {
                        "index": 0,
                        "codec_type": "video",
                        "codec_name": "vp9",
                        "duration": "12.5",
                        "width": 1280,
                        "height": 720,
                    },
                    {
                        "index": 1,
                        "codec_type": "audio",
                        "codec_name": "opus",
                        "duration": "12.4",
                        "sample_rate": "48000",
                        "channels": 2,
                    },
                ],
            }
        ),
    )

    metadata = MediaProbe(ffprobe).probe(media)

    assert metadata.format_name == "matroska,webm"
    assert metadata.duration_seconds == 12.5
    assert metadata.size_bytes == 1024
    assert metadata.streams[0].width == 1280
    assert metadata.streams[1].sample_rate_hz == 48000


@pytest.mark.parametrize(
    ("filename", "mime_type", "extension"),
    [
        ("lesson.mp4", "video/mp4", ".mp4"),
        ("lesson.mov", "video/quicktime", ".mov"),
        ("lesson.webm", "video/webm; codecs=vp9", ".webm"),
    ],
)
def test_supported_media_types_are_validated(
    filename: str, mime_type: str, extension: str
) -> None:
    result = validate_supported_media_type(filename, mime_type)

    assert result.extension == extension


@pytest.mark.parametrize(
    ("filename", "mime_type"),
    [("lesson.mp4", "video/webm"), ("lesson.avi", "video/x-msvideo")],
)
def test_unsupported_or_mismatched_media_types_are_rejected(
    filename: str, mime_type: str
) -> None:
    with pytest.raises(UnsupportedMediaTypeError, match="unsupported or mismatched"):
        validate_supported_media_type(filename, mime_type)
