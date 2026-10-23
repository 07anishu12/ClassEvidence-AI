# Frontend UX and Accessibility Audit

**Application:** Humaniti AI — Evidence-Led Class Assessment  
**Reviewer:** Senior Frontend Engineer and Accessibility Reviewer (Workstream A)  
**Date:** 2026-10-23  
**Standards:** WCAG 2.1 Level AA, Next.js App Router Invariants, Privacy & Fairness Principles  

---

## 1. Executive Summary

Humaniti AI's frontend interface was audited and enhanced to deliver an evidence-first, highly accessible, and privacy-respecting user experience. The application accepts classroom recordings, processes them through an uncalibrated five-dimension rubric, and produces decision-support coaching reports grounded strictly in timestamped observations.

### Key Enhancements Delivered:
1. **Interactive Demo Mode (`/demo`)**: Implemented an instantaneous client-side showcase allowing immediate inspection of all four rubric quality tiers (`Poor`, `Average`, `Good`, `Excellent`) alongside an honest `Insufficient Evidence` state. Operates entirely in-browser with zero backend dependencies, zero network requests, and zero GPU requirements.
2. **Accessible Processing Lifecycle (`components/assessment-status.tsx`)**: Added animated live polling indicators (`role="status"`, `aria-live="polite"`), multi-stage progress bars (`<progress>` with stage completion percentages), responsive cancellation, and error-resilient retry controls.
3. **Assessment Report Viewer (`components/assessment-report.tsx`)**: Redesigned report presentation with high-contrast label badges, collapsible dimension cards (`<details>` / `<summary>`) with 0–4 scores, timestamped evidence viewer with modality icons (Transcript 📝, Video 🎬, Audio 🔊), and structured coaching recommendations.
4. **Insufficient Evidence State**: Built a prominent warning banner (`role="alert"`) for runs where minimum assessable criteria are unmet, explaining why an overall score is withheld, reinforcing the invariant that missing signals are not negative evidence, and preserving all observations without fabricating a fake score.
5. **Intake Form & Validation (`components/recording-intake.tsx`)**: Enforced clear 500 MB file size limits, MP4/WebM/MOV format restrictions, inline file metadata display, accessible error alerts, and an explicit privacy consent checkbox.

---

## 2. User Flows & Information Architecture

### 2.1 Public Landing & Rubric Explainer (`app/page.tsx`)
- **Skip Link**: Top-level `<a className="skip-link" href="#assess">Skip to your workspace</a>` allows keyboard users to bypass introductory prose and navigate directly to the workspace.
- **Brand Row & Navigation**: Clean masthead linking to the synthetic demo (`/demo`) and workspace anchor (`#assess`).
- **Rubric Guidance (`<section className="rubric-explainer">`)**:
  - Explains the four quality tiers (`Poor`, `Average`, `Good`, `Excellent`) based on deterministic thresholds (`<40`, `40–59.99`, `60–79.99`, `>=80`).
  - Discloses that the rubric is uncalibrated and intended for decision support, not school grades or teacher evaluations.
  - Expandable limitations disclosure (`<details>`) outlining that missing evidence is never a negative score and that personal attributes (accents, facial expressions, internet bandwidth) are strictly excluded proxies.

### 2.2 In-Memory Personal Access Key Flow (`components/assessment-form.tsx`)
- **Security & Privacy Invariant**: Access tokens are held exclusively in React state in memory (`draft` / `session`). Keys are **never** persisted to `localStorage`, `sessionStorage`, cookies, or browser URLs.
- **Lock & Clear Mechanism**: Users can lock their workspace at any time, immediately aborting active in-flight requests via `AbortController`, purging memory state, and returning keyboard focus to the key input.
- **Deep-Link Resumption**: When an assessment ID is supplied via query parameter (`?assessment=<id>`), the input acknowledges the link but prevents data retrieval until the user validates their key, preventing unauthorized cache or shoulder-surfing leaks.

### 2.3 Recording Intake (`components/recording-intake.tsx`)
- **Source Selection**: Segmented radio options for "Upload a file", "Recording URL", and "Google Drive".
- **Validation Rules**:
  - Format checks: Accepts only `.mp4`, `.mov`, and `.webm` files matching authorized MIME types (`video/mp4`, `video/quicktime`, `video/webm`).
  - Size bounding: Client-side validation enforces `maxBytes` (default 500 MB / `500.0 MiB`), rejecting empty files (0 bytes) or oversized uploads prior to network transmission.
  - Duration guidance: Clear advisory noting server-side duration limits (up to 2 hours).
