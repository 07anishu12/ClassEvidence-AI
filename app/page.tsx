import Link from "next/link";
import AssessmentForm from "@/components/assessment-form";
import { env } from "@/lib/config/env";
import { qualityThresholds } from "@/lib/domain/rubric";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ assessment?: string }> }) {
  const { assessment } = await searchParams;
  const initialId = assessment && /^[A-Za-z0-9_-]{1,100}$/.test(assessment) ? assessment : "";
  return <main id="main-content" className="workspace">
    <a className="skip-link" href="#assess">Skip to your workspace</a>
    <nav className="brand-row" aria-label="Workspace"><Link className="wordmark" href="/">humaniti<span>ai</span></Link><Link href="/demo">Explore the demo</Link></nav>
    <header className="page-intro"><p className="eyebrow">Teaching, in focus</p><h1>Class feedback,<br /><em>grounded in evidence.</em></h1><p>Upload a permitted recording. Review a provisional quality label alongside source excerpts, practical next steps and the limits of what was assessed.</p></header>
    <div className="intro-actions"><a className="primary" href="#assess">Assess a recording <span aria-hidden="true">↗</span></a><Link className="secondary" href="/demo">View a synthetic example</Link></div>
    <div className="workflow-note" aria-label="Assessment steps"><span>01 <strong>Upload privately</strong></span><span>02 <strong>Process the recording</strong></span><span>03 <strong>Review the evidence</strong></span></div>
    <section className="rubric-explainer" aria-labelledby="labels-title">
      <h2 id="labels-title">Four labels. Evidence comes first.</h2>
      <p className="muted">When there is enough validated evidence, the rubric assigns exactly one label to the sampled teaching moments.</p>
      <dl className="label-guide">
        <div><dt>Poor <span>Below {qualityThresholds.poorBelow}</span></dt><dd>Substantial improvement needs in the assessed moments.</dd></div>
        <div><dt>Average <span>{qualityThresholds.poorBelow} to below {qualityThresholds.averageBelow}</span></dt><dd>A usable foundation, with uneven support or follow-through.</dd></div>
        <div><dt>Good <span>{qualityThresholds.averageBelow} to below {qualityThresholds.goodBelow}</span></dt><dd>Generally strong practice, with opportunities to refine.</dd></div>
        <div><dt>Excellent <span>{qualityThresholds.goodBelow}–100</span></dt><dd>Strong, consistent support across the assessed dimensions.</dd></div>
      </dl>
      <p className="hint">Ranges are rubric scores, not probabilities or school grades. This rubric is uncalibrated: its anchors and thresholds have not been validated against representative expert reviews.</p>
      <details><summary>What this assessment can—and cannot—tell you</summary><ul className="limitations">
        <li>A human reviewer should check the cited moments and context before using a result. A label is decision support, not a verdict on a teacher.</li>
        <li>Sampling can miss important moments. Transcription and model interpretations can be wrong; coverage confidence is not a measure of accuracy.</li>
        <li>Missing evidence is not a negative score. If essential evidence is missing, the app withholds the overall label and explains the limitations.</li>
        <li>Accent, facial expressions, apparent happiness, internet conditions and children’s personal attributes are not teaching-quality proxies.</li>
      </ul></details>
    </section>
    {env.ASSESSMENT_PROVIDER === "blocked" && <p className="notice" role="status">The assessment processor is not configured. Uploads cannot produce a quality report until a permitted processor is available.</p>}
    <AssessmentForm maxBytes={env.MAX_UPLOAD_BYTES} initialId={initialId}
      urlEnabled={process.env.URL_IMPORT_ENABLED === "true"} driveEnabled={process.env.DRIVE_IMPORT_ENABLED === "true"} />
    <footer className="workspace-footer"><span>Humaniti AI · Evidence before judgment</span><p>Decision support, not a guaranteed grade. Missing signals are left unassessed.</p></footer>
  </main>;
}
