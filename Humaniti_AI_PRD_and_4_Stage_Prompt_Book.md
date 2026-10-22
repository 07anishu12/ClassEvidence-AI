# HUMANITI AI — CLASS QUALITY ASSESSMENT SYSTEM
## Detailed PRD, technical design, four-stage implementation prompt book, verification gates, and submission plan

**Source of truth:** `Humaniti_AI_24_Hour_Build_Challenge.pdf` (3 pages). **Preparation date:** 22 October 2026. **Planning budget:** 12 engineering hours. **Challenge's stated expected effort:** 4–5 hours. Treat the specific deadline stated in the challenge and organiser's actual communication as authoritative; verify timezone and eligibility rather than assuming 12 hours remain in the official window.

> **Actual requirement:** Build a hosted application accepting a new video recording (upload or link), classifying class quality as **Poor / Average / Good / Excellent**, and providing specific, useful evidence-backed observations. Provide source code/README, relevant AI interaction history with secrets redacted, and a **300-word maximum** method statement. The organiser will test on an unseen video. The input consists of a small set of 8x8 children's class recordings. Do not publish recordings or expose children's data; use only explicitly approved processors/services.

**Dataset:** https://drive.google.com/drive/folders/1Jz2GlCg8zmdbdxeJweaW8UCY27vqXHr0?usp=drive_link

**Evaluation:** Assessment usefulness 35%; problem-solving/AI use 30%; working app/code 25%; clarity 10%. Therefore prioritize truthful grounding and a tested unknown video over complex UI or extensive training.

**Important status:** Dataset contents, recording durations, ground-truth labels, permissions, actual deadline timezone, approved external models, and video codec/size distribution were not verified while preparing this document. Never invent them. The coding agents must verify and record them.

---

# PART I — PRODUCT REQUIREMENTS DOCUMENT (PRD)

## 1. Problem definition

Human review of lesson recordings is time-consuming, inconsistent, and difficult to scale. We need a defensible, evidence-supported first-pass teaching-quality assessment. Quality is not identical to speaking speed, sentiment, background noise, camera movement, apparent student happiness, accent, facial expression, or the presence of fancy slides. The system should distinguish instructional quality from connection conditions and should declare insufficient evidence rather than hallucinate an observed event.

## 2. Personas and jobs to be done

- **Evaluator/recruiter:** submit an unseen recording and obtain a useful classification plus proof tied to moments in the lesson.
- **Academic reviewer:** inspect assessment dimensions, strengths, opportunities, transcript evidence and limitations.
- **Developer:** inspect job state, processing errors, model versions, timings and reproducibility without viewing private videos unnecessarily.

## 3. Success criteria and acceptance tests

| Priority | Requirement | Acceptance |
|---|---|---|
| P0 | Import class samples from Google Drive (or private downloaded folder when Drive access is blocked) | Inventory contains count, name, size, mime, duration, checksum if available; zero invented labels. |
| P0 | New recording upload | Works on at least one real unseen/held-out local test recording without relying on example-specific hacks. |
| P0 | URL ingestion | Allow only user-controlled/organiser-approved Drive files or explicitly permitted direct HTTPS URLs; reject SSRF/private hosts and redirects to them. Clearly tell users when third-party URLs cannot be fetched. |
| P0 | Four quality labels | Exactly `Poor`, `Average`, `Good`, `Excellent`; no invented fifth class. |
| P0 | Evidence-backed explanations | At least 3 useful observations where evidence permits; each linked to time range, source modality, and concise rationale; otherwise explicitly state insufficiency. |
| P0 | Durable jobs | Refresh does not erase job/results; processing, success, failure visibly represented. |
| P0 | Privacy | Files are private, no recordings in git/public bucket/logs; approved external processors only; purge temp files. |
| P0 | Hosted demo | Evaluator can reach website and complete assessment before deadline. |
| P0 | Reproducible code | Typecheck, lint, build, focused tests, `.env.example`, migrations, setup guide. |
| P0 | Submission | Repo, live link, redacted AI logs, <=300-word approach statement. |
| P1 | Score per criterion | Score/rubric weights documented, reproducible and not claims of psychometric validity. |
| P1 | Evaluation on known samples | Manual rubric comparison, representative positives/negatives and a held-out run with failure analysis. |
| P1 | Export | Download result as JSON and/or clean PDF when time allows. |
| P2 | Vector database, RAG, advanced dashboards, multi-user roles | Skip unless P0/P1 done with meaningful spare time. |

**Non-goals:** Training a video classifier from scratch, face recognition, emotion detection, child identification, attendance identification, continuous monitoring, comprehensive LMS integrations, automated disciplinary or hiring decisions.

## 4. Rubric design (initial hypothesis, to calibrate using provided examples)

Each dimension scored 0–4, with 0 meaning inadequate/poor evidence of effective practice, 1 weak, 2 adequate, 3 strong, 4 exceptional. Missing/unknown evidence must be marked `not_assessable` rather than automatically scored 0. Evaluate teaching behaviors, not protected or personal characteristics.

