import Link from "next/link";
import { DemoShowcase } from "@/components/assessment-report";

export const metadata = {
  title: "Synthetic example · Humaniti AI",
  description: "Explore an illustrative Humaniti AI report. No real media, uploads or live analysis.",
};

export default function DemoPage() {
  return (
    <main id="main-content" className="workspace">
      <a className="skip-link" href="#demo-report">
        Skip to the example report
      </a>
      <nav className="brand-row" aria-label="Demo navigation">
        <Link className="wordmark" href="/">
          humaniti<span>ai</span>
        </Link>
        <Link href="/#assess">Your workspace</Link>
      </nav>
      <header className="page-intro">
        <p className="eyebrow">A guided look</p>
        <h1>
          See what evidence-led
          <br />
          <em>feedback looks like.</em>
        </h1>
        <p>Explore the label, cited moments, next steps and limitations across all four rubric levels and missing-evidence handling.</p>
      </header>
      <aside className="notice demo-notice" aria-labelledby="demo-title">
        <h2 id="demo-title">Synthetic demo · no live analysis</h2>
        <p>
          This prerecorded example report is an authored fixture, not the analysis of a real recording. Every excerpt, timestamp and score is invented for demonstration. No real names or media are included.
        </p>
        <p>
          This page does not accept or analyze uploads, call a provider, or load private assessments. The example is not a claim about model accuracy.
        </p>
        <Link href="/#assess">Use your personal key to assess a permitted recording</Link>
      </aside>
      <div id="demo-report">
        <DemoShowcase initialKey="good" />
      </div>
      <footer className="workspace-footer">
        <span>Humaniti AI · Evidence before judgment</span>
        <Link href="/">Back to Humaniti AI</Link>
      </footer>
    </main>
  );
}
