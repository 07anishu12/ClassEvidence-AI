from __future__ import annotations

import pytest

from analysis.transcribe import (
    BlockedTranscriber,
    TranscriptSchemaError,
    TranscriptionUnavailableError,
    parse_transcription_payload,
    redacted_transcript_summary,
)


def test_valid_segments_keep_offsets_and_mark_speakers_uncertain() -> None:
    result = parse_transcription_payload(
        {
            "segments": [
                {
                    "start_sec": 1.25,
                    "end_sec": 3.5,
                    "text": "Explain your reasoning.",
                    "speaker_id": "speaker_teacher",
                    "speaker_confidence": 0.92,
                }
            ],
            "limitations": [],
        },
        duration_seconds=10.0,
        provider_name="local-test",
        provider_version="0.1",
    )

    segment = result.segments[0]
    assert segment.segment_id == "segment_000001"
    assert segment.start_sec == 1.25
    assert segment.end_sec == 3.5
    assert segment.diarization_uncertain is True
    summary = redacted_transcript_summary(result)
    assert summary["text_logged"] is False
    assert "Explain" not in str(summary)


def test_speaker_identity_is_not_fabricated_when_absent() -> None:
    result = parse_transcription_payload(
        {"segments": [{"start_sec": 0, "end_sec": 1, "text": "Hello"}]},
        duration_seconds=1.0,
        provider_name="local-test",
        provider_version="0.1",
    )
    assert result.segments[0].speaker_id is None
    assert result.segments[0].diarization_uncertain is False


@pytest.mark.parametrize(
    "segment",
    [
        {"start_sec": -0.1, "end_sec": 1, "text": "bad"},
        {"start_sec": 0, "end_sec": 2, "text": "outside"},
        {"start_sec": 1, "end_sec": 1, "text": "empty interval"},
        {"start_sec": 0, "end_sec": 1, "text": "bad", "speaker_id": "child name"},
    ],
)
def test_invalid_offsets_or_speaker_labels_are_rejected(segment: dict[str, object]) -> None:
    with pytest.raises(TranscriptSchemaError):
        parse_transcription_payload(
            {"segments": [segment]},
            duration_seconds=1.5,
            provider_name="local-test",
            provider_version="0.1",
        )


def test_blocked_transcriber_never_returns_fake_text() -> None:
    with pytest.raises(TranscriptionUnavailableError):
        BlockedTranscriber().transcribe("/private/audio.wav", 10.0)