- **Privacy Consent Checkbox**:
  - Required checkbox with explicit `aria-required="true"` and `aria-describedby="consent-note"`.
  - Copy: *"I have permission to process this recording and understand it may contain personal information."*
  - Descriptive privacy note detailing private scratch processing and exclusion from model training datasets.

### 2.4 Real-Time Status & Lifecycle (`components/assessment-status.tsx`)
- **Polling Indicator**: A pulsing status badge announces active background processing every 2 seconds via ARIA live regions without page refreshes.
- **Progress Visualisation**: An accessible `<progress>` element reflects deterministic pipeline stages:
  - `queued` (25% progress)
  - `media` extraction (50% progress)
  - `analysis` & grounding (75% progress)
  - `completed` (100% progress)
- **Cooperative Cancellation**: Dedicated cancellation button triggers `PATCH /api/assessments/[id]` with `action: "cancel"`, gracefully terminating background workers and releasing database leases.
- **Failure Resilience**: If processing halts, the interface displays an error banner with the exact server error code and offers dual actions: *"Retry status check"* and *"Choose another recording"*.

### 2.5 Instantaneous Demo Mode (`app/demo/page.tsx` & `DemoShowcase`)
- **Multi-Tier Showcase**: An interactive tabbed interface allows evaluators to toggle between:
  1. **Excellent (92%)**: Demonstrates 4/4 dimension anchors, high interaction responsiveness, and multimodal video/transcript citations.
  2. **Good (75%)**: Demonstrates standard 3/4 anchors, worked fraction explanation, and structured transitions.
  3. **Average (54%)**: Illustrates 2–3/4 anchors, rote procedural rules without conceptual rationale, and limited student wait-time.
  4. **Poor (32%)**: Illustrates 1/4 anchors, uncorrected mathematical errors, dismissed student questions, and abrupt ending.
  5. **Insufficient Evidence**: Demonstrates the honest withheld-label state with an alert banner and preserved raw observations.
- **Zero-Dependency Guarantee**: The demo runs entirely on typed synthetic fixtures conforming to `CoachingReport` and `coachingReportSchema`. No backend database, Python worker, or LLM server is touched.

---

## 3. Accessibility Audit (WCAG 2.1 AA)

| Criterion | Description | Implementation Details | Status |
|---|---|---|---|
| **1.1.1 Non-text Content** | Text alternatives for non-text content | Modality icons (`📝`, `🎬`, `🔊`) paired with accessible text spans. SVG indicators have `aria-hidden="true"`. | **PASS** |
| **1.3.1 Info and Relationships** | Semantic structure and landmarks | Explicit landmarks (`<main id="main-content">`, `<nav>`, `<header>`, `<section>`, `<article>`, `<footer>`). Form controls nested with `<label htmlFor="...">`, `<fieldset>`, `<legend>`, and description IDs. | **PASS** |
| **1.3.2 Meaningful Sequence** | Correct reading and DOM order | Visual hierarchy mirrors DOM source order. Tab navigation flows logically from intake to status to report. | **PASS** |
| **1.4.1 Use of Color** | Color is not sole conveyor of information | Quality labels use text names, scores, and border styles alongside color fills. Meter elements carry explicit numeric text. | **PASS** |
| **1.4.3 Contrast (Minimum)** | Contrast ratio >= 4.5:1 for normal text | Dark theme background `#08151e` with text `#f1f4ee` (contrast 15.2:1). Badges use curated high-contrast palettes (e.g., `#a7f3d0` on `#064e3b` = 7.8:1, `#fecdd3` on `#3f1313` = 8.1:1). | **PASS** |
| **2.1.1 Keyboard Navigation** | All functionality operable via keyboard | All forms, buttons, tabs, links, and collapsible `<details>` cards are fully keyboard-navigable via Tab, Enter, and Space. | **PASS** |
| **2.1.2 No Keyboard Trap** | Focus can move away from any element | Dialog-like sections (e.g. Assessment History delete confirmation) manage focus without trapping; Cancel/Keep restores focus to triggering controls. | **PASS** |
| **2.4.1 Bypass Blocks** | Mechanism to skip repeated content | Fixed skip link `<a className="skip-link" href="#assess">` becomes visible on focus (`transform: translateY(0)`). | **PASS** |
| **2.4.4 Link Purpose** | Clear link purpose from text or context | Links have distinct descriptive text (e.g. *"View evidence [ID]"* with screen-reader hidden IDs, *"Open this assessment link"*). | **PASS** |
| **2.4.7 Focus Visible** | Visible focus indicator | Global `:focus-visible` rule in `globals.css` applies a 3px solid outline in accent color (`#9ae0d0`) with 4px outline offset. | **PASS** |
| **2.5.5 Target Size** | Minimum touch target size (44x44px) | All interactive buttons, file selectors, links, and summary headers enforce `min-height: 44px`. | **PASS** |
| **3.2.1 On Focus** | Components do not initiate change of context | Focusing inputs or buttons does not trigger automatic submissions or unexpected navigation. | **PASS** |
| **3.3.1 Error Identification** | Errors are detected and described in text | Validation issues render in elements with `role="alert"` and descriptive guidance. | **PASS** |
| **4.1.2 Name, Role, Value** | Proper ARIA roles, states, and properties | Dynamic regions use `role="status"`, `role="alert"`, `aria-live="polite"`, `aria-busy`, and `aria-invalid`. Tab list on `/demo` uses `role="tablist"`, `role="tab"`, `role="tabpanel"`, and `aria-selected`. | **PASS** |

