# Humaniti AI — Assumptions and Evidence Register

Reviewed: 2026-10-23
Authority order: organiser challenge PDF > organiser instructions/permissions > project PRD > planning hypotheses.

## CONFIRMED by the challenge PDF

| Item | Evidence / consequence |
|---|---|
| Product outcome | A working app accepts a new class recording, classifies it as Poor/Average/Good/Excellent, and explains the result with specific useful observations. |
| Evaluation weights | Assessment usefulness 35%; problem solving/effective AI use 30%; working app/code quality 25%; clarity 10%. |
| Submission artifacts | Hosted link, GitHub source with README, redacted relevant AI history, and <=300-word explanation. |
| Expected effort | Approximately 4–5 hours. |
| Challenge window wording | Starts Wednesday at 6:00 PM; deadline Friday at 12:00 PM. |
| Data sensitivity | Recordings must remain confidential and may identify children. Only organiser-permitted services may process them. |
| Training requirement | No need to train a model or build a production-grade platform; a simple interface is acceptable. |
| Dataset | A small collection of sample 8x8 class recordings is provided through an organiser Drive link. |

## CONFIRMED by the project brief / operating contract

| Item | Consequence |
|---|---|
| Required implementation stack | Next.js App Router, strict TypeScript, SQL/PostgreSQL, Prisma, Python only for media processing, FFmpeg, private storage. |
| Assessment policy | Evidence provenance, timestamps, modality, validated IDs, no unsupported claims, missing evidence is `not_assessable`. |
| Privacy policy | No recordings, screenshots, transcripts, names, credentials, private URLs, or child-identifying data in public code, logs, artifacts, or storage. |
| Provider policy | Remote AI only after organiser approval; mock providers are test-only and visibly labelled. |
| MVP boundary | No vector database, model training, fine-tuning, face recognition, emotion detection, or child identification without a demonstrated requirement. |

## UNVERIFIED and must be checked before relying on it

| Item | Safe handling until verified |
|---|---|
| Exact challenge dates and timezone | Treat the PDF wording as incomplete; ask the organiser and record the answer. Do not infer the timezone or assume remaining time. |
| Drive authorization and sample inventory | No Drive API credentials or approved local sample were available in this workspace. Do not scrape or claim access. Record count, names, sizes, MIME, durations, codecs, labels, and checksums only after legitimate access. |
| Ground-truth labels | Do not infer labels from filenames or examples. Use labels only if explicitly supplied by the organiser. |
| Approved external AI processors | No approval evidence is present. Keep the production path local or blocked until approval is documented. |
| Retention and deletion policy | Obtain organiser/deployment decision before storing real media or derived transcripts. |
| Hosting provider, database, storage, resource limits | Choose and document only after testing long-running worker behavior and private storage. |
| Supported video distribution | Probe real permitted samples before final size, duration, codec, and concurrency limits are chosen. |
| Authentication/demo access | Decide with the organiser whether a testing token or restricted demo is required. Never expose unrestricted media endpoints. |

## REJECTED assumptions

- Treating technical quality, accent, facial expression, apparent happiness, or internet conditions as teaching quality.
- Treating unavailable audio/video/transcription evidence as negative evidence.
- Uploading recordings to an unapproved third-party model or silently falling back to a mock provider.
- Publishing sample media, transcripts, screenshots, or identifiable derived assets.
- Hardcoding sample-specific grades or expected answers.
- Adding a vector database or model-training pipeline before a demonstrated need.
