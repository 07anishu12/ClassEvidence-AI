"use client";

import { useRef, useState, type FormEvent } from "react";
import { assessmentRequest, createdAssessmentSchema, requestMessage, type CreatedAssessment, type PrivateSession } from "./assessment-client";

const videoTypes: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" };
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
}
export function fileProblem(file: Pick<File, "name" | "type" | "size">, maxBytes: number): string | null {
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!videoTypes[extension] || (file.type && file.type !== "application/octet-stream" && file.type !== videoTypes[extension])) return "Choose an MP4, MOV or WebM video file.";
  if (file.size === 0) return "This file is empty. Choose a recording with content.";
  if (file.size > maxBytes) return `This file exceeds the ${formatBytes(maxBytes)} upload limit.`;
  return null;
}
export function sourceProblem(value: string, mode: "url" | "drive", urlEnabled: boolean, driveEnabled: boolean): string | null {
  if (!(mode === "drive" ? driveEnabled : urlEnabled)) return "This source is not enabled on this deployment. Use file upload.";
  let url: URL;
  try { url = new URL(value); } catch { return "Enter a complete HTTPS recording link."; }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || value.length > 2048) return "Use an HTTPS link without embedded credentials or a fragment.";
  const drive = url.hostname === "drive.google.com";
  if (mode === "drive" && !drive) return "Use a Google Drive file link, not a folder or another website.";
  if (mode === "drive" && (url.pathname.includes("/folders/") || (!/^\/file\/d\/[^/]+/.test(url.pathname) && !url.searchParams.get("id")))) return "Use a Google Drive file link, not a folder link.";
  if (mode === "url" && drive) return driveEnabled ? "Select Google Drive for this file link." : "Google Drive import is not enabled. Download your permitted recording and upload it.";
  return null;
}

export default function RecordingIntake({ session, maxBytes, urlEnabled, driveEnabled, onAccepted }: {
  session: PrivateSession; maxBytes: number; urlEnabled: boolean; driveEnabled: boolean; onAccepted: (value: CreatedAssessment) => void;
}) {
  const [mode, setMode] = useState<"upload" | "url" | "drive">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const invalidFile = file ? fileProblem(file, maxBytes) : null;
  const enabled = mode === "upload" || (mode === "url" ? urlEnabled : driveEnabled);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || session.signal.aborted) return;
    const problem = !consent ? "Confirm that you have permission to process this recording." : mode === "upload" ?
      (file ? fileProblem(file, maxBytes) : "Choose a recording first.") : sourceProblem(url.trim(), mode, urlEnabled, driveEnabled);
    if (problem) { setMessage(problem); return; }
    submitting.current = true; setBusy(true); setMessage("");
    try {
      const contentType = mode === "upload" ? videoTypes[file!.name.split(".").at(-1)!.toLowerCase()] : "application/json";
      const idempotencyKey = mode === "upload"
        ? `file:${encodeURIComponent(file!.name)}:${file!.size}:${file!.lastModified}`
        : `url:${encodeURIComponent(url.trim())}`;
      const created = await assessmentRequest("/api/assessments", session, createdAssessmentSchema, {
        method: "POST",
        headers: {
          "content-type": contentType,
          "x-recording-consent": "true",
          "Idempotency-Key": idempotencyKey,
        },
        body: mode === "upload" ? file : JSON.stringify({ url: url.trim(), idempotencyKey }),
      });
      if (session.signal.aborted) return;
      setFile(null); setUrl(""); setConsent(false);
      if (fileInput.current) fileInput.current.value = "";
      onAccepted(created);
    } catch (error) {
      if (!session.signal.aborted) setMessage(`${requestMessage(error)} If acceptance was interrupted, check history before submitting again.`);
    } finally { if (!session.signal.aborted) { submitting.current = false; setBusy(false); } }
  }

  return <form className="intake-form" onSubmit={submit} aria-busy={busy} aria-labelledby="intake-title">
    <div className="section-heading"><span className="step-number" aria-hidden="true">01</span><div><h2 id="intake-title">Start with a recording</h2><p className="muted">Private processing. Evidence you can inspect.</p></div></div>
    <fieldset disabled={busy}><legend>Recording source</legend><div className="source-options">
      {([['upload', 'Upload a file'], ['url', 'Recording URL'], ['drive', 'Google Drive']] as const).map(([value, label]) => <label key={value}>
        <input type="radio" name="mode" checked={mode === value} onChange={() => { setMode(value); setMessage(""); setUrl(""); }} />{label}
      </label>)}
    </div></fieldset>
    {mode === "upload" ? <div className="upload-zone">
      <label htmlFor="recording">Choose your class recording</label>
      <input ref={fileInput} id="recording" type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" required disabled={busy}
        onChange={(event) => { setFile(event.target.files?.[0] ?? null); setMessage(""); }} aria-invalid={Boolean(invalidFile)} aria-describedby="file-note file-metadata file-error" />
      <p id="file-note" className="hint">MP4, WebM or MOV · up to {formatBytes(maxBytes)} (500 MB standard limit) · up to 2 hours. Content, codec and duration are checked by the server.</p>
      <p id="file-metadata" className="file-metadata">{file && <><strong>{file.name}</strong><span>{formatBytes(file.size)} · {file.type || "Type not supplied by browser"}</span></>}</p>
      <p id="file-error" className="form-message" role="alert">{invalidFile}</p>
    </div> : <div className={enabled ? "field" : "notice"}>
      <label htmlFor="recording-url">{mode === "drive" ? "Permitted Google Drive file link" : "Permitted recording URL"}</label>
      <input id="recording-url" type="url" value={url} onChange={(event) => { setUrl(event.target.value); setMessage(""); }} disabled={!enabled || busy} required maxLength={2048} aria-describedby="url-note" placeholder="https://media.example.test/class-recording.mp4" />
      <p id="url-note" className="hint">{!enabled ? `${mode === "drive" ? "Google Drive" : "Recording URL"} import is disabled on this deployment. Download your permitted recording, then upload the file.` :
        mode === "drive" ? "Use a permitted file link. The configured Drive connector must have access; a sharing link alone may not grant access." :
          "Use a direct HTTPS video link from a supported host (MP4/WebM, up to 500 MB). Web pages, sign-in pages and private network addresses are rejected by server security validation."}</p>
      {!enabled && <button type="button" className="secondary" onClick={() => setMode("upload")}>Use file upload</button>}
    </div>}
    <label htmlFor="recording-consent" className="consent">
      <input id="recording-consent" type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required disabled={busy || !enabled} aria-required="true" aria-describedby="consent-note" />
      <span>I have permission to process this recording and understand it may contain personal information.</span>
    </label>
    <p id="consent-note" className="hint">Privacy invariant: Only submit recordings you are authorized to share. Uploads are processed in private scratch space, never used for model training, and never published to public storage.</p>
    <button className="primary" type="submit" disabled={busy || !enabled || Boolean(invalidFile)}>{busy ? mode === "upload" ? "Sending recording…" : "Submitting link…" : "Assess recording"}<span aria-hidden="true"> ↗</span></button>
    {busy && <p role="status" className="hint">Waiting for the server to accept the recording. No completion estimate is available.</p>}
    <p className="form-message" role="alert">{message}</p>
  </form>;
}
