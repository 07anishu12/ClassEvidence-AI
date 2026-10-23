"use client";

import { useState } from "react";
import type { CoachingReport } from "@/lib/domain/report";
import { rubricDimensions } from "@/lib/domain/rubric";
import { demoReport } from "@/lib/demo";

export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60).toString().padStart(2, "0");
  const s = (whole % 60).toString().padStart(2, "0");
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

const modalityMeta: Record<string, { icon: string; label: string }> = {
  transcript: { icon: "📝", label: "Transcript" },
  video: { icon: "🎬", label: "Video" },
  audio: { icon: "🔊", label: "Audio" },
  metadata: { icon: "ℹ️", label: "Metadata" },
};

const labelThemes: Record<string, { bg: string; text: string; border: string }> = {
  Excellent: { bg: "#064e3b", text: "#a7f3d0", border: "#10b981" },
  Good: { bg: "#0f3b39", text: "#9ae0d0", border: "#2dd4bf" },
  Average: { bg: "#3e2808", text: "#fde68a", border: "#f59e0b" },
  Poor: { bg: "#3f1313", text: "#fecdd3", border: "#f43f5e" },
};

export default function AssessmentReport({ value, synthetic = false }: { value: CoachingReport; synthetic?: boolean }) {
  const qualityLabel = value.report?.qualityLabel;
  const isInsufficient = !value.report || qualityLabel === null;
  const badgeTheme = qualityLabel ? labelThemes[qualityLabel] : { bg: "#1e293b", text: "#cbd5e1", border: "#64748b" };

  return (
    <article className="report" aria-labelledby="report-title">
      <header className="report-header">
        <p className="eyebrow">{synthetic ? "Synthetic example report" : "Your assessment"}</p>
        <div className="flex flex-wrap items-center gap-3 my-2">
          <span
            className="inline-flex items-center px-3 py-1 rounded-md text-sm font-bold uppercase tracking-wider"
            style={{ backgroundColor: badgeTheme.bg, color: badgeTheme.text, border: `2px solid ${badgeTheme.border}` }}
            role="status"
            aria-label={`Overall quality label: ${qualityLabel ?? "More evidence needed"}`}
          >
            {qualityLabel ?? "More evidence needed"}
          </span>
          {value.report?.scorePercent !== null && value.report?.scorePercent !== undefined && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-[#10212c] text-[#f1f4ee] border border-[#2d424f]">
              {value.report.scorePercent}% rubric score
            </span>
          )}
        </div>
        <h2 id="report-title">{qualityLabel ?? "More evidence needed"}</h2>
        <p>
          {value.report
            ? `${value.report.scorePercent === null ? "Score unavailable" : `${value.report.scorePercent}%`}${synthetic ? " (illustrative)" : ""} on rubric ${value.report.rubricVersion}`
            : "The available evidence does not support an overall quality label."}
        </p>
        <p className="muted">
          Coverage confidence: {Math.round(value.confidence * 100)}%{synthetic ? " (illustrative)" : ""} · an evidence coverage index, not a guaranteed grade.
        </p>
        <p className="hint">Uncalibrated rubric. Human review of the evidence and context is required before using this result.</p>
      </header>

      {isInsufficient && (
        <aside className="notice border-l-4 border-amber-400 bg-[#162530] p-5 my-6 rounded-r-lg" role="alert" aria-labelledby="insufficient-heading">
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden="true">⚠️</span>
            <div>
              <h3 id="insufficient-heading" className="text-lg font-bold text-amber-300 m-0">Inadequate evidence to award an overall quality label</h3>
              <p className="text-sm text-[#f1f4ee] mt-2 mb-2">
                This recording could not be awarded an overall quality label because the validated evidence does not meet the minimum assessable threshold. Essential rubric dimensions (such as conceptual clarity, learner responsiveness, or lesson structure) lacked sufficient coverage.
              </p>
              <p className="text-xs text-[#b4c3cc] m-0">
                <strong>Fairness &amp; Privacy Rule:</strong> Missing signals are treated as unassessed, never as negative evidence. All preserved transcript or frame observations remain available below for human inspection without a fabricated score.
              </p>
            </div>
          </div>
        </aside>
      )}

      {value.report && (
        <section aria-labelledby="dimensions-title">
          <h3 id="dimensions-title">Across the rubric</h3>
          <p className="text-xs text-[#b4c3cc] mb-4">Each dimension is scored 0–4 based on observable anchors. Click to expand or collapse details and cited moments.</p>
          <div className="dimension-list">
            {value.report.dimensions.map((d) => (
              <details className="dimension-card border border-[#2d424f] rounded-lg p-4 my-3 bg-[#10212c] select-none" open key={d.key}>
                <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-4 font-semibold">
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#9ae0d0] font-mono">[{d.score !== null ? `${d.score}/4` : "—"}]</span>
                      <h4 className="inline text-base font-semibold text-[#f1f4ee]">{rubricDimensions.find((r) => r.key === d.key)?.label ?? d.key}</h4>
                    </div>
                    <p className="text-xs text-[#b4c3cc] mt-1 font-normal">{d.rationale}</p>
                  </div>
                  <div className="dimension-value text-right">
                    <strong className="block text-sm font-semibold">{d.score === null ? "Not assessable" : `${d.score}/4`}</strong>
                    {d.score !== null && <meter min={0} max={4} value={d.score} aria-label={`${d.key} score`} />}
                  </div>
                </summary>
                {d.evidenceIds.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#223743] text-xs text-[#b4c3cc]">
                    <span className="font-semibold text-[#9ae0d0]">Cited moments: </span>
                    {d.evidenceIds.map((id) => (
                      <a key={id} href={`#${id}`} className="mr-3 underline text-[#9ae0d0] hover:text-white">
                        Moment #{id.replace("evidence_", "")}
                      </a>
                    ))}
                  </div>
                )}
              </details>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="evidence-title">
        <h3 id="evidence-title">{synthetic ? "Illustrative evidence" : "Evidence from the recording"}</h3>
        <p className="muted">
          {synthetic
            ? "Invented excerpts and timestamps for this example only; no real recording is represented."
            : "Exact transcript excerpts or sampled frame references. Interpretations remain provisional."}
        </p>
        {value.observations.length ? (
          <ol className="evidence-list">
            {value.observations.map((o) => {
              const meta = modalityMeta[o.modality] ?? { icon: "📌", label: o.modality };
              return (
                <li key={o.id} id={o.id} className="scroll-mt-8">
                  <div className="evidence-time flex flex-wrap items-center gap-2 text-sm text-[#9ae0d0]">
                    <span>
                      {formatTime(o.startSec)}–{formatTime(o.endSec)}
                    </span>
                    <span className="tag inline-flex items-center gap-1">
                      <span aria-hidden="true">{meta.icon}</span>
                      <span>{meta.label}</span>
                    </span>
                    <span className="text-xs text-[#b4c3cc]">[{o.uncertainty} uncertainty]</span>
                  </div>
                  <blockquote>{o.evidence}</blockquote>
                  <p className="muted">
                    {rubricDimensions.find((d) => d.key === o.dimension)?.label ?? o.dimension} · impact: {o.impact.replaceAll("_", " ")}
                  </p>
                  {o.claim && <p className="text-xs text-[#b4c3cc] italic m-0">Observation: {o.claim}</p>}
                </li>
              );
            })}
          </ol>
        ) : (
          <p>No observations survived evidence validation. A teaching-quality judgment would be unsupported.</p>
        )}
      </section>

      {(value.strengths.length > 0 || value.opportunities.length > 0) && (
        <section aria-labelledby="reflection-title">
          <h3 id="reflection-title">Moments to reflect on</h3>
          {[...value.strengths, ...value.opportunities].map((item, i) => (
            <p key={i}>
              {item.text}{" "}
              {item.evidenceIds.map((id) => (
                <a key={id} href={`#${id}`} className="underline text-[#9ae0d0]">
                  View evidence <span className="sr-only">{id}</span>
                </a>
              ))}
            </p>
          ))}
        </section>
      )}

      {value.nextSteps.length > 0 && (
        <section aria-labelledby="coaching-title">
          <h3 id="coaching-title">Try in your next class</h3>
          <ol className="next-steps">
            {value.nextSteps.map((step) => (
              <li key={step.dimension}>
                {step.text}{" "}
                {step.evidenceIds.length > 0 && (
                  <a href={`#${step.evidenceIds[0]}`} className="underline text-[#9ae0d0]">
                    Related moment
                  </a>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <details open>
        <summary>Uncertainty &amp; technical limitations</summary>
        <ul className="limitations">
          {value.limitations.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Synthetic Demo Mock Data (Instant showcase for all 4 labels + insufficient)
// ---------------------------------------------------------------------------

const demoExcellentReport: CoachingReport = {
  status: "assessed",
  providerVersion: "synthetic-display-only",
  recordingSha256: null,
  sourceArtifacts: [],
  report: {
    qualityLabel: "Excellent",
    scorePercent: 92,
    rubricVersion: "0.1",
    confidence: 0.85,
    assessmentLimitations: [
      "Synthetic demonstration report illustrating the Excellent rubric tier (>=80%).",
      "All scores, excerpts, and timestamps are authored fixtures for display only.",
    ],
    dimensions: [
      { key: "clarity_accuracy", score: 4, evidenceIds: ["evidence_demo_exc_clarity"], rationale: "Exemplary precision: concepts are clearly introduced with visual fraction models and mathematically rigorous terminology." },
      { key: "interaction_responsiveness", score: 4, evidenceIds: ["evidence_demo_exc_interaction"], rationale: "Proactive diagnostic questioning that directly validates student reasoning before guiding toward mastery." },
      { key: "lesson_structure", score: 4, evidenceIds: ["evidence_demo_exc_structure"], rationale: "Deliberate pacing with explicit objectives, seamless transitions, and dedicated time for partner synthesis." },
      { key: "instructional_practice", score: 4, evidenceIds: ["evidence_demo_exc_practice"], rationale: "High active engagement; teacher continuously gathers evidence of student thinking during the worked task." },
      { key: "technical_usability", score: 4, evidenceIds: ["evidence_demo_exc_tech"], rationale: "Speech audio is crystal clear and visual diagram exhibits high legibility throughout." },
    ],
    observations: [
      { id: "evidence_demo_exc_clarity", startSec: 25, endSec: 55, modality: "transcript", claim: "Rigorous explanation connecting conceptual partitions to fraction notation.", evidence: "The denominator defines how many equal partitions compose the unit, whereas the numerator counts how many partitions are highlighted.", impact: "positive", provenance: { source: "transcript", locator: "synthetic_exc_clarity" } },
      { id: "evidence_demo_exc_interaction", startSec: 110, endSec: 140, modality: "transcript", claim: "Responsive probing diagnosing student thinking.", evidence: "Maya, why would a larger denominator result in smaller slice sizes? Let us verify by folding two paper strips together.", impact: "positive", provenance: { source: "transcript", locator: "synthetic_exc_interaction" } },
      { id: "evidence_demo_exc_structure", startSec: 200, endSec: 230, modality: "transcript", claim: "Seamless transition from guided practice to peer discussion.", evidence: "We proved this theorem together; now spend three minutes comparing step four with your partner, then we will share insights.", impact: "positive", provenance: { source: "transcript", locator: "synthetic_exc_structure" } },
      { id: "evidence_demo_exc_practice", startSec: 310, endSec: 340, modality: "video", claim: "Active learner task with ongoing formative checks.", evidence: "Teacher circulates, observes student work on mini-whiteboards, and highlights an efficient common approach on the main screen.", impact: "positive", provenance: { source: "recording", locator: "synthetic_exc_practice" } },
      { id: "evidence_demo_exc_tech", startSec: 0, endSec: 20, modality: "audio", claim: "High technical usability across audio and video channels.", evidence: "Instructional speech is clean with zero clipping or dropout; board annotations maintain high visual contrast.", impact: "positive", provenance: { source: "metadata", locator: "synthetic_exc_tech" } },
    ],
    recommendations: ["Maintain explicit lesson pacing and encourage learners to formulate alternate solution paths during whole-class debriefs."],
  },
  observations: [
    { id: "evidence_demo_exc_clarity", startSec: 25, endSec: 55, modality: "transcript", dimension: "clarity_accuracy", uncertainty: "low", impact: "positive", claim: "Rigorous explanation connecting conceptual partitions to fraction notation.", evidence: "The denominator defines how many equal partitions compose the unit, whereas the numerator counts how many partitions are highlighted.", provenance: { source: "transcript", locator: "synthetic_exc_clarity" } },
    { id: "evidence_demo_exc_interaction", startSec: 110, endSec: 140, modality: "transcript", dimension: "interaction_responsiveness", uncertainty: "low", impact: "positive", claim: "Responsive probing diagnosing student thinking.", evidence: "Maya, why would a larger denominator result in smaller slice sizes? Let us verify by folding two paper strips together.", provenance: { source: "transcript", locator: "synthetic_exc_interaction" } },
    { id: "evidence_demo_exc_structure", startSec: 200, endSec: 230, modality: "transcript", dimension: "lesson_structure", uncertainty: "low", impact: "positive", claim: "Seamless transition from guided practice to peer discussion.", evidence: "We proved this theorem together; now spend three minutes comparing step four with your partner, then we will share insights.", provenance: { source: "transcript", locator: "synthetic_exc_structure" } },
    { id: "evidence_demo_exc_practice", startSec: 310, endSec: 340, modality: "video", dimension: "instructional_practice", uncertainty: "low", impact: "positive", claim: "Active learner task with ongoing formative checks.", evidence: "Teacher circulates, observes student work on mini-whiteboards, and highlights an efficient common approach on the main screen.", provenance: { source: "recording", locator: "synthetic_exc_practice" } },
    { id: "evidence_demo_exc_tech", startSec: 0, endSec: 20, modality: "audio", dimension: "technical_usability", uncertainty: "low", impact: "positive", claim: "High technical usability across audio and video channels.", evidence: "Instructional speech is clean with zero clipping or dropout; board annotations maintain high visual contrast.", provenance: { source: "metadata", locator: "synthetic_exc_tech" } },
  ],
  strengths: [
    { dimension: "clarity_accuracy", evidenceIds: ["evidence_demo_exc_clarity"], text: "Conceptual clarity: precise explanations anchored in visual fraction models." },
    { dimension: "interaction_responsiveness", evidenceIds: ["evidence_demo_exc_interaction"], text: "Responsiveness: expertly validates student reasoning before guiding toward resolution." },
  ],
  opportunities: [],
  nextSteps: [
    { dimension: "instructional_practice", evidenceIds: ["evidence_demo_exc_practice"], text: "Invite students to formulate their own practice problems for peer verification." },
  ],
  limitations: [
    "Synthetic prerecorded showcase fixture: all excerpts, moments and scores are authored illustrations.",
    "This demo does not run AI inference on a live recording or require a GPU.",
  ],
  confidence: 0.85,
  confidenceBasis: { temporalCoverage: 0.85, evidenceQuality: 0.95, agreement: null, assessableWeight: 100 },
};

const demoAverageReport: CoachingReport = {
  status: "assessed",
  providerVersion: "synthetic-display-only",
  recordingSha256: null,
  sourceArtifacts: [],
  report: {
    qualityLabel: "Average",
    scorePercent: 54,
    rubricVersion: "0.1",
    confidence: 0.65,
    assessmentLimitations: [
      "Synthetic demonstration report illustrating the Average rubric tier (40–59.99%).",
      "Demonstrates foundational instructional structure with uneven responsiveness or follow-through.",
    ],
    dimensions: [
      { key: "clarity_accuracy", score: 2, evidenceIds: ["evidence_demo_avg_clarity"], rationale: "Procedurally sound fraction rules given, but conceptual rationale was omitted." },
      { key: "interaction_responsiveness", score: 2, evidenceIds: ["evidence_demo_avg_interaction"], rationale: "Teacher answers own questions; wait time is insufficient for student reflection." },
      { key: "lesson_structure", score: 3, evidenceIds: ["evidence_demo_avg_structure"], rationale: "Recognizable pacing and orderly sequence through planned curriculum materials." },
      { key: "instructional_practice", score: null, evidenceIds: [], rationale: "Individual practice mentioned but student performance signals not captured." },
      { key: "technical_usability", score: null, evidenceIds: [], rationale: "Technical usability metrics unassessed in this synthetic sample." },
    ],
    observations: [
      { id: "evidence_demo_avg_clarity", startSec: 40, endSec: 65, modality: "transcript", claim: "Procedural fraction rule given without conceptual grounding.", evidence: "To add fractions, find the common denominator and then add the numerators. Just remember the rule.", impact: "positive", provenance: { source: "transcript", locator: "synthetic_avg_clarity" } },
      { id: "evidence_demo_avg_interaction", startSec: 120, endSec: 140, modality: "transcript", claim: "Quick self-answered question without wait time.", evidence: "What do we do next? We multiply by three, correct, let us continue.", impact: "negative", provenance: { source: "transcript", locator: "synthetic_avg_interaction" } },
      { id: "evidence_demo_avg_structure", startSec: 220, endSec: 245, modality: "transcript", claim: "Basic transition into worksheet practice.", evidence: "Open exercise two on page fifteen and begin working on problems one to four.", impact: "positive", provenance: { source: "transcript", locator: "synthetic_avg_structure" } },
    ],
    recommendations: ["Increase wait time to at least 3–5 seconds after questions to allow learners to formulate answers."],
  },
  observations: [
    { id: "evidence_demo_avg_clarity", startSec: 40, endSec: 65, modality: "transcript", dimension: "clarity_accuracy", uncertainty: "medium", impact: "positive", claim: "Procedural fraction rule given without conceptual grounding.", evidence: "To add fractions, find the common denominator and then add the numerators. Just remember the rule.", provenance: { source: "transcript", locator: "synthetic_avg_clarity" } },
    { id: "evidence_demo_avg_interaction", startSec: 120, endSec: 140, modality: "transcript", dimension: "interaction_responsiveness", uncertainty: "low", impact: "negative", claim: "Quick self-answered question without wait time.", evidence: "What do we do next? We multiply by three, correct, let us continue.", provenance: { source: "transcript", locator: "synthetic_avg_interaction" } },
    { id: "evidence_demo_avg_structure", startSec: 220, endSec: 245, modality: "transcript", dimension: "lesson_structure", uncertainty: "low", impact: "positive", claim: "Basic transition into worksheet practice.", evidence: "Open exercise two on page fifteen and begin working on problems one to four.", provenance: { source: "transcript", locator: "synthetic_avg_structure" } },
  ],
  strengths: [
    { dimension: "lesson_structure", evidenceIds: ["evidence_demo_avg_structure"], text: "Lesson structure: orderly progression through planned worksheet exercises." },
  ],
  opportunities: [
    { dimension: "interaction_responsiveness", evidenceIds: ["evidence_demo_avg_interaction"], text: "Interaction responsiveness: pause after questions rather than immediately answering." },
  ],
  nextSteps: [
    { dimension: "clarity_accuracy", evidenceIds: ["evidence_demo_avg_clarity"], text: "In your next explanation, use a quick visual diagram to justify the procedural rule." },
  ],
  limitations: [
    "Synthetic prerecorded showcase fixture: all excerpts, moments and scores are authored illustrations.",
  ],
  confidence: 0.65,
  confidenceBasis: { temporalCoverage: 0.5, evidenceQuality: 0.8, agreement: null, assessableWeight: 70 },
};

const demoPoorReport: CoachingReport = {
  status: "assessed",
  providerVersion: "synthetic-display-only",
  recordingSha256: null,
  sourceArtifacts: [],
  report: {
    qualityLabel: "Poor",
    scorePercent: 32,
    rubricVersion: "0.1",
    confidence: 0.60,
    assessmentLimitations: [
      "Synthetic demonstration report illustrating the Poor rubric tier (<40%).",
      "Demonstrates substantial improvement needs across clarity, question response, and closing structure.",
    ],
    dimensions: [
      { key: "clarity_accuracy", score: 1, evidenceIds: ["evidence_demo_poor_clarity"], rationale: "Frequent confusion in basic terminology and uncorrected reversals in explanations." },
      { key: "interaction_responsiveness", score: 1, evidenceIds: ["evidence_demo_poor_interaction"], rationale: "Student questions were dismissed without support or diagnostic check." },
      { key: "lesson_structure", score: 1, evidenceIds: ["evidence_demo_poor_structure"], rationale: "Lacks explicit learning objectives, guided practice, and synthesis." },
      { key: "instructional_practice", score: null, evidenceIds: [], rationale: "Instructional practice not assessable from available transcript moments." },
      { key: "technical_usability", score: null, evidenceIds: [], rationale: "Technical usability metrics unassessed in this synthetic sample." },
    ],
    observations: [
      { id: "evidence_demo_poor_clarity", startSec: 30, endSec: 60, modality: "transcript", claim: "Confusing terminology and mathematical error.", evidence: "Remember, the numerator is the bottom number and denominator is top—wait, no, reverse that, just follow what I wrote on the board.", impact: "negative", provenance: { source: "transcript", locator: "synthetic_poor_clarity" } },
      { id: "evidence_demo_poor_interaction", startSec: 100, endSec: 125, modality: "transcript", claim: "Dismissed student confusion without explanation.", evidence: "Student: I do not understand why we cross multiply. Teacher: We do not have time for questions right now, just copy it down.", impact: "negative", provenance: { source: "transcript", locator: "synthetic_poor_interaction" } },
      { id: "evidence_demo_poor_structure", startSec: 180, endSec: 200, modality: "transcript", claim: "Abrupt termination without summary or check.", evidence: "Bell is about to ring, stop writing and turn in your papers at the door.", impact: "negative", provenance: { source: "transcript", locator: "synthetic_poor_structure" } },
    ],
    recommendations: ["Establish clear lesson objectives at the start and set aside 5 minutes for student questions."],
  },
  observations: [
    { id: "evidence_demo_poor_clarity", startSec: 30, endSec: 60, modality: "transcript", dimension: "clarity_accuracy", uncertainty: "low", impact: "negative", claim: "Confusing terminology and mathematical error.", evidence: "Remember, the numerator is the bottom number and denominator is top—wait, no, reverse that, just follow what I wrote on the board.", provenance: { source: "transcript", locator: "synthetic_poor_clarity" } },
    { id: "evidence_demo_poor_interaction", startSec: 100, endSec: 125, modality: "transcript", dimension: "interaction_responsiveness", uncertainty: "low", impact: "negative", claim: "Dismissed student confusion without explanation.", evidence: "Student: I do not understand why we cross multiply. Teacher: We do not have time for questions right now, just copy it down.", provenance: { source: "transcript", locator: "synthetic_poor_interaction" } },
    { id: "evidence_demo_poor_structure", startSec: 180, endSec: 200, modality: "transcript", dimension: "lesson_structure", uncertainty: "low", impact: "negative", claim: "Abrupt termination without summary or check.", evidence: "Bell is about to ring, stop writing and turn in your papers at the door.", provenance: { source: "transcript", locator: "synthetic_poor_structure" } },
  ],
  strengths: [],
  opportunities: [
    { dimension: "clarity_accuracy", evidenceIds: ["evidence_demo_poor_clarity"], text: "Clarity: prepare definitions in advance to ensure correct mathematical terminology." },
    { dimension: "interaction_responsiveness", evidenceIds: ["evidence_demo_poor_interaction"], text: "Responsiveness: validate student confusion and offer a brief clarifying hint." },
  ],
  nextSteps: [
    { dimension: "interaction_responsiveness", evidenceIds: ["evidence_demo_poor_interaction"], text: "Acknowledge student questions positively and incorporate checks for understanding." },
  ],
  limitations: [
    "Synthetic prerecorded showcase fixture: all excerpts, moments and scores are authored illustrations.",
  ],
  confidence: 0.60,
  confidenceBasis: { temporalCoverage: 0.4, evidenceQuality: 0.8, agreement: null, assessableWeight: 70 },
};

const demoInsufficientReport: CoachingReport = {
  status: "insufficient_evidence",
  providerVersion: "synthetic-display-only",
  recordingSha256: null,
  sourceArtifacts: [],
  report: null,
  observations: [
    {
      id: "evidence_demo_insuf_audio",
      startSec: 5,
      endSec: 15,
      modality: "transcript",
      dimension: "technical_usability",
      uncertainty: "high",
      impact: "neutral",
      claim: "Brief isolated audio fragment during class setup.",
      evidence: "Can everyone hear me? Is the screen visible?",
      provenance: { source: "transcript", locator: "synthetic_insuf_audio" },
    },
  ],
  strengths: [],
  opportunities: [],
  nextSteps: [],
  limitations: [
    "Recording length is insufficient (under 60 seconds of instructional speech).",
    "Core rubric dimensions (clarity, responsiveness, structure) lacked the required 70% assessable weight.",
    "Missing signals are left unassessed and never converted into negative evidence.",
    "No overall quality label or fake numerical score is awarded.",
  ],
  confidence: 0.10,
  confidenceBasis: { temporalCoverage: 0.05, evidenceQuality: 0.5, agreement: null, assessableWeight: 10 },
};

export const demoReports: Record<string, CoachingReport> = {
  good: demoReport,
  excellent: demoExcellentReport,
  average: demoAverageReport,
  poor: demoPoorReport,
  insufficient: demoInsufficientReport,
};

// ---------------------------------------------------------------------------
// Interactive Demo Showcase Component
// ---------------------------------------------------------------------------

export function DemoShowcase({ initialKey = "good" }: { initialKey?: string }) {
  const [selectedKey, setSelectedKey] = useState<string>(initialKey);
  const currentReport = demoReports[selectedKey] ?? demoReport;

  const demoOptions = [
    { key: "excellent", label: "★ Excellent (92%)", desc: "Strong support across all rubric dimensions" },
    { key: "good", label: "✔ Good (75%)", desc: "Generally strong practice with refinement areas" },
    { key: "average", label: "⚖ Average (54%)", desc: "Usable foundation with uneven responsiveness" },
    { key: "poor", label: "⚠ Poor (32%)", desc: "Substantial improvement needs in clarity and check-ins" },
    { key: "insufficient", label: "✕ Insufficient Evidence", desc: "Honest withheld label when signals are inadequate" },
  ];

  return (
    <div className="demo-showcase">
      <div className="demo-selector-bar my-6 p-4 bg-[#0c1c26] border border-[#2d424f] rounded-xl" role="region" aria-label="Demo tier selector">
        <p className="text-xs font-bold uppercase tracking-wider text-[#9ae0d0] mb-2">
          Interactive showcase · Select any rubric tier to view instantaneously without a backend or GPU:
        </p>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Synthetic demo tiers">
          {demoOptions.map((opt) => {
            const isSelected = selectedKey === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls="demo-report-view"
                id={`tab-${opt.key}`}
                onClick={() => setSelectedKey(opt.key)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                  isSelected
                    ? "bg-[#9ae0d0] text-[#08151e] shadow-md border-2 border-white"
                    : "bg-[#10212c] text-[#f1f4ee] hover:bg-[#1a313e] border border-[#2d424f]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[#b4c3cc] mt-2 mb-0" id="tab-description">
          {demoOptions.find((o) => o.key === selectedKey)?.desc}
        </p>
      </div>

      <div id="demo-report-view" role="tabpanel" aria-labelledby={`tab-${selectedKey}`}>
        <AssessmentReport value={currentReport} synthetic />
      </div>
    </div>
  );
}
