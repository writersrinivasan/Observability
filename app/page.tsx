import Link from "next/link";
import FlowDiagram from "@/components/FlowDiagram";
import { AGENTS, AGENT_ORDER } from "@/lib/agents/meta";
import { DAYS, moduleBySlug } from "@/lib/curriculum";

export default function Home() {
  const crew = moduleBySlug("agent-anatomy")!.flow;
  return (
    <div className="mx-auto max-w-[1300px] px-4 pb-24">
      {/* Hero */}
      <section className="pt-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/80">
          🎓 2-day workshop · 5 hours · theory + live LangGraph lab
        </div>
        <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-black leading-[1.05] text-white md:text-6xl">
          <span className="animate-shimmer bg-gradient-to-r from-fuchsia-400 via-sky-300 to-amber-300 bg-[length:200%_auto] bg-clip-text text-transparent">AI Observability</span>
          <br />& Workflow Management
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-white/70">
          See inside your agents. Watch a colorful crew of LangGraph agents plan a trip in real time — then break it, trace it, measure it, evaluate it and fix it.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/learn" className="rounded-full bg-white px-6 py-3 font-black text-slate-900 transition hover:scale-105">📚 Start learning</Link>
          <Link href="/lab" className="rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-sky-500 px-6 py-3 font-black text-white shadow-[0_0_30px_rgba(168,85,247,.5)] transition hover:scale-105">🧪 Open the live Lab</Link>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {AGENT_ORDER.map((id, i) => (
            <div key={id} className="animate-floaty rounded-2xl px-3 py-2 text-sm font-bold text-white" style={{ background: `${AGENTS[id].color}33`, border: `1px solid ${AGENTS[id].color}88`, animationDelay: `${i * 0.25}s` }}>
              {AGENTS[id].emoji} {AGENTS[id].name}
            </div>
          ))}
        </div>
      </section>

      {/* Dual platform */}
      <section className="mt-14 grid gap-5 md:grid-cols-3">
        {[
          { href: "/learn", emoji: "📚", title: "Learn", grad: "from-fuchsia-500/30 to-purple-600/10", text: "10 modules across 2 days × 2.5h. Each module has objectives, explanations, an animated concept flow, code, a quiz and a facilitator agenda." },
          { href: "/lab", emoji: "🧪", title: "Lab", grad: "from-sky-500/30 to-cyan-600/10", text: "A real LangGraph StateGraph with 8 agents. Inject 5 failure types and compare the black box with 9 live observability layers." },
          { href: "/assistant", emoji: "🦉", title: "AI Assistant", grad: "from-amber-500/30 to-rose-600/10", text: "Ask anything — powered by Groq. Every answer is drawn as an animated, step-by-step workflow diagram." },
        ].map((c) => (
          <Link key={c.href} href={c.href} className={`group rounded-3xl border border-white/10 bg-gradient-to-br ${c.grad} p-6 transition hover:-translate-y-1 hover:border-white/30`}>
            <div className="text-4xl">{c.emoji}</div>
            <div className="mt-2 text-2xl font-black text-white">{c.title} <span className="inline-block transition group-hover:translate-x-1">→</span></div>
            <p className="mt-2 text-sm text-white/70">{c.text}</p>
          </Link>
        ))}
      </section>

      {/* Crew */}
      <section className="mt-14">
        <h2 className="text-2xl font-black text-white">🧳 Meet the Travel Crew</h2>
        <p className="mb-4 mt-1 text-white/60">The multi-agent workflow you&apos;ll observe all course long. Press “Walk through” to follow a request.</p>
        <FlowDiagram spec={crew} height={420} />
      </section>

      {/* Days */}
      <section className="mt-14 grid gap-5 md:grid-cols-2">
        {DAYS.map((d) => (
          <div key={d.day} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
            <div className={`bg-gradient-to-r ${d.gradient} px-5 py-4`}>
              <div className="text-xs font-bold uppercase tracking-widest text-white/80">2.5 hours</div>
              <div className="text-xl font-black text-white">{d.title}</div>
              <div className="text-sm text-white/85">{d.theme}</div>
            </div>
            <ul className="divide-y divide-white/5">
              {d.schedule.map((s, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="w-12 font-mono text-xs text-white/50">{s.minutes}m</span>
                  {s.slug ? <Link href={`/learn/${s.slug}`} className="text-white/90 hover:text-white hover:underline">{s.label}</Link> : <span className="text-white/50">{s.label}</span>}
                  {s.kind === "lab" && <span className="ml-auto rounded-full bg-emerald-500/20 px-2 text-[10px] font-bold text-emerald-200">LAB</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