| Dimension | Initial weight | Evidence examples | Common misleading proxies |
|---|---:|---|---|
| Conceptual clarity & factual accuracy | 25% | Correct explanations, examples, checking understanding, misconceptions corrected | Long monologue, technical vocabulary |
| Learner interaction & responsiveness | 25% | Questions, meaningful wait time, response to student input, formative feedback | Number of student voices alone, smiling faces |
| Lesson structure & progression | 20% | Stated goal, scaffolded steps, recap, transitions | Slide count, rigid timing |
| Instructional practice & engagement | 20% | Adapted explanations, demonstrations, active student tasks | High enthusiasm or speaking volume alone |
| Audio/video usability | 10% | Speech intelligibility, screen legibility, severe interruptions | Accent, voice pitch, camera aesthetics |

**Calibration requirement:** These weights are a proposed starting rubric, *not specified by Humaniti*. Revisit after reviewing actual sample recordings. Never claim expert-validated weights. Use strong constraints to stop technical quality from dominating instructional quality. If modality is unavailable, adjust eligible weights with explicit reporting or mark result low-confidence; do not silently treat absence as bad teaching.

**Score computation:** For assessed dimensions D with score s_d in [0,4] and weight w_d, weighted percent = 100 * Σ(w_d*s_d/4)/Σ(w_d). Optional initial boundaries: Poor <40; Average 40–59.99; Good 60–79.99; Excellent >=80. Boundaries must be clearly identified as hypotheses and calibrated on sample comparison. Do not tune boundaries on held-out test clips. LLM judgment should fill a validated scoring schema; final grade is derived deterministically from the rubric rather than silently accepting a self-declared label. Evidence adequacy/confidence separate from quality score.

## 5. User flows

**Path A: dataset exploration:** admin uses approved Drive OAuth/service-account shared-folder access; enumerates videos; downloads only allowed media into private temp/storage; computes metadata; manually inspects representative recordings; records known labels only if explicitly supplied. When API access unavailable, accepts private local files without pretending Drive import succeeded.

**Path B: evaluation:** user uploads mp4/mov/webm or supplies permitted video link -> gateway validates file, name, size, MIME and source -> private storage -> DB `queued` -> worker validates codec/duration, extracts audio and sampled frames, transcribes speech if permitted -> assessment engine gathers verifiable events -> dimension scores and temporal evidence -> policy/rubric validator -> DB `completed` -> UI report and optional export. Failures generate specific safe error messages with retry.

**Path C: reviewer:** sees four-way label, assessment summary, rubric scores, timestamped strengths/weaknesses, uncertainties, coaching tips and technical notes. Cannot retrieve children's recordings from unrestricted endpoints.

## 6. AI reasoning specification

Use an evidence-first pipeline:
1. Normalize private media and preserve timestamps.
2. Extract audio speech/transcript, ideally with segments/speaker labels only where reliable and permitted; use acoustic diagnostics for clipping/dropouts, not emotional inference.
3. Sample frames based on duration (e.g. at fixed coarse intervals plus event-adjacent frames); inspect visual instructional content, presentation changes, text legibility, black screen/connection faults. Never infer student engagement from faces.
4. Produce structured candidate observations with `startSec`, `endSec`, `modality`, `claim`, `directEvidence`, `uncertainty`.
5. Validate that observation timestamps lie within duration and claims are supported by available transcript/audio/frame evidence. If no transcript or visual context, don't imply it exists.
6. Score dimensions from the observations using a fixed documented rubric; produce label via deterministic thresholds; explicitly flag low confidence and missing data.
7. Generate short, coaching-oriented explanations, no generic praise, avoid judgments about children or personal characteristics.

**No model training is required.** Gemini's documented video understanding/File API may simplify multimodal evaluation *if organisers approve transfer to Google*. Otherwise process locally or with explicitly authorised services. Obtain approval before uploading recordings to any third-party AI processor. Build an `AIProvider` abstraction with `Local/ApprovedProvider` and `MockProvider` for tests. Never silently use a third-party model as a fallback. For transcription, locally hosted Whisper can be used if the runtime allows it; cloud transcribe only with explicit approval.

## 7. Tech stack and boundaries

