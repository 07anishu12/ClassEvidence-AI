import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AssessmentForm from "../../components/assessment-form";
import AssessmentReport, { formatTime } from "../../components/assessment-report";
import { buildCoachingReport } from "../../lib/domain/report";
import { scoreEvidence } from "../../lib/domain/scoring";
import { syntheticManifest, syntheticOutput } from "../fixtures/analysis";
import RecordingIntake from "../../components/recording-intake";
import DemoPage from "../../app/demo/page";
import HomePage from "../../app/page";
import { coachingReportSchema } from "../../lib/domain/report";
import { demoReport } from "../../lib/demo";

vi.mock("@/lib/config/env", () => ({ env: { MAX_UPLOAD_BYTES: 1024, ASSESSMENT_PROVIDER: "blocked", ASSESSMENT_ACCESS_TOKEN: "synthetic-server-key-must-not-render" } }));
afterEach(() => vi.unstubAllEnvs());

describe("accessible assessment views", () => {
  it("renders only the locked workspace, even for a valid deep link", () => {
    const html = renderToStaticMarkup(<AssessmentForm initialId="synthetic_existing" />);
    expect(html).toContain('type="password"');
    expect(html).toContain("Unlock workspace");
    expect(html).toContain("Unlock to open the linked assessment.");
    expect(html).not.toContain('for="recording"');
    expect(html).not.toContain("Your assessments");
    expect(html).not.toContain("Good");
    expect(html).not.toContain("localStorage");
  });
  it("renders labelled intake and accurate configured limits after unlock", () => {
    const html = renderToStaticMarkup(<RecordingIntake maxBytes={1024} urlEnabled={false} driveEnabled={false}
      session={{ token: "synthetic-unit-test-key", signal: new AbortController().signal, onUnauthorized: () => {} }} onAccepted={() => {}} />);
    expect(html).toContain('for="recording"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("1.0 KiB");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Recording URL");
    expect(html).toContain("Google Drive");
    expect(html).not.toContain("synthetic-unit-test-key");
  });
  it("explains all four labels and limitations on the public landing", async () => {
    vi.stubEnv("URL_IMPORT_ENABLED", "false"); vi.stubEnv("DRIVE_IMPORT_ENABLED", "false");
    const html = renderToStaticMarkup(await HomePage({ searchParams: Promise.resolve({}) }));
    for (const label of ["Poor", "Average", "Good", "Excellent"]) expect(html).toContain(label);
    expect(html).toContain("uncalibrated"); expect(html).toContain("human reviewer");
    expect(html).toContain('href="/demo"');
    expect(html).not.toContain("synthetic-server-key-must-not-render");
  });
  it("renders a standalone explicitly synthetic demo with valid citations", () => {
    expect(coachingReportSchema.safeParse(demoReport).success).toBe(true);
    const html = renderToStaticMarkup(<DemoPage />);
    expect(html).toContain("Synthetic demo · no live analysis");
    expect(html).toContain("not the analysis of a real recording");
    expect(html).toContain("Illustrative evidence");
    expect(html).toContain('href="#evidence_demo_clarity"');
    expect(html).not.toContain('type="file"'); expect(html).not.toContain('type="password"');
  });
  it("renders actual report citations, dimensions and limitations", () => {
    const value = buildCoachingReport(scoreEvidence(syntheticManifest, syntheticOutput));
    const html = renderToStaticMarkup(<AssessmentReport value={value} />);
    expect(html).toContain('id="evidence_0"');
    expect(html).toContain('href="#evidence_0"');
    expect(html).toContain("Not assessable");
    expect(html).toContain("Uncertainty &amp; technical limitations");
    expect(html).toContain("00:00–00:05");
  });
  it("keeps insufficient evidence free of a fabricated quality label", () => {
    const value = buildCoachingReport(scoreEvidence(syntheticManifest, { ...syntheticOutput, observations: [], ratings: [] }));
    const html = renderToStaticMarkup(<AssessmentReport value={value} />);
    expect(html).toContain("More evidence needed");
    expect(html).not.toContain("Excellent");
  });
  it("formats source seconds consistently beyond an hour", () => {
    expect(formatTime(5)).toBe("00:05"); expect(formatTime(3661.5)).toBe("1:01:01");
  });
});
