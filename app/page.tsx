import AssessmentForm from "@/components/assessment-form";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Humaniti AI</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Evidence-first class assessment</h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-300">
            Submit a permitted recording link to create a durable assessment job. This foundation does not
            invent a grade or call an unapproved AI service.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-cyan-950/20 sm:p-8">
          <AssessmentForm />
        </section>

        <p className="text-sm leading-6 text-slate-400">
          Results require a configured database and an organiser-approved processing path. Missing processing
          capability is reported as unavailable rather than replaced with a mock result.
        </p>
      </div>
    </main>
  );
}