- **Frontend:** Next.js App Router, React, TypeScript strict, Tailwind, accessible progress indicators, upload, report, error states.
- **Backend/gateway:** Next.js route handlers, Zod schemas, rate and size limits, auth/token for restricted demo, signed/private file accesses. Gateway handles all inbound inputs and hides provider credentials.
- **Persistence:** PostgreSQL + Prisma migrations. `AssessmentJob`, `MediaAsset`, `TranscriptSegment`, `EvidenceObservation`, `DimensionScore`, `AssessmentResult`, `ProcessingEvent`, `RubricVersion` as appropriate. Do not over-normalize under deadline.
- **Worker:** Python 3.12 + FastAPI or independently run worker CLI using FFmpeg/ffprobe and Python media libraries. All calls typed/validated from TypeScript. Python handles media only; business logic lives in typed service layer.
- **Queue:** SQL-backed DB job-claim mechanism acceptable at prototype scale; claim atomically using transaction/row locking and lease timestamps. Avoid long processing inside serverless HTTP requests. Persistent independent worker on an appropriate host; for single-machine prototype a foreground worker with restart instructions is acceptable if openly disclosed. Never present a serverless cron as reliable 34-minute processing if not tested.
- **Private files:** local private volumes on single-VPS deployment or private object bucket; presigned short-lived upload/download only, least privilege. No public video URLs.
- **Vector DB:** not needed: no semantic corpus retrieval in the required critical path. PostgreSQL is enough. pgvector only if later genuinely necessary.
- **Deploy:** Prefer a single persistent Docker Compose host (Next app, Postgres, Python worker, private disk) for simple long-video testing. Managed alternatives only if account limits and long-running worker behavior are verified. Protect the demo with a testing token if organiser agrees and provide it securely.

## 8. API contracts (illustrative; agent implements exact schemas)

`POST /api/assessments` body: uploaded file reference or validated URL -> `{id,status}`.

`GET /api/assessments/:id` -> `{id,status,progress,stage,error?,result?}`.

`GET /api/assessments/:id/report` -> structured JSON with `{qualityLabel,scorePercent,rubricVersion,confidence,assessmentLimitations,dimensions:[...],observations:[{startSec,endSec,modality,claim,evidence,impact}],recommendations:[...]}`.

`POST /api/admin/drive/import` -> authorized Drive folder ingestion with audit and allowlist; disable on public demo unless explicitly needed.

**Security:** no arbitrary file read, path traversal, fake MIME trust, remote fetch to RFC1918/localhost/link-local/metadata addresses, or redirect rebinding; put tight duration/size caps appropriate to observed dataset; control parallel jobs; sanitize metadata; avoid personally identifying logs.

## 9. Suggested repo structure

```text
/
  app/                      # pages, app shell, route handlers
    api/assessments/
    (dashboard)/
  components/               # upload/progress/score/evidence UI
  lib/
    db/                     # Prisma client & queries
    domain/                 # score calculator and types
    gateways/               # validation, source ingest, throttling
    providers/              # approved AI and mock adapters
    services/               # orchestration and report assembly
  prisma/schema.prisma
  worker/
    src/media/              # ffprobe, frames, audio
    src/analysis/           # transcription and observable signals
    src/jobs/               # claim/heartbeat/state transitions
    tests/
  tests/                    # contract, unit, smoke
  scripts/                  # local ingestion and smoke tools
  docs/
    PRD.md
    ARCHITECTURE.md
    RUBRIC.md
    ASSUMPTIONS.md
    PRIVACY.md
    EVALUATION.md
    SUBMISSION.md
    AI_PROMPT_LOG.md
    memory.md
    handoffs/stage-01.md ... stage-04.md
  .env.example
  README.md
  docker-compose.yml
```

## 10. Twelve-hour critical path

| Time budget | Output | Gate |
|---|---|---|
| 0:00–1:30 | Inspect videos/permissions/labels; bootstrap repo, schema, architecture, baseline README | At least one representative class processed with local media tools; no guessed labels. |
| 1:30–5:00 | Working ingestion, media extraction, AI adapter, score validation, queue/worker | True end-to-end assessment through API, non-mock on approved model or actual local analysis. |
| 5:00–7:00 | Functional Next.js UI, upload/URL, progress, report | Fresh browser session can submit and inspect results. |
| 7:00–9:30 | Evaluate representative samples and held-out video; refine explanations/calibration; fix defects | Evidence timestamps verified; confidence/limitations correct. |
| 9:30–11:00 | Deploy, complete smoke tests on live URL, privacy check, repo README | Live endpoint accepts realistic video without timeout. |
| 11:00–12:00 | AI logs, short approach, final links, submit | Every requested artifact accessible. |

**Time compression:** if ingestion or hosting blocks occur, narrow the UI, remove exports, use a single permitted provider or local model, preserve one real working end-to-end path. Do not cut privacy, unseen-video validity, or truthful evidence. Agent must reserve ≥2 hours for testing/deployment even if feature work is incomplete.

---

# PART II — AGENT OPERATING CONTRACT (MANDATORY FOR ALL FOUR PROMPTS)

**How to use:** Feed Prompt 1 to your coding agent, allow it to change the repo, then feed Prompt 2 to the same or a new coding agent. Repeat for 3 and 4. Each prompt must first read `docs/memory.md`, `docs/ASSUMPTIONS.md`, `docs/PRD.md` and the relevant latest handoff. Never ask it to rescan the entire repository unless the focused index is missing or demonstrably stale. Maintain `docs/memory.md` concise (aim <250 lines), with pointers to stage handoffs. The agent may use context-window subagents for independent branches, but only one writer owns a file at a time.

