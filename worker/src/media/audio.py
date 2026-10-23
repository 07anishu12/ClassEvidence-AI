"""Private mono-audio extraction and deterministic technical diagnostics."""

from __future__ import annotations

import math
import subprocess
import wave
from array import array
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from humaniti_worker.jobs.tooling import resolve_executable
from humaniti_worker.process import run_bounded


class AudioError(RuntimeError):
    """Base error for safe audio extraction/analysis failures."""


class AudioToolUnavailableError(AudioError):
    """Raised when the configured local ffmpeg executable is unavailable."""


class AudioExtractionError(AudioError):
    """Raised when bounded ffmpeg extraction fails."""


class AudioInputError(AudioError):
    """Raised when an audio input or WAV artifact is invalid."""


@dataclass(frozen=True, slots=True)
class AudioInterval:
    start_sec: float
    end_sec: float
    reason: str


@dataclass(frozen=True, slots=True)
class AudioDiagnostics:
    duration_seconds: float
    sample_rate_hz: int | None
    has_audio: bool
    silent_intervals: tuple[AudioInterval, ...]
    dropout_intervals: tuple[AudioInterval, ...]
    clipping_ratio: float | None
    limitations: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class ExtractedAudio:
    path: Path
    source_start_sec: float
    source_duration_sec: float
    sample_rate_hz: int
    channels: int


def audio_stream_present(streams: Iterable[object]) -> bool:
    return any(getattr(stream, "codec_type", None) == "audio" for stream in streams)


def diagnostics_for_missing_audio(duration_seconds: float) -> AudioDiagnostics:
    if not math.isfinite(duration_seconds) or duration_seconds < 0:
        raise ValueError("duration_seconds must be finite and non-negative")
    return AudioDiagnostics(
        duration_seconds=duration_seconds,
        sample_rate_hz=None,
        has_audio=False,
        silent_intervals=(),
        dropout_intervals=(),
        clipping_ratio=None,
        limitations=("No audio stream is available; speech and transcript dimensions are not_assessable.",),
    )


class AudioExtractor:
    """Extract mono PCM while preserving source timing as external metadata."""

    def __init__(
        self,
        ffmpeg_path: str = "ffmpeg",
        *,
        sample_rate_hz: int = 16_000,
        timeout_seconds: float = 300.0,
    ) -> None:
        if not 1 <= sample_rate_hz <= 192_000 or not math.isfinite(timeout_seconds) or timeout_seconds <= 0:
            raise ValueError("sample rate and timeout must be positive")
        self._ffmpeg_path = ffmpeg_path
        self._sample_rate_hz = sample_rate_hz
        self._timeout_seconds = timeout_seconds

    def extract(
        self,
        input_path: str | Path,
        output_path: str | Path,
        *,
        source_start_sec: float = 0.0,
        source_duration_sec: float,
    ) -> ExtractedAudio:
        input_file = Path(input_path)
        output_file = Path(output_path)
        if input_file.is_symlink() or not input_file.is_file() or output_file.is_symlink():
            raise AudioInputError("media input is not a readable regular file")
        if not math.isfinite(source_start_sec) or source_start_sec < 0:
            raise ValueError("source_start_sec must be finite and non-negative")
        if not math.isfinite(source_duration_sec) or not 0 < source_duration_sec <= 7200:
            raise ValueError("source_duration_sec must be finite and positive")
        executable = resolve_executable(self._ffmpeg_path)
        if executable is None:
            raise AudioToolUnavailableError("ffmpeg is unavailable")
        output_file.parent.mkdir(parents=True, exist_ok=True)
        command = [
            executable,
            "-hide_banner",
            "-loglevel",
            "error",
            "-nostdin",
            "-threads",
            "2",
            "-protocol_whitelist",
            "file,pipe",
            "-ss",
            str(source_start_sec),
            "-i",
            str(input_file),
            "-t",
            str(source_duration_sec),
            "-map",
            "0:a:0?",
            "-vn",
            "-threads",
            "2",
            "-ac",
            "1",
            "-ar",
            str(self._sample_rate_hz),
            "-c:a",
            "pcm_s16le",
            "-f",
            "wav",
            "-y",
            str(output_file),
        ]
        try:
            completed = run_bounded(command, timeout=self._timeout_seconds,
                                    max_file_bytes=math.ceil(source_duration_sec * self._sample_rate_hz * 2) + 65536)
        except subprocess.TimeoutExpired as error:
            raise AudioExtractionError("ffmpeg audio extraction timed out") from error
        except (OSError, UnicodeError, ValueError) as error:
            raise AudioExtractionError("ffmpeg audio extraction could not execute") from error
        if completed.returncode != 0:
            raise AudioExtractionError(f"ffmpeg audio extraction failed with status {completed.returncode}")
        if not output_file.is_file() or output_file.stat().st_size == 0:
            raise AudioExtractionError("ffmpeg produced no audio artifact")
        return ExtractedAudio(
            path=output_file,
            source_start_sec=source_start_sec,
            source_duration_sec=source_duration_sec,
            sample_rate_hz=self._sample_rate_hz,
            channels=1,
        )


