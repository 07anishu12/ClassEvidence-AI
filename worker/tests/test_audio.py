from __future__ import annotations

import stat
import wave
from array import array
from pathlib import Path

import pytest

from media.audio import (
    AudioExtractor,
    AudioToolUnavailableError,
    analyze_pcm_wav,
    audio_stream_present,
    diagnostics_for_missing_audio,
    redacted_audio_summary,
)


def _write_wav(path: Path, samples: list[int], sample_rate: int = 1000) -> None:
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(array("h", samples).tobytes())


def _fake_ffmpeg(tmp_path: Path, fixture_wav: Path) -> str:
    executable = tmp_path / "ffmpeg-fixture"
    executable.write_text(
        "#!/usr/bin/env python3\n"
        "import shutil, sys\n"
        f"shutil.copyfile({str(fixture_wav)!r}, sys.argv[-1])\n",
        encoding="utf-8",
    )
    executable.chmod(executable.stat().st_mode | stat.S_IXUSR)
    return str(executable)


def test_extracts_mono_audio_with_source_offset_metadata(tmp_path: Path) -> None:
    fixture = tmp_path / "fixture.wav"
    _write_wav(fixture, [1000] * 100)
    source = tmp_path / "lesson.mp4"
    source.write_bytes(b"private fixture")
    output = tmp_path / "private" / "audio.wav"

    extracted = AudioExtractor(_fake_ffmpeg(tmp_path, fixture)).extract(
        source,
        output,
        source_start_sec=2.5,
        source_duration_sec=10.0,
    )

    assert extracted.path == output
    assert extracted.source_start_sec == 2.5
    assert extracted.channels == 1
    assert output.read_bytes() == fixture.read_bytes()


def test_missing_ffmpeg_fails_without_echoing_media_data(tmp_path: Path) -> None:
    source = tmp_path / "lesson.mp4"
    source.write_bytes(b"private-content")
    with pytest.raises(AudioToolUnavailableError, match="ffmpeg is unavailable") as error:
        AudioExtractor(str(tmp_path / "missing-ffmpeg")).extract(
            source,
            tmp_path / "audio.wav",
            source_duration_sec=1.0,
        )
    assert "private-content" not in str(error.value)


def test_audio_diagnostics_detect_silence_clipping_and_possible_dropout(tmp_path: Path) -> None:
    wav_path = tmp_path / "diagnostics.wav"
    samples = [1000] * 300 + [0] * 100 + [1000] * 300 + [0] * 500 + [32767] * 10
    _write_wav(wav_path, samples)

    diagnostics = analyze_pcm_wav(wav_path, silence_min_seconds=0.4, window_seconds=0.1)

    assert diagnostics.has_audio is True
    assert diagnostics.silent_intervals
    assert diagnostics.dropout_intervals
    assert diagnostics.clipping_ratio is not None and diagnostics.clipping_ratio > 0
    summary = redacted_audio_summary(diagnostics)
    assert "private" not in str(summary)
    assert "path" not in summary


def test_audio_absence_is_a_limitation_not_a_zero_score() -> None:
    diagnostics = diagnostics_for_missing_audio(12.0)
    assert audio_stream_present([]) is False
    assert diagnostics.has_audio is False
    assert diagnostics.clipping_ratio is None
    assert "not_assessable" in diagnostics.limitations[0]