**Baseline agent instructions — paste in the root `AGENTS.md` if supported:**

```text
You are the lead AI engineer working on an individual time-boxed recruitment assignment. Work autonomously and deliver tested functionality, not an architectural essay. Read docs/memory.md, docs/PRD.md, docs/ASSUMPTIONS.md and last stage handoff before changing code. Do not reread full repo unless required. The actual challenge brief is the source of truth. Never infer undocumented ground-truth labels. Never claim a model or service is approved; use only documented organiser-approved external processing for children's class recordings. Avoid publishing children's identifiable video, screenshots, names, transcripts or any secrets. Make small composable changes; no duplicate modules, speculative abstractions, unrelated refactors or untested stubs on the critical path. Next.js/TypeScript/PostgreSQL required; Python allowed for media processing. Keep frontend, service logic, gateway validation, external providers and DB access separate. Write schemas and tests before relying on outputs. Every report claim must be tied to real observable evidence, timestamp and modality. If any feature cannot be implemented, identify the blocker and provide the best safe working fallback, with no fake success states. Do not stop at scaffold; implement, run, and verify. Before finishing each stage: run targeted tests, typecheck/build/lint if possible; inspect diff, fix broken imports; update docs/memory.md and a detailed stage handoff; record commands/outputs, files changed, unresolved risks, next step and decisions. Redact credentials/PII in any logs. No GitHub pushes, remote uploads or public release unless credentials and user instructions permit; show exact commands and remaining manual steps. Do not ask routine questions; make reversible assumptions and document them. Prioritize P0 functionality, clean architecture, real held-out evaluation, and a deployable app.
```

**Required memory schema:**

```markdown
# PROJECT MEMORY — Humaniti AI
Last updated: <UTC timestamp>; stage: <1-4>; git commit: <SHA or uncommitted>
## Challenge invariants
<one-sentence core ask, the 4 labels, privacy/approved processors, unseen evaluation, deliverables>
## Current state
<real working capabilities only; commands verified>
## Repo map
<main modules with responsibility, no full file dump>
## Contracts
<API schemas, job transitions, DB migrations, provider interfaces>
## Decisions and justifications
<ADR IDs, selected rubric, limitations, permission notes>
## Files changed this stage
<paths and 1-line changes>
## Verification evidence
<exact command; PASS/FAIL; output summary; date>
## Known defects / blockers
<severity; reproduction; workaround>
## Next stage priorities
<top 3 ordered steps, acceptance criteria>
## Artefact pointers
<docs/handoffs/stage-NN.md; docs/EVALUATION.md; docs/AI_PROMPT_LOG.md>
```

**Handoff append-only detail file:** stage goal; source of actual inputs; the exact commands used, tests passed/failed, file list, critical snippets of interface/API shapes, choices made and alternatives rejected, unresolved tasks sorted by severity, security/data classification, exact next instructions. Update memory atomically after validation. Keep previous handoffs immutable unless correcting a factual error, in which case note amendment.

**Definition of done per prompt:** no invented observations, accurate demo behavior, no unapproved media exfiltration, all touched modules pass relevant checks, memory and handoff updated, report what actually works and what remains.

---

# PART III — FOUR SEQUENTIAL CODING-AGENT PROMPTS

## PROMPT 1/4 — Discovery, PRD verification, project bootstrapping, and memory

