"""Real FFmpeg checks on synthetic generated media, never teaching examples."""
import shutil
import subprocess
import wave
from array import array
from pathlib import Path

import pytest

from media.audio import AudioExtractor
from media.pipeline import prepare_recording

pytestmark = pytest.mark.skipif(not shutil.which("ffmpeg") or not shutil.which("ffprobe"), reason="local media tools unavailable")


def test_extraction_really_seeks_and_bounds_source_audio(tmp_path: Path) -> None:
    source = tmp_path / "synthetic.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=c=black:s=160x120:d=2",
                    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=16000:duration=1",
                    "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=16000:duration=1",
                    "-filter_complex", "[1:a][2:a]concat=n=2:v=0:a=1[a]", "-map", "0:v", "-map", "[a]",
                    "-c:v", "libx264", "-c:a", "aac", "-y", str(source)], check=True, capture_output=True, timeout=30)
    output = tmp_path / "clip.wav"
    AudioExtractor().extract(source, output, source_start_sec=1.2, source_duration_sec=0.3)
    with wave.open(str(output), "rb") as wav:
        samples = array("h", wav.readframes(wav.getnframes()))
        duration = wav.getnframes() / wav.getframerate()
    crossings = sum((a < 0) != (b < 0) for a, b in zip(samples, samples[1:]))
    assert abs(duration - 0.3) < 0.001
    assert 700 < crossings / 2 / duration < 1000


def test_real_silent_video_has_no_invented_transcript(tmp_path: Path) -> None:
    source = tmp_path / "synthetic-silent.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=c=black:s=160x120:d=1",
                    "-an", "-c:v", "libx264", "-y", str(source)], check=True, capture_output=True, timeout=30)
    result = prepare_recording(source, job_id="job_synthetic", model=tmp_path / "not-needed")
    assert result["manifest"]["artifacts"] == []
    assert result["hasAudio"] is False
