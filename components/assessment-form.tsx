"use client";

import { useState, type FormEvent } from "react";

type ApiResponse = {
  id?: string;
  status?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

function isApiResponse(value: unknown): value is ApiResponse {
  return typeof value === "object" && value !== null;
}

export default function AssessmentForm() {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: { kind: "url", url } }),
      });
      const body: unknown = await response.json();

      if (!isApiResponse(body)) {
        setMessage("The assessment service returned an invalid response.");
        return;
      }

      if (!response.ok) {
        setMessage(body.error?.message ?? "The assessment request could not be created.");
        return;
      }

      setMessage(`Request ${body.id ?? "created"} is ${body.status ?? "queued"}. No report has been generated.`);
    } catch {
      setMessage("The assessment service could not be reached.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-200" htmlFor="source-url">
          Permitted recording URL
        </label>
        <input
          id="source-url"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/permitted-recording"
          required
          maxLength={2048}
          autoComplete="url"
        />
        <p className="text-sm leading-6 text-slate-400">
          HTTPS URLs only. The server rejects credentials, local/private hosts, fragments, and unsupported input.
        </p>
      </div>

      <button
        className="rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Creating job…" : "Create assessment job"}
      </button>

      <p className="min-h-6 text-sm leading-6 text-slate-300" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