```text
ROLE: Staff Product Engineer + Technical PM + Privacy Reviewer. TASK: Stage 1, foundations and data discovery. TIME BOX: approximately 90 minutes. You are implementing an actual assignment, not drafting a hypothetical system.

FIRST ACTIONS:
1. Read challenge PDF if present, docs/PRD.md, docs/memory.md if present, docs/ASSUMPTIONS.md if present. Treat actual challenge as higher-priority evidence than planning notes.
2. Inventory the current git repo using shallow listing: top-level directories, package manifests, existing routes/services/schemas, README and recent commits. Avoid repetitive full-file scans. Create missing documentation structure.
3. Access the provided Google Drive sample folder at https://drive.google.com/drive/folders/1Jz2GlCg8zmdbdxeJweaW8UCY27vqXHr0?usp=drive_link using legitimately available OAuth/service account/Drive API or user-approved manual downloaded files. Never scrape authentication or bypass access permissions. Try listing file names, sizes and MIME only before copying media. Record access success/failure. If Drive inaccessible, enable safe local sample ingestion rather than block the app.
4. Check organiser restrictions; do NOT upload any recordings to external AI APIs without confirmed approval. Ask only if this is a genuine blocking approval requiring owner action. Make a local/approved-only provider path and mock used only in tests, NEVER for the user-facing assessment.

DELIVER:
A. Verify/write docs/PRD.md from requirements: goals, personas, user stories, P0/P1/P2 acceptance criteria, non-goals, failure cases, source-of-truth links and rubric hypotheses.
B. docs/ASSUMPTIONS.md with each item marked CONFIRMED / UNVERIFIED / REJECTED, including labels, sample count, duration, approved processor, size, retention, challenge deadline/timezone.
C. docs/ARCHITECTURE.md with one diagram, data flow and threat model. Commit to Next.js App Router + strict TypeScript + PostgreSQL/Prisma + Python FFmpeg worker + private file storage + approved AI adapter. Avoid vector DB at MVP.
D. Functional repo skeleton with Next.js, UI shell, route boundaries, Prisma schema/migration, Python worker package, basic Docker Compose, .env.example, scripts/check-prereqs, comprehensive .gitignore. Existing code should be adapted, not destroyed.
E. Actual media probe on one authorised local sample when available: ffprobe duration/codec and validate workable extraction. If dataset inaccessible, explicitly mark this test BLOCKED and run fixture-based media test instead.
F. Rubric version 0.1 in docs/RUBRIC.md: initial weights 25/25/20/20/10, score 0–4, deterministic 4-label thresholds, evidence validity, missing-modality policy, no emotion/face-based scoring, calibration plan.
G. docs/AI_PROMPT_LOG.md with links/identifiers of AI sessions, decisions, prompt version and privacy-safe excerpts. Do not forge histories.
H. docs/memory.md following required schema and docs/handoffs/stage-01.md.

CODE QUALITY: Zod validators at gateway; domain types centralised; TypeScript strict; no API keys browser-side; avoid giant page.tsx and route.ts; provider interfaces, no production fake values; config validated at startup.

TESTS: npm install, lint, tsc --noEmit, Next build if environment permits; prisma validate and migration; Python dependencies install and worker smoke; verify zero sensitive files tracked. Run and fix issues rather than merely listing them.

END RESPONSE: completed vs blocked table; factual Drive sample inventory (not fabricated); exact tests/commands + results; architecture decisions; 3 highest-priority next steps; confirm memory and stage-01 handoff paths.
```

**Stage 1 go/no-go:** a runnable scaffold, database schema, documented rubric, legitimate sample access status, and memory file. The failure mode to prevent is spending hours designing without touching any real video.

## PROMPT 2/4 — Real ingestion, processing pipeline, assessment engine, and API

```text
ROLE: Principal Backend + Applied ML Engineer. TASK: Stage 2, the actual quality classifier. TIME BOX: approximately 3.5 hours.

BEFORE CODE:
1. Read docs/memory.md, docs/handoffs/stage-01.md, docs/PRD.md, docs/RUBRIC.md and API contracts; inspect only referenced modules and current git diff. Re-run Stage 1 failing tests; confirm no new inconsistencies.
2. Verify permission for any third-party model/API. Do not transfer children's identifiable media/transcripts to unapproved processors. Choose local/approved adapter only. If approved multimodal provider exists, use its current documented video/File API; never invent SDK method names/model availability. Keep provider choice configurable.

IMPLEMENT ACTUAL END-TO-END PROCESSING:
A. Private ingestion for local uploads, plus restricted Drive folder import using OAuth/approved credentials; use Drive file IDs and API, not naive public link conversion. Add direct HTTPS URLs only with allowlist + DNS/IP/redirect safety; reject private/metadata addresses. Verify size, MIME with magic bytes, supported codecs, duration and disk budget.
B. Database assessment state machine `queued -> processing -> completed|failed` with progress stage, heartbeat/lease, retry and idempotency. Prevent duplicate jobs using idempotency key/checksum where feasible. Do not run long videos inside a Next serverless route.
C. Python worker: ffprobe, bounded FFmpeg audio extraction and coarse frame sampling with timestamps. Handle silent audio, missing video track, corrupt media, long recordings, no speech, noisy audio, languages, multiple speakers, and variable codecs. Do not log child names/transcripts by default; wipe scratch files.
D. Provider abstraction: `analyze(input)->ValidatedEvidenceOutput`. If model approval is confirmed, evaluate audio/transcript and sampled frames/video on that provider, using strict JSON/schema and retry-on-invalid output. If not, implement a real local analysis path with documented limitations (e.g. local speech model if available, audio diagnostics, heuristic visual analysis) rather than fabricate an AI semantic assessment. It is acceptable to report blocked semantic dimensions as not_assessable.
E. Evidence extraction prompt (use with explicitly approved model):
SYSTEM: You are evaluating instructional practice in a single online lesson. Use only supplied audio/transcript/video evidence. You must not infer identifiable students' personal traits, engagement/emotions from facial expressions, socioeconomic status or teacher accent quality. Do not reward mere excitement or penalize quiet students. For each candidate claim include bounded timestamps, modality, observable direct evidence, relevance, uncertainty, and short constructive coaching implication. Never invent quoted text, timestamps, number of speakers or visible events. When evidence is unavailable, say not_assessable. Separate audio/video technical faults from pedagogical effectiveness. Return schema-valid JSON only.
USER: Review input lesson using rubric v0.1. Examine objectives, factual explanation, scaffolding, meaningful questions/wait time, feedback/adaptation, student practice and closure. Report both evidence for quality and counterexamples/limitations. Ground every observation. Input duration, transcript and frame data are supplied in validated attachments; do not assume completeness.
F. Scoring stage prompt (same permission rule):
SYSTEM: Evaluate only validated observations using fixed rubric. For each dimension return score 0–4 or null if insufficient evidence, reason with observation IDs, counterevidence, confidence and limitations. Do not return an independently inferred overall label. No quote may be invented. Do not classify based on personality, accent, protected traits or technical production values. JSON only.
G. TypeScript domain service: validate observation IDs and timestamps, drop unsupported claims, compute weighted total only over assessable dimensions, apply fixed class boundaries, store rubricVersion + providerVersion + confidence separately. Do not allow LLM to change weights or thresholds. If essential dimensions unassessable, mark evaluation uncertain; ensure user can still see reasoned output without false certainty.
H. API: `POST /api/assessments`, `GET /api/assessments/{id}`, `GET /api/assessments/{id}/report`, guarded Drive import. Use shared Zod validators and consistent typed error responses.
I. Report includes four-way label on successful sufficiently assessable analysis, dimension scores, observed strengths/issues, time-linked evidence, actionable recommendations, uncertainties and technical caveats. No generic ungrounded 'great engagement' text.

TEST MATRIX:
- Valid class video -> real completed job with evidence and accurate timestamp bounds.
- Held-out video -> no dependency on sample filename or labels.
- Corrupt/empty/unsupported/oversize video -> clear failed state.
- Silent/low-quality video -> cautious explanation and confidence/coverage handling.
- Provider timeout/rate limit/invalid JSON -> bounded retries, final safe failure.
- Malicious/private URL -> blocked.
- Same job twice / restart -> idempotent processing and durable state.
- No API key/permission -> never fake success.
- Check DB migrations, unit tests (score thresholds), integration tests (job lifecycle), Python tests (FFmpeg), lint, typecheck, production build.

DOCUMENT: Update docs/ARCHITECTURE.md/PRD.md only for justified changes; docs/EVALUATION.md with measured real examples (redacted), docs/AI_PROMPT_LOG.md, docs/memory.md and docs/handoffs/stage-02.md. Leave no secrets or children recordings in git.

END RESPONSE: exact working API workflow, commands and test results, which provider genuinely ran and which permissions were verified, honest limitations and ranked blockers for Stage 3. Do not say 'implemented' when only mocked.
```

