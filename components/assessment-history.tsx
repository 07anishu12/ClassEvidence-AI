"use client";

import { useEffect, useRef, useState } from "react";
import { assessmentRequest, historySchema, isActive, okSchema, requestMessage, sessionRequestController, stageLabel, type HistoryItem, type PrivateSession } from "./assessment-client";

export default function AssessmentHistory({ session, selectedId, onSelect, onDeleted }: {
  session: PrivateSession; selectedId: string; onSelect: (id: string) => void; onDeleted: (id: string) => void;
}) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [request, setRequest] = useState<{ cursor: string | null; version: number }>({ cursor: null, version: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const deletePending = useRef(false);
  const keepButton = useRef<HTMLButtonElement>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const historyHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (confirmId) keepButton.current?.focus(); }, [confirmId]);

  useEffect(() => {
    const { controller, dispose } = sessionRequestController(session);
    const query = request.cursor ? `?cursor=${encodeURIComponent(request.cursor)}` : "";
    void assessmentRequest(`/api/assessments${query}`, session, historySchema, {}, controller.signal).then((page) => {
      if (controller.signal.aborted) return;
      setItems((previous) => request.cursor ? [...previous, ...page.assessments.filter((item) => !previous.some((old) => old.id === item.id))] : page.assessments);
      setNextCursor(page.nextCursor); setMessage("");
    }).catch((error: unknown) => { if (!controller.signal.aborted) setMessage(requestMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return dispose;
  }, [session, request]);

  function load(cursor: string | null) {
    setLoading(true); setMessage(""); setRequest((current) => ({ cursor, version: current.version + 1 }));
  }
  async function remove() {
    if (!confirmId || deletePending.current) return;
    const id = confirmId;
    deletePending.current = true; setDeleting(true); setDeleteMessage("");
    try {
      await assessmentRequest(`/api/assessments/${id}`, session, okSchema, { method: "DELETE" });
      if (session.signal.aborted) return;
      setItems((previous) => previous.filter((item) => item.id !== id)); setConfirmId(null);
      historyHeading.current?.focus();
      onDeleted(id);
    } catch (error) { if (!session.signal.aborted) setDeleteMessage(requestMessage(error)); }
    finally { if (!session.signal.aborted) { setDeleting(false); deletePending.current = false; } }
  }

  return <section className="assessment-history" aria-labelledby="history-title">
    <div className="history-heading"><div><h2 id="history-title" ref={historyHeading} tabIndex={-1}>Your assessments</h2><p className="hint">History for the unlocked key. Select an assessment to check its latest status.</p></div>
      <button ref={refreshButton} type="button" className="secondary" disabled={loading || deleting} onClick={() => { setConfirmId(null); setDeleteMessage(""); load(null); }}>Refresh history</button>
    </div>
    <div aria-busy={loading}>
      {items.length > 0 && <ul className="history-list">{items.map((item) => <li key={item.id}>
        <div className="history-item"><button type="button" className="history-open" aria-pressed={selectedId === item.id} onClick={() => onSelect(item.id)}>
          <span className="history-label">{item.qualityLabel ?? (item.status === "completed" ? "Completed · open report" : item.status === "failed" ? "Needs attention" : item.status === "queued" ? "Queued" : "Processing")}</span>
          <span className="assessment-id">{item.id}</span><span className="hint"><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time> · {stageLabel(item.stage)}</span>
        </button>
          {!isActive(item.status) ? <button type="button" className="secondary" disabled={deleting} aria-label={`Delete assessment ${item.id}`} onClick={() => { setConfirmId(item.id); setDeleteMessage(""); }}>Delete</button> : <span className="hint">Active · cancel before deleting</span>}
        </div>
        {confirmId === item.id && <div className="delete-confirmation" role="group" aria-label={`Delete assessment ${item.id}?`}>
          <p>Permanently delete this assessment and its report? This cannot be undone.</p>
          <div className="status-actions"><button ref={keepButton} type="button" className="secondary" disabled={deleting} onClick={() => { setConfirmId(null); setDeleteMessage(""); refreshButton.current?.focus(); }}>Keep assessment</button>
            <button type="button" className="secondary danger" disabled={deleting} onClick={() => void remove()}>{deleting ? "Deleting…" : "Delete permanently"}</button></div>
          <p role="alert" className="form-message">{deleteMessage}</p>
        </div>}
      </li>)}</ul>}
      {!loading && !message && items.length === 0 && <p className="empty-history">No assessments yet. Start with a permitted recording below.</p>}
    </div>
    <p role="status" className="hint">{loading ? "Loading assessment history…" : `${items.length} assessment${items.length === 1 ? "" : "s"} shown.`}</p>
    <p role="alert" className="form-message">{message}</p>
    {message && <button type="button" className="secondary" disabled={loading} onClick={() => load(request.cursor)}>Retry history</button>}
    {nextCursor && <button type="button" className="secondary" disabled={loading || deleting} onClick={() => load(nextCursor)}>Load more assessments</button>}
  </section>;
}
