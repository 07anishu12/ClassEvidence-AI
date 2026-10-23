# Evaluation — Stage 16

## Review protocol

1. Obtain media through legitimate organiser Drive access or an authorised local upload. Keep originals, transcripts, labels and source identifiers under ignored mode-700 private storage. Public summaries contain aggregate results only.
2. Register a SHA-256 of actual file bytes and assign calibration or held-out status before running inference. Reject duplicate hashes across splits. Renaming a file never creates a new held-out example. Do not send filenames, folders, historical labels, review prose or expected grades to the model.
3. Freeze the rubric, model weight digest, transcript preparation and output schemas. Use the calibration recording for debugging; log each refinement. Run a distinct frozen held-out recording once with production mock disabled. A failed or insufficient-evidence result has no predicted quality label.
4. Have an independent human inspect at least five reported source moments per recording (or every moment if fewer). Check original audiovisual content, ASR wording, original-clock start/end, speaker attribution and whether the claim describes observed rather than mentioned activity. Record actual checked/error counts. Mechanical artifact/digest/timing checks do not count as human review.
5. Review both supporting and opposing evidence. Mark fabricated quotations, unsupported activity, contradictory interpretations, missing signals treated as faults and excluded teaching-quality proxies. Remove unsupported claims, revise broad rules on calibration data, version the changes and use a fresh hold-out after further tuning. Do not tune to an individual filename or desired grade.
6. Obtain independent rubric-0.1 labels with provenance before comparing labels. Historical categories or reviews using incompatible proxies are not automatically ground truth. In particular, do not map “Weak” to “Poor”, use appearance/happiness/lighting as teaching quality, or treat missing reference labels as a class.

## Executable audit

`python3 scripts/evaluate.py <private-manifest.json>` accepts only version, rubric version, synthetic flag and bounded records. Each record contains an opaque content checksum, split, terminal status, prediction or null, compatible verified reference or null, duration, source/artifact times and digests, plus optional actual human timestamp/claim audits. Unknown fields (including filename/name/private URL) fail. Duplicate content, fabricated source times/digests, invalid labels and fake AI-as-human audits fail with a safe error.

Output contains aggregate counts only. Confusion matrix is null without completed held-out predictions with explicit compatible verified labels. Human-error results are null when no human review occurred; zero is not fabricated. Model/ASR inference, media processing and application scoring remain in their existing boundaries; this script audits recorded results only.

Synthetic CLI smoke: `python3 scripts/evaluate.py tests/fixtures/evaluation.synthetic.json`. It is explicitly labelled synthetic and is never reported as recording accuracy.

## Current real evidence

The user authorised discovery through the PRD Drive folder. A permitted recording was downloaded through the normal browser UI and processed locally: 53,777,122 bytes, duration 2273.685333 seconds, with audio/video streams. Its filename, source URL, names and transcript are excluded here. The offline path samples up to three 60-second source windows, rather than claiming complete lesson coverage. Local whisper.cpp tiny multilingual ASR and Qwen3:4b run with cloud disabled; no remote AI approval or transfer occurred.

First production attempt reached the model but failed validation: a technical-usability score had no citations. The general output schema was tightened to require at least one citation per non-null rating and no citations for null scores. The second production attempt returned 15 grounded source observations, all with high uncertainty, and correctly withheld an overall label. High-uncertainty observations are now explicitly `not_assessable`, rather than negative teaching evidence. This protects missing/uncertain signals; it does not constitute successful classification.

A historical organiser review PDF was discovered privately. It uses partially incompatible categories/proxies; no compatible verified rubric-0.1 ground truth has been entered. No confusion matrix, classification accuracy, human timestamp accuracy or zero-false-claim rate is claimed. A distinct held-out download/run and independent human audit are pending; aggregate results will be appended only after actual execution.

## Release limitations

The current local ASR/text model has not established reliable semantic coverage. Referential grounding verifies source artifacts, not pedagogical truth, actual speaker identity or ASR correctness. A complete genuine four-way assessment on a permitted held-out input is still a release gate. Source-duration checks and original segment offsets are automatic; human timestamp and label review remain required. Hosted validation is separate and has not been performed.

### Auditability refinement

A fresh ASR pass did not reproduce the original segment timing registry exactly. Comparing the stored report with that different pass failed the audit, as it should. No mechanical-success count was claimed for the legacy report. New reports now retain their original artifact timing/digest registry and recording checksum, excluding full transcripts/frame payloads. This permits subsequent verification against the registry actually used during analysis; it still does not substitute for human audiovisual review.

## Final executed results

| Case | Adapter | Source duration | Result | Retained observations |
|---|---|---:|---|---:|
| Calibration | grounded-v2 | 2273.685333 s | insufficient_evidence | 12 |
| Initial held-out | earlier single-pass adapter | 3231.082667 s | scoring_invalid; no label | 0 |
| Fresh held-out, frozen after refinement | grounded-v2 | 3359.28 s | insufficient_evidence | 18 |

These are three distinct permitted content checksums; each final case appears once. Earlier calibration retries and the initial validation failure are retained in handoffs and private job history, rather than counted as independent recordings. The initial held-out failure remains a failure after refinement. The fresh split, local weight digest and relevant code digests were frozen privately before its inference. Neither filenames/folder labels nor historical review grades entered model input.

`python3 scripts/evaluate.py .private/evaluation/results.json` PASS: 3 recordings, 1 calibration and 2 held-out; 0 completed labels, 1 validation failure and 2 insufficient-evidence results. Thirty observations passed original-registry timestamp/digest checks. Human timestamp audit, human claim audit and confusion matrix are all null, not zero-error claims. No compatible verified reference labels exist.

The revised adapter extracts observations first, grounds them, then requests ratings restricted to allowed evidence IDs in each dimension. Unsupported/high-uncertainty signals stay unassessable. It did not establish enough reliable essential-dimension evidence on the tested recordings. The complete genuine four-label release gate is **FAIL**. Improve/validate a permitted local ASR/semantic stack (or obtain explicit organiser approval for another processor), obtain compatible independent reviews and use fresh held-out content before claiming success. Do not reduce evidence requirements to manufacture a grade.

Larger Drive downloads exceeded the browser artifact memory limit. They were downloaded locally by streaming the exact request emitted by the ordinary authorised Drive download confirmation; no Drive-ID-to-URL conversion, authentication scraping or remote AI upload was used. Temporary signed URLs were removed from private scratch after transfer. Original media/checksums/reports remain under ignored private storage for authorised human review, never public fixtures.