**Stage 2 go/no-go:** one genuine evaluation of an actual permitted recording in persistent storage, with traceable observations, computed label and retrievable result. If that cannot be achieved, stop fancy features and fix the processing path.

## PROMPT 3/4 — Frontend, UX, interpretability, test suite and calibration

```text
ROLE: Senior Product Designer + Full-stack Engineer + QA Lead. TASK: Stage 3, evaluator-ready application. TIME BOX: approximately 3 hours.

START: Read docs/memory.md, stage-02 handoff, rubric, public API schemas and latest test outputs. Verify end-to-end backend first and repair regressions before building UI. Inspect focused modules; do not perform a full unnecessary rewrite.

BUILD A POLISHED BUT MINIMAL FRONTEND:
1. Main upload page with drag/drop, file picker, permitted Drive URL or supported HTTPS source, concise privacy notice, supported file types/size/duration from actual server config, clear loading/validation/error states.
2. Submission must create durable job and immediately show ID/status; poll with bounded retry/backoff, stop on completion/failure, preserve job URL `/assessments/[id]` across refresh; explain potentially long processing rather than give fictional ETA.
3. Result view with prominent quality label, numeric rubric score (only if justified), dimension bars, key takeaways, strengths, opportunities, confidence/evidence coverage, clearly delineated technical recording quality versus actual instructional quality.
4. Timestamped evidence timeline: time range, modality badge, observed event paraphrase or precisely sourced short quote, impact on rubric; clicking timestamp may seek video only when authorised secure preview is available; otherwise show timestamps without exposing files.
5. Reviewer questions box: allow limited predefined explanatory questions answered ONLY from stored assessment evidence; if generative Q&A is permitted, constrain source to stored validated evidence and refuse unsupported answers. Avoid open-ended claims that go beyond actual observation.
6. Accessibility: keyboard navigation, WCAG-aware contrast, responsive 360px/mobile through desktop, informative headings and aria status. Use clean sober styling and avoid distracting decoration.
7. User-facing privacy: recordings never public; only approved integrations; clear handling of retention; conceal internal paths and stack traces. Ensure API cannot enumerate other private recordings.
8. Optional JSON report export if P0 complete; do not implement vector DB, chat histories or an unrelated admin console.

CALIBRATION AND TESTING:
- Inventory representative sample clips and labels only if actually supplied. If no labels supplied, perform blinded manual rubric review on 2–4 clips; compare explanations, not claim accuracy against absent ground truth.
- Keep at least one accessible sample held out until this stage; run as if recruiter uploaded an unseen file; record results and evidence verification.
- Verify at least 5 evidence timestamps by inspecting source moments with private local tools; fix any hallucination or time offsets. Capture redacted observations, not student screenshots.
- If label variation is poor, inspect evidence and rubric, not arbitrary post-hoc boundary manipulation for a desired spread.
- Test 4 edge cases and document precision tradeoffs, uncertainty and failure modes. Add deterministic unit tests for thresholds and null dimension normalization.
- Real-browser smoke on desktop/mobile when browser tooling available, upload/test/refresh/result/error states.
- Run lint, typecheck, build, tests. Ensure production pages fetch real API; remove demo-only fake reports from publicly visible user flow.

UPDATE: docs/EVALUATION.md (sample count, known vs unknown labels, test table, timestamp audit, weaknesses), docs/memory.md, docs/handoffs/stage-03.md, docs/AI_PROMPT_LOG.md. If implementation is running late, prioritize working recording->assessment->report over aesthetics.

END RESPONSE: real test paths, test pass/fail, UI route list, calibration changes with rationale, screenshots only if privacy-compliant, exact handoff issues for deployment.
```

