"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { assessmentIdSchema, type CreatedAssessment, type PrivateSession } from "./assessment-client";
import AssessmentHistory from "./assessment-history";
import AssessmentStatus from "./assessment-status";
import RecordingIntake from "./recording-intake";

export type AssessmentFormProps = { maxBytes?: number; initialId?: string; urlEnabled?: boolean; driveEnabled?: boolean };

function replaceAssessmentLink(id: string) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("assessment", id); else url.searchParams.delete("assessment");
  url.hash = "";
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
}

export default function AssessmentForm({ maxBytes = 524288000, initialId = "", urlEnabled = false, driveEnabled = false }: AssessmentFormProps) {
  const [draft, setDraft] = useState("");
  const [session, setSession] = useState<PrivateSession | null>(null);
  const [resumeId, setResumeId] = useState(assessmentIdSchema.safeParse(initialId).success ? initialId : "");
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  const tokenInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const lock = useCallback((reason = "Workspace locked. Private data has been cleared from this page.") => {
    controller.current?.abort();
    controller.current = null;
    setSession(null); setDraft(""); setResumeId(""); setMessage(reason);
    replaceAssessmentLink("");
    tokenInput.current?.focus();
  }, []);

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (session) return;
    const token = draft.trim();
    if (token.length < 32 || token.length > 256) { setMessage("Enter the personal access key provided by the app owner (32–256 characters)."); return; }
    controller.current?.abort();
    const next = new AbortController(); controller.current = next;
    setSession({ token, signal: next.signal, onUnauthorized: () => lock("Access key was not accepted. Unlock with a valid personal key.") });
    setMessage("");
  }

  return <div className="assessment-flow" id="assess">
    <form className="intake-form unlock-form" onSubmit={unlock} aria-labelledby="unlock-title">
      <h2 id="unlock-title">Your private workspace</h2>
      <p className="muted">No account sign-in. Use the personal access key supplied by the app owner to submit recordings and open your history.</p>
      <div className="field"><label htmlFor="access-token">Personal access key</label>
        <input ref={tokenInput} id="access-token" type="password" value={draft} onChange={(event) => {
          if (session) lock("Key changed. Unlock to load its workspace.");
          setDraft(event.target.value);
        }} autoComplete="off" autoCapitalize="none" spellCheck={false} required minLength={32} maxLength={256} aria-describedby="token-note" />
        <p id="token-note" className="hint">Kept in memory only, never in the URL or browser storage. Nothing loads until you choose Unlock. Refreshing requires your key again.</p>
      </div>
      <div className="status-actions">{session ? <button type="button" className="secondary" onClick={() => lock()}>Lock &amp; clear</button> :
        <button type="submit" className="primary">Unlock workspace</button>}
        <span className="hint">{session ? "Workspace unlocked for this key." : resumeId ? "Unlock to open the linked assessment." : "Have no key? Explore the synthetic demo above."}</span>
      </div>
      <p role="status" className="form-message">{message}</p>
    </form>
    {session && <PrivateWorkspace session={session} initialId={resumeId} maxBytes={maxBytes} urlEnabled={urlEnabled} driveEnabled={driveEnabled} />}
  </div>;
}

function PrivateWorkspace({ session, initialId = "", maxBytes = 524288000, urlEnabled = false, driveEnabled = false }: AssessmentFormProps & { session: PrivateSession }) {
  const [id, setId] = useState(initialId);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [notice, setNotice] = useState("");
  const selectedId = useRef(initialId);
  const refreshHistory = useCallback(() => setHistoryVersion((n) => n + 1), []);
  function select(nextId: string) { selectedId.current = nextId; setId(nextId); setNotice(""); replaceAssessmentLink(nextId); }
  function accepted(created: CreatedAssessment) {
    select(created.id);
    setNotice(created.reused ? "This recording already has an assessment. Opened the existing assessment." : "Recording accepted. Keep the assessment link to return later with your key.");
    refreshHistory();
  }
  return <>
    <AssessmentHistory key={historyVersion} session={session} selectedId={id} onSelect={select} onDeleted={(deletedId) => {
      if (selectedId.current === deletedId) select("");
      setNotice("Assessment deleted.");
    }} />
    <RecordingIntake session={session} maxBytes={maxBytes} urlEnabled={urlEnabled} driveEnabled={driveEnabled} onAccepted={accepted} />
    <p className="workspace-message" role="status">{notice}</p>
    {id && <AssessmentStatus key={id} id={id} session={session} onTerminal={refreshHistory} onRetry={() => {
      select(""); document.getElementById("recording")?.focus();
    }} />}
  </>;
}
