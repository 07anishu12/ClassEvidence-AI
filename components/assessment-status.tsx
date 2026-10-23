"use client";

import { useEffect, useRef, useState } from "react";
import { jobSchema, type Job } from "@/lib/contracts/job";
import { coachingReportSchema, type CoachingReport } from "@/lib/domain/report";
import { assessmentRequest, AssessmentRequestError, isActive, okSchema, requestMessage, sessionRequestController, stageLabel, type PrivateSession } from "./assessment-client";
import AssessmentReport from "./assessment-report";

export default function AssessmentStatus({ id, session, onTerminal, onRetry }: {
  id: string; session: PrivateSession; onTerminal: () => void; onRetry: () => void;
}) {
  const [status, setStatus] = useState<Job | null>(null);
  const [report, setReport] = useState<CoachingReport | null>(null);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const terminalNotified = useRef(false);
  const cancelPending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);

  useEffect(() => {
    const { controller, dispose } = sessionRequestController(session);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const poll = async () => {
      try {
        const next = await assessmentRequest(`/api/assessments/${id}`, session, jobSchema, {}, controller.signal);
        if (controller.signal.aborted) return;
        if (next.id !== id) throw new AssessmentRequestError("The service returned a different assessment. Refresh to try again.", 502);
        setStatus(next); setMessage("");
        if (next.hasReport) {
          const value = await assessmentRequest(`/api/assessments/${id}/report`, session, coachingReportSchema, {}, controller.signal);
          if (controller.signal.aborted) return;
          setReport(value);
        } else setReport(null);
        failures = 0;
        if (isActive(next.status)) timer = setTimeout(() => void poll(), 2000);
        else if (!terminalNotified.current) { terminalNotified.current = true; onTerminal(); }
      } catch (error) {
        if (controller.signal.aborted) return;
        const retry = !(error instanceof AssessmentRequestError && [401, 403, 404].includes(error.status)) && ++failures < 3;
        setMessage(`${requestMessage(error)} ${retry ? "Retrying shortly…" : "Automatic checks paused. Use Refresh status to try again."}`);
        if (retry) timer = setTimeout(() => void poll(), 3000);
      }
    };
    void poll();
    return () => { dispose(); clearTimeout(timer); };
  }, [id, session, refresh, onTerminal]);

  async function cancel() {
    if (cancelPending.current) return;
    cancelPending.current = true; setCancelling(true); setMessage("");
    try {
      await assessmentRequest(`/api/assessments/${id}`, session, okSchema, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel" }),
      });
      if (!session.signal.aborted) { setNotice("Cancellation requested. Checking the latest status…"); setRefresh((n) => n + 1); }
    } catch (error) { if (!session.signal.aborted) setMessage(requestMessage(error)); }
    finally { if (!session.signal.aborted) { setCancelling(false); cancelPending.current = false; } }
  }

  const active = Boolean(status && isActive(status.status));
  const title = status?.stage === "cancelled" ? "Assessment cancelled" : status?.stage === "insufficient_evidence" ? "More evidence needed" :
    status?.status === "failed" ? "Assessment needs attention" : status?.status === "completed" ? "Assessment ready" :
      status?.status === "queued" ? "Recording queued" : status ? "Processing your recording" : "Retrieving assessment";

  const progressPercent = status?.stage === "queued" ? 25 : status?.stage === "media" ? 50 : status?.stage === "analysis" ? 75 : status?.status === "completed" ? 100 : undefined;

  return <>
    <section className="job-status" aria-labelledby="status-title">
      <div className="section-heading"><span className="step-number" aria-hidden="true">02</span><div><h2 id="status-title" ref={heading} tabIndex={-1}>{title}</h2>
        <p className="muted" role="status">{stageLabel(status?.stage ?? null)}</p></div></div>

      {active && (
        <div className="flex items-center gap-2 my-2 py-1.5 px-3 rounded-md bg-[#0c1c26] border border-[#2d424f] text-xs text-[#9ae0d0]" role="status" aria-live="polite">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#9ae0d0] animate-pulse" aria-hidden="true" />
          <span>Live processing active · polling every 2s</span>
        </div>
      )}

      {(active || status?.status === "completed") && (
        <div className="my-4">
          <div className="flex justify-between items-center text-xs text-[#b4c3cc] mb-1.5">
            <span>Stage: {stageLabel(status?.stage ?? null)}</span>
            <span className="font-mono">{progressPercent ? `${progressPercent}%` : "In progress"}</span>
          </div>
          <progress
            className="w-full h-2.5 rounded-full accent-[#9ae0d0] overflow-hidden"
            value={progressPercent}
            max={100}
            aria-label={`Assessment progress: ${stageLabel(status?.stage ?? null)}`}
          />
        </div>
      )}

      <p className="hint">Assessment ID</p><p className="assessment-id">{id}</p>
      <a className="assessment-link" href={`?assessment=${encodeURIComponent(id)}`}>Open this assessment link</a>
      <p className="hint">Bookmark this link to return. Your personal key is still required; it is never part of the link.</p>
      {status && <p>{status.error?.message ?? (active ? "Processing time depends on the recording and processor availability. Stages update automatically; no reliable percentage or finish time is available." : "Review the evidence and limitations below.")}</p>}

      {status?.status === "failed" && (
        <div className="my-3 p-4 bg-[#231215] border-l-4 border-red-500 rounded-r-lg" role="alert">
          <h3 className="text-sm font-bold text-red-300 m-0">Processing Interrupted</h3>
          <p className="text-xs text-[#f1f4ee] my-1">
            {status.error?.message ?? "An error occurred during video analysis. The worker safely released resources and cleaned up private scratch space."}
          </p>
          {status.error?.code && <p className="text-xs font-mono text-[#b4c3cc] m-0">Error code: {status.error.code}</p>}
        </div>
      )}

      <p role="status" className="hint">{active ? notice : ""}</p>
      <p role="alert" className="form-message">{message}</p>
      <div className="status-actions">
        <button type="button" className="secondary" disabled={cancelling} onClick={() => { setMessage(""); setRefresh((n) => n + 1); }}>Refresh status</button>
        {active && <button type="button" className="secondary" disabled={cancelling} aria-busy={cancelling} onClick={() => void cancel()}>{cancelling ? "Requesting cancellation…" : "Cancel assessment"}</button>}
        {status?.status === "failed" && (
          <>
            <button type="button" className="secondary" onClick={() => { setMessage(""); setRefresh((n) => n + 1); }}>Retry status check</button>
            <button type="button" className="secondary" onClick={onRetry}>Choose another recording</button>
          </>
        )}
      </div>
    </section>
    {report && <AssessmentReport value={report} />}
  </>;
}