**Stage 3 go/no-go:** recruiter can upload an unseen clip, follow progress, refresh safely, read honest scores and evidence, and understand limitations.

## PROMPT 4/4 — Deployment, independent verification, clean repo and submission

```text
ROLE: Release Engineer + Red Team QA + Technical Writer. TASK: Stage 4, release and submission. Reserve at least 2 hours; do not spend final hour building speculative features.

START: Read docs/memory.md, docs/handoffs/stage-03.md, docs/PRD.md, docs/EVALUATION.md and actual challenge PDF. Check all promised requirements against implemented source and deployed behavior. Resolve high-severity blockers first.

RELEASE STEPS:
1. Security review: inspect git tracked files/secrets, `.env` ignore, API response PII, media bucket ACL, upload type/size enforcement, URL SSRF, child data in logs, retention, external provider approval, access to demo. Remove all sample media from git history if accidentally included; do not silently publish anything private. Ensure no nonapproved external data processing.
2. Production reliability: build Next.js, apply migrations, launch PostgreSQL and Python worker with persistent volumes or managed equivalent. Verify environment variables, health probes, worker restart behavior and network reachability. Ensure long-running video jobs do not rely on short web request timeout.
3. Live E2E: open hosted link from an unauthenticated/recruiter-like session using intended credentials, upload an ACTUAL previously unseen recording with permission, wait for completed persisted result, refresh/revisit link and inspect rubric evidence. Verify timestamp fidelity and correct four-label logic. If unavailable, truthfully mark unverified and state blocker.
4. Fault cases: oversize, corrupt file, unsupported URL, unavailable model key, provider failure, duplicate submit; ensure safe explanations. Concurrency/load test only to a realistic small safe level.
5. Code/repo hygiene: eliminate dead code, TODO claims in main flow, implicit any, duplicate interfaces, console logs with private content, test-only flags accidentally on, leaked media URLs. Preserve modular frontend, gateway, service, worker, SQL architecture. Pin environment instructions and dependency requirements.
6. README: 2-minute overview, what it does, architecture diagram, prerequisites, approved processor/privacy note, local setup, env vars (names only), migration/start instructions, usage including private Drive permissions, what is not supported, screenshots containing no sensitive data, test commands, demo URL.
7. AI history: collect actual relevant prompts and tool interaction logs or exports from coding assistants; redact unrelated threads, secrets and child PII; provide reproducible selected sequence. Never fabricate interactions.
8. Submission write-up <=300 words, answering exact challenge: chosen approach and why; what worked/failed; main limitations. Do not claim performance/accuracy without labeled test data.
9. docs/SUBMISSION.md: hosted app URL, repo URL, AI history link/file, final <=300-word response, organiser's Google Form URL, checklist/submit confirmation only if actually submitted. Do not imply form submitted unless a verified action completed.
10. Update docs/memory.md and docs/handoffs/stage-04.md with final architecture, test outcomes, changes, limitations and deployed identifiers. Keep sensitive IDs out of public repo.

STOP RULE: If time <60 minutes before submission, freeze features. Fix only P0 blockers, deploy, perform one live test, and prepare the required evidence/history/short statement.

EXIT CRITERIA: An approved externally reachable application; actual recorded end-to-end test; clean GitHub repo and README; real AI interaction history; <=300-word explanation; documented limitations; final file of submission URLs and remaining manual actions. Report precisely which are true vs not verified.

END RESPONSE: release checklist PASS/FAIL with evidence; exact deployed URL only if truly deployed; final 300-word write-up; submission links; anything still manual; updated memory/handoff.
```

---

# PART IV — AI PROMPTS INSIDE THE APPLICATION (RUNTIME TEMPLATES)

These are **model prompts for interpreting lessons**, distinct from the four prompts for the coding agent. Only use with a processor explicitly authorised for these recordings.

## Runtime 1: transcription/segment quality audit

