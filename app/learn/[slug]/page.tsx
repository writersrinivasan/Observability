import Link from "next/link";
import { notFound } from "next/navigation";
import FlowDiagram from "@/components/FlowDiagram";
import Markdown from "@/components/Markdown";
import Quiz from "@/components/learn/Quiz";
import { FAULTS } from "@/lib/agents/meta";
import { MODULES, moduleBySlug } from "@/lib/curriculum";

export function generateStaticParams() {
  return MODULES.map((m) => ({ slug: m.slug }));
}

const LAYER_TAB: Record<string, string> = { graph: "inspector" };

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = moduleBySlug(slug);
  if (!m) notFound();
  const idx = MODULES.indexOf(m);
  const prev = MODULES[idx - 1];
  const next = MODULES[idx + 1];
  const fault = m.lab ? FAULTS.find((f) => f.id === m.lab!.fault) : undefined;
  const labHref = m.lab ? `/lab?fault=${m.lab.fault}&layer=${LAYER_TAB[m.lab.layer] ?? m.lab.layer}&mode=compare` : "/lab";

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-6">
      <Link href="/learn" className="text-sm text-white/60 hover:text-white">← All modules</Link>

      {/* Header */}
      <header className={`mt-3 overflow-hidden rounded-3xl bg-gradient-to-br ${m.gradient} p-6 md:p-8`}>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/85">
          <span>Day {m.day}</span>·<span>Module {m.order}</span>·<span>{m.minutes} minutes</span>
        </div>
        <div className="mt-2 flex items-center gap-4">
          <span className="text-5xl md:text-6xl">{m.emoji}</span>
          <div>
            <h1 className="text-3xl font-black text-white md:text-4xl">{m.title}</h1>
            <p className="text-lg text-white/85">{m.subtitle}</p>
          </div>
        </div>
        {/* agenda bar */}
        <div className="mt-5 flex overflow-hidden rounded-2xl bg-black/25 text-[11px] text-white">
          {m.agenda.map((a, i) => (
            <div key={i} className="border-r border-black/20 px-2 py-2 last:border-0" style={{ width: `${(a.min / m.minutes) * 100}%`, background: `rgba(255,255,255,${0.06 + (i % 2) * 0.08})` }} title={a.activity}>
              <div className="font-mono font-bold">{a.min}m</div>
              <div className="line-clamp-2 opacity-85">{a.activity}</div>
            </div>
          ))}
        </div>
      </header>

      {/* Objectives */}
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-fuchsia-300">🎯 Learning objectives</h2>
        <ul className="mt-2 grid gap-2 md:grid-cols-3">
          {m.objectives.map((o) => (
            <li key={o} className="rounded-2xl bg-black/20 p-3 text-sm text-white/85">{o}</li>
          ))}
        </ul>
      </section>

      {/* Visual */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-sky-300">🌈 Visual workflow</h2>
        <FlowDiagram spec={m.flow} height={380} />
      </section>

      {/* Theory */}
      <section className="mt-6 space-y-4">
        {m.sections.map((s) => (
          <article key={s.heading} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h3 className="text-xl font-black text-white">{s.heading}</h3>
            <Markdown text={s.body} className="mt-2 text-white/80" />
            {s.bullets && <Markdown text={s.bullets.map((b) => `- ${b}`).join("\n")} className="mt-3 text-white/80" />}
          </article>
        ))}
      </section>

      {/* Concepts */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-amber-300">🧩 Key concepts</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {m.concepts.map((c, i) => (
            <div key={c.term} className="flex gap-3 rounded-2xl border border-white/10 p-4" style={{ background: `linear-gradient(135deg, ${["#a855f7", "#0ea5e9", "#f97316", "#22c55e"][i % 4]}26, transparent)` }}>
              <span className="text-3xl">{c.emoji}</span>
              <div>
                <div className="font-bold text-white">{c.term}</div>
                <div className="text-sm text-white/70">{c.def}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Code */}
      {m.code && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-emerald-300">💻 {m.code.title}</h2>
          <pre className="overflow-x-auto rounded-3xl border border-white/10 bg-black/60 p-5 font-mono text-[12.5px] leading-relaxed text-emerald-100">{m.code.code}</pre>
        </section>
      )}

      {/* Lab */}
      {m.lab && (
        <section className="mt-6 rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 to-sky-500/10 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-black text-white">🧪 Try it in the Lab</h2>
            {fault && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">{fault.emoji} {fault.label}</span>}
            <Link href={labHref} className="ml-auto rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-5 py-2 text-sm font-black text-white transition hover:scale-105">Open this scenario →</Link>
          </div>
          <ol className="mt-3 space-y-2">
            {m.lab.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-white/85">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-400 text-xs font-black text-slate-900">{i + 1}</span>
                <Markdown text={s} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Quiz */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-rose-300">🧠 Check your understanding</h2>
        <Quiz quiz={m.quiz} />
      </section>

      {/* Facilitator */}
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/60">🎤 Facilitator run-sheet ({m.minutes} min)</h2>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {m.agenda.map((a, i) => (
              <tr key={i} className="border-b border-white/5 last:border-0">
                <td className="w-16 py-1.5 font-mono text-white/60">{a.min}m</td>
                <td className="py-1.5 text-white/85">{a.activity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <nav className="mt-8 flex gap-3">
        {prev && <Link href={`/learn/${prev.slug}`} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/80 hover:bg-white/5">← {prev.emoji} {prev.title}</Link>}
        {next && <Link href={`/learn/${next.slug}`} className="ml-auto rounded-2xl border border-white/10 px-4 py-3 text-right text-sm text-white/80 hover:bg-white/5">{next.emoji} {next.title} →</Link>}
      </nav>
    </div>
  );
}
