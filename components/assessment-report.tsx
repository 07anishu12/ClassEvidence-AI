import type { CoachingReport } from "@/lib/domain/report";
import { rubricDimensions } from "@/lib/domain/rubric";

export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor(whole % 3600 / 60).toString().padStart(2, "0");
  const s = (whole % 60).toString().padStart(2, "0");
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export default function AssessmentReport({ value, synthetic = false }: { value: CoachingReport; synthetic?: boolean }) {
  return <article className="report" aria-labelledby="report-title">
    <header className="report-header">
      <p className="eyebrow">{synthetic ? "Synthetic example report" : "Your assessment"}</p>
      <h2 id="report-title">{value.report?.qualityLabel ?? "More evidence needed"}</h2>
      <p>{value.report ? `${value.report.scorePercent === null ? "Score unavailable" : `${value.report.scorePercent}%`}${synthetic ? " (illustrative)" : ""} on rubric ${value.report.rubricVersion}` : "The available evidence does not support an overall quality label."}</p>
      <p className="muted">Coverage confidence: {Math.round(value.confidence * 100)}%{synthetic ? " (illustrative)" : ""} · an evidence coverage index, not a guaranteed grade.</p>
      <p className="hint">Uncalibrated rubric. Human review of the evidence and context is required before using this result.</p>
    </header>
    {value.report && <section aria-labelledby="dimensions-title">
      <h3 id="dimensions-title">Across the rubric</h3>
      <div className="dimension-list">{value.report.dimensions.map((d) => <div className="dimension" key={d.key}>
        <div><h4>{rubricDimensions.find((r) => r.key === d.key)?.label ?? d.key}</h4><p className="muted">{d.rationale}</p></div>
        <div className="dimension-value"><strong>{d.score === null ? "Not assessable" : `${d.score}/4`}</strong>
          {d.score !== null && <meter min={0} max={4} value={d.score} aria-label={`${d.key} score`} />}</div>
      </div>)}</div>
    </section>}
    <section aria-labelledby="evidence-title">
      <h3 id="evidence-title">{synthetic ? "Illustrative evidence" : "Evidence from the recording"}</h3>
      <p className="muted">{synthetic ? "Invented excerpts and timestamps for this example only; no real recording is represented." : "Exact transcript excerpts or sampled frame references. Interpretations remain provisional."}</p>
      {value.observations.length ? <ol className="evidence-list">{value.observations.map((o) => <li key={o.id} id={o.id}>
        <div className="evidence-time"><span>{formatTime(o.startSec)}–{formatTime(o.endSec)}</span><span className="tag">{o.modality}</span></div>
        <blockquote>{o.evidence}</blockquote>
        <p className="muted">{rubricDimensions.find((d) => d.key === o.dimension)?.label} · {o.impact.replaceAll("_", " ")} · {o.uncertainty} uncertainty</p>
      </li>)}</ol> : <p>No observations survived evidence validation. A teaching-quality judgment would be unsupported.</p>}
    </section>
    {(value.strengths.length > 0 || value.opportunities.length > 0) && <section aria-labelledby="reflection-title">
      <h3 id="reflection-title">Moments to reflect on</h3>
      {[...value.strengths, ...value.opportunities].map((item, i) => <p key={i}>{item.text} {item.evidenceIds.map((id) => <a key={id} href={`#${id}`}>View evidence <span className="sr-only">{id}</span></a>)}</p>)}
    </section>}
    {value.nextSteps.length > 0 && <section aria-labelledby="coaching-title"><h3 id="coaching-title">Try in your next class</h3>
      <ol className="next-steps">{value.nextSteps.map((step) => <li key={step.dimension}>{step.text} <a href={`#${step.evidenceIds[0]}`}>Related moment</a></li>)}</ol>
    </section>}
    <details open><summary>Uncertainty &amp; technical limitations</summary>
      <ul className="limitations">{value.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul>
    </details>
  </article>;
}