def analyze_pcm_wav(
    wav_path: str | Path,
    *,
    silence_threshold: int = 250,
    silence_min_seconds: float = 0.4,
    window_seconds: float = 0.1,
) -> AudioDiagnostics:
    """Measure silence/clipping and flag short low-amplitude gaps as possible dropouts."""

    if silence_threshold < 0 or silence_min_seconds <= 0 or window_seconds <= 0:
        raise ValueError("audio analysis thresholds must be positive")
    try:
        with wave.open(str(wav_path), "rb") as source:
            if source.getnchannels() != 1 or source.getsampwidth() != 2:
                raise AudioInputError("WAV must be mono 16-bit PCM")
            sample_rate = source.getframerate()
            total_frames = source.getnframes()
            if sample_rate <= 0:
                raise AudioInputError("WAV sample rate is invalid")
            window_frames = max(1, int(sample_rate * window_seconds))
            silent_windows: list[tuple[float, float]] = []
            clipped_samples = 0
            total_samples = 0
            frame_offset = 0
            while frame_offset < total_frames:
                frame_count = min(window_frames, total_frames - frame_offset)
                samples = array("h", source.readframes(frame_count))
                if len(samples) != frame_count:
                    raise AudioInputError("WAV ended before the declared frame count")
                total_samples += len(samples)
                clipped_samples += sum(1 for sample in samples if abs(sample) >= 32_760)
                mean_square = sum(sample * sample for sample in samples) / max(1, len(samples))
                rms = math.sqrt(mean_square)
                start = frame_offset / sample_rate
                end = (frame_offset + frame_count) / sample_rate
                if rms <= silence_threshold:
                    silent_windows.append((start, end))
                frame_offset += frame_count
    except FileNotFoundError as error:
        raise AudioInputError("WAV artifact is missing") from error
    except wave.Error as error:
        raise AudioInputError("WAV artifact is invalid") from error

    duration = total_frames / sample_rate
    silent_spans = _merge_intervals(silent_windows, max_gap_seconds=window_seconds * 1.5)
    silent_intervals = tuple(
        AudioInterval(start, end, "low_amplitude")
        for start, end in silent_spans
        if end - start >= silence_min_seconds
    )
    dropout_intervals = tuple(
        AudioInterval(start, end, "possible_short_dropout")
        for start, end in silent_spans
        if 0.05 <= end - start < silence_min_seconds
    )
    clipping_ratio = clipped_samples / total_samples if total_samples else None
    limitations: list[str] = []
    if silent_intervals:
        limitations.append("Low-amplitude intervals were detected; silence may be intentional.")
    if dropout_intervals:
        limitations.append("Brief low-amplitude gaps may indicate dropouts but are not definitive.")
    if clipping_ratio is not None and clipping_ratio > 0.001:
        limitations.append("Clipping was detected in the extracted audio.")
    if not total_samples:
        limitations.append("The extracted audio contains no samples.")
    return AudioDiagnostics(
        duration_seconds=duration,
        sample_rate_hz=sample_rate,
        has_audio=bool(total_samples),
        silent_intervals=silent_intervals,
        dropout_intervals=dropout_intervals,
        clipping_ratio=clipping_ratio,
        limitations=tuple(limitations),
    )


def _merge_intervals(
    intervals: list[tuple[float, float]], *, max_gap_seconds: float
) -> list[tuple[float, float]]:
    if not intervals:
        return []
    merged: list[list[float]] = [[intervals[0][0], intervals[0][1]]]
    for start, end in intervals[1:]:
        current = merged[-1]
        if start - current[1] <= max_gap_seconds:
            current[1] = end
        else:
            merged.append([start, end])
    return [(start, end) for start, end in merged]


def redacted_audio_summary(diagnostics: AudioDiagnostics) -> dict[str, object]:
    """Return safe metrics for logs without paths or audio content."""

    return {
        "duration_seconds": round(diagnostics.duration_seconds, 3),
        "sample_rate_hz": diagnostics.sample_rate_hz,
        "has_audio": diagnostics.has_audio,
        "silent_interval_count": len(diagnostics.silent_intervals),
        "dropout_interval_count": len(diagnostics.dropout_intervals),
        "clipping_ratio": diagnostics.clipping_ratio,
        "limitation_count": len(diagnostics.limitations),
    }