```text
Interpret available speech content exactly; preserve language and source segment timestamps. No student names or identifying details in output. Identify unintelligible intervals rather than invent words. Do not infer who's speaking from appearance. Return utterance IDs, times, text where reliable, uncertainty and language. If no acoustic evidence, return absent. Never score teaching based on accent.
```

## Runtime 2: multimodal evidence extraction

```text
TASK: Find OBSERVABLE instructional moments in a lesson. You receive validated duration, timestamped speech segments, sparse sampled frames and permitted audiovisual analysis. Restrict all claims to these sources. Produce at most 18 observations, include strengths and weaknesses. Claim must refer to a specific event, e.g. 'Teacher asks the learner to explain why 3/4 exceeds 1/2 around 08:20', and include modality, start/end seconds, evidence IDs, observed content (brief), confidence, pedagogical relevance. Do not fabricate exact speech quotations or suggest student attention from their face. Differentiate unavailable evidence from absence of behavior; explain limits of sparse frame sampling. JSON conforms to ObservationSchema.
```

## Runtime 3: criterion scoring

```text
TASK: Review validated evidence IDs against rubric version <RUBRIC_VERSION>. Dimensions are clarity/accuracy 25, interaction/responsiveness 25, structure 20, pedagogical engagement 20, technical usability 10. Each dimension gets an integer 0..4 only when sufficient evidence, otherwise null with reason. Reference supportive and contradictory observation IDs; provide a short actionable explanation for each. Never use student demographics, teacher accent or simple excitement as quality proxies. Never overwrite rubric weights or output an overall label. Return valid DimensionScoresSchema JSON only.
```

## Runtime 4: feedback narrative grounded in stored scores

```text
TASK: Turn only supplied validated observations, dimension scores, score and deterministic label into an actionable coaching report. Provide 2–4 strongest positives, 2–4 highest-impact improvements, one paragraph summarizing the label, 2–3 practical next-class tips, evidence timecodes for all substantive claims, and calibrated uncertainties. No new facts, events, student attributes, verbatim quotes or scores can be introduced. If evidence is incomplete, say which dimensions cannot be assessed. Do not imply that scores are definitive measures of teacher ability. Return strict JSON per ReportSchema.
```

---

# PART V — FINAL SUBMISSION MATERIAL

## Suggested <=300-word explanation (edit to match ACTUAL implementation and test results; do not submit claims until verified)

> I built a video-based classroom quality assessor designed to produce interpretable feedback rather than an opaque rating. The application accepts a class recording and processes available speech/audio and sampled visual evidence. A structured rubric evaluates conceptual clarity, student interaction, lesson progression, instructional practice, and recording usability. The system attaches timestamps to observations, separates pedagogy from technical limitations, and computes one of four quality categories from versioned rubric scores.
>
>
> I chose an evidence-first multimodal design over training a new classifier because the reference dataset is small and a recruiter needs to evaluate a new, unseen recording. This approach is easier to inspect and iterate on under the challenge time limit. Next.js and TypeScript provide the UI and validated API, PostgreSQL stores durable jobs and reports, and an isolated Python worker handles media processing.
>
>
> [REPLACE WITH VERIFIED RESULTS: e.g., tested N recordings, held out one, audited N timestamp references, confirmed hosted processing of a real file.] [DESCRIBE AN ACTUAL FAILURE AND FIX HERE.] The main limitations are imperfect transcription, sparse visual sampling, potential ambiguity in teaching-quality rubrics, and dependence on sufficient recording quality. Scores should be treated as a decision-support tool, not definitive judgments of individual teachers. All source recordings are handled privately, and any external model is used only if authorised for the data.

## Submission checklist

- [ ] Verify organiser deadline and timezone (PDF specifies start Wednesday 6 PM, deadline Friday noon without a timezone).
- [ ] Working externally accessible site; one real unseen recording tested.
- [ ] GitHub repo link, README, `.env.example`, no media, personal data or credentials.
- [ ] Evidence-backed four-label classification; real progress/error states.
- [ ] Relevant real AI prompts/conversation history exports, redacted.
- [ ] <=300-word explanation, corrected to actual implementation and results.
- [ ] Confirmed permitted processing/retention policy for identifiable children.
- [ ] Submit via https://docs.google.com/forms/d/e/1FAIpQLSemgdFdy8ijCNhKkkjhukNh71MCkfTEs2ho-3NWPEfc0j9KyQ/viewform

## Documentation / API references

- Challenge brief: user-supplied `Humaniti_AI_24_Hour_Build_Challenge.pdf`.
- Google Gemini video understanding: https://ai.google.dev/gemini-api/docs/video-understanding
- Google Drive API files listing: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list
- OpenAI file transcription (only if organiser approves): https://developers.openai.com/api/docs/guides/speech-to-text
- Next.js docs: https://nextjs.org/docs
- Prisma PostgreSQL: https://www.prisma.io/docs/orm/overview/databases/postgresql

**End of delivery.**
