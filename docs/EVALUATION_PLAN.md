# Humaniti AI — Evaluation Plan

Status: Stage 04 design complete; empirical inspection and calibration blocked pending legitimate dataset access.

## Current evidence status

- No Google Drive credentials or approved local recordings are available in the workspace.
- Stage 03 dataset-discovery handoff is absent, so no inventory, duration, codec, checksum, or organiser-supplied label may be claimed.
- No remote AI processor has documented organiser approval.
- The current plan therefore evaluates contracts and synthetic/unit fixtures only; it does not claim teaching-quality accuracy.

## Evaluation sequence

### 1. Authorised inventory

Use the Drive API with approved OAuth/service-account access or a user-approved private local folder. List metadata before copying media. Record only factual metadata: opaque file ID, sanitized display name if safe, size, MIME, duration, codec, checksum where permitted, access status, and whether a label was explicitly supplied. Never infer a label from a filename.

### 2. Representative inspection

Select a small spread of permitted recordings by factual metadata and explicitly supplied labels, if any. Inspect with local/private tools only unless the organiser approves a remote processor. Use `ffprobe` and bounded frame/audio extraction. Do not commit recordings, screenshots, transcripts, names, or child-identifying details.

For each inspected clip, record a redacted observation table:

| Field | Requirement |
|---|---|
| Clip reference | Internal opaque ID only; never a public URL or child name |
| Evidence ID | Stable, non-sensitive ID |
| Time range | Verified against the private source |
| Modality | Audio, transcript, video, or metadata |
| Observable event | Concrete paraphrase; no invented quotation |
| Rubric dimension | One or more supported dimensions |
| Counterevidence/uncertainty | Missing or contradictory signal stated explicitly |

### 3. Blinded rubric review

If organiser labels are absent, review 2–4 clips without labels and compare the usefulness and consistency of evidence-backed explanations. Do not claim classification accuracy. If labels are supplied, keep at least one clip held out and do not tune thresholds on it.

### 4. Timestamp audit

Before release, verify at least five report timestamps against private source moments using local tools. Check that each timestamp is within duration, modality is available, evidence ID exists, and the claim does not exceed what the source supports. Record only redacted audit outcomes.

### 5. Held-out test

Keep one permitted recording unseen by rubric/threshold tuning. Submit it through the same user path as a recruiter. Confirm that the result does not depend on filename, known label, or sample-specific code. Record the label, assessable dimensions, evidence coverage, limitations, and any failure without publishing media.

## Test matrix

| Case | Expected result |
|---|---|
| Clear audio/video and sufficient evidence | Evidence-backed scores and one deterministic label if essential dimensions are assessable |
| Missing transcript but usable video/metadata | Affected content dimensions are `not_assessable`; no automatic penalty |
| Missing video frames but usable audio/transcript | Visual dimensions are limited; no invented visual claims |
| Silent or unintelligible recording | Technical limitation, low evidence coverage, and no false pedagogical judgment |
| Corrupt/unsupported media | Safe failed job with no report fabricated |
| Provider unavailable or unapproved | Explicit blocked/unavailable result; no mock success |
| Malicious/private URL | Rejected before fetch; no SSRF or redirect exposure |
| Duplicate/restarted job | Idempotent durable state and no duplicate processing claim |
| Contradictory evidence | Claim rejected or limitation surfaced; no forced score |
| Held-out recording | Fresh end-to-end assessment independent of filename and known labels |

## Calibration and reporting rules

- Version the rubric and provider separately from the final report.
- Do not report accuracy, precision, recall, or expert validation without organiser labels and a defined test set.
- Do not move thresholds merely to create an even label distribution.
- Compare evidence quality, timestamp fidelity, uncertainty handling, and actionable recommendations before comparing labels.
- Keep technical usability at 10% so recording quality cannot silently dominate pedagogy.
- Treat all scores as decision support, not a guaranteed numerical grade or definitive judgment of a teacher.

## Stage 04 outcome

The rubric contract and evaluation procedure are implemented, but representative-video inspection, empirical calibration, and held-out evaluation remain **BLOCKED** until Stage 03 legitimately obtains permitted media and metadata.