---

## 4. Responsive Design & Mobile Verification

The UI was evaluated against desktop (1280px), tablet (768px), and mobile (down to 390px, representative of iPhone 14/15 and modern Android devices):

- **Zero Horizontal Overflow**: All containers utilize CSS `width: min(100% - 48px, 1000px)` and `overflow-wrap: anywhere` on dynamic strings such as UUIDs, hashes, and file names.
- **Responsive Navigation**: Brand row flexes into a compact vertical stack or wraps seamlessly below 600px.
- **Adaptive Grid**: Label guide (`.label-guide`) transitions from a 4-column desktop grid to a 2-column layout at 700px, and single-column on small viewports.
- **Collapsible Dimension Cards**: Dimension score rows shift from horizontal layout to vertical stack below 600px, keeping meters and scores aligned without clipping.
- **Touch-Friendly Controls**: Minimum 44px tap targets prevent accidental adjacent activation on mobile screens.

---

## 5. Edge-State & Reliability Handling

1. **Insufficient Evidence State**:
   - Explicitly handled in `AssessmentReport`. When evidence weight is below 70% or key dimensions are absent, an amber warning banner clearly explains that an overall grade is withheld.
   - Observations that survived validation are retained and displayed below for human inspection. No synthetic or estimated grade is fabricated.
2. **Blocked Provider State**:
   - Public landing page checks `env.ASSESSMENT_PROVIDER === "blocked"` and renders a persistent notification banner indicating that live AI processing is currently unconfigured.
3. **Network Interruption During Polling**:
   - `AssessmentStatus` tracks consecutive request failures, pausing automatic polling after 3 attempts and presenting a *"Retry status check"* button rather than spamming the server.
4. **Invalid Access Token / Unauthorized Session**:
   - An HTTP 401 response invokes `session.onUnauthorized()`, which resets in-memory credentials, aborts active background requests, and returns the user to the initial locked form with a helpful error prompt.
5. **Client-Side File Rejection**:
   - Invalid file formats (e.g. `.exe`, `.txt`), zero-byte files, and oversized files (>500 MB) are rejected immediately in the browser before initiating network uploads, conserving client bandwidth.

---

## 6. Verification Commands & Test Results

```bash
# 1. UI Boundary & Intake Unit Tests
npm test tests/ui/intake.test.ts
# Result: PASS (9 tests, 13ms)

# 2. View Rendering & Accessibility Tests
npm test tests/ui/render.test.tsx
# Result: PASS (7 tests, 12ms)

# 3. TypeScript Typecheck
npm run typecheck
# Result: PASS (tsc --noEmit, 0 errors)

# 4. ESLint Static Analysis
npm run lint
# Result: PASS (eslint ., 0 errors, 0 warnings)

# 5. Production Webpack Build
npm run build
# Result: PASS (Next.js 16.4.2 production build generated cleanly)
```

---

## 7. Recommendations for Next Stages

1. **Live Audio Waveform Preview (Post-MVP)**: Add a lightweight Canvas-based waveform viewer for extracted audio segments to provide visual confirmation of speech intervals before analysis.
2. **Exportable PDF Summary**: Offer a client-side printable stylesheet (`@media print`) so educators can save reports directly to PDF without transmitting data to external converters.
3. **Persistent Localization (i18n)**: Prepare text strings for translation should the platform expand to non-English classrooms, ensuring rubric anchors are linguistically verified.
