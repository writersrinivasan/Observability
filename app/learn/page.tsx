import Link from "next/link";
import { DAYS, moduleBySlug } from "@/lib/curriculum";

const clock = (start: number, min: number) => {
  const f = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  return `${f(start)}–${f(start + min)}`;
};

export default function LearnIndex() {
  return (
    <div className="mx-auto max-w-[1300px] px-4 pb-24 pt-8">
      <div className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-300">Learning resources</div>
      <h1 className="bg-gradient-to-r from-fuchsia-300 via-sky-300 to-amber-200 bg-clip-text text-4xl font-black text-transparent">5-hour course · 2 days × 2.5 hours</h1>
      <p className="mt-2 max-w-3xl text-white/70">
        Every module pairs theory with a live visual flow and a Lab exercise that runs on the same LangGraph crew. Times below are session-relative (0:00 = session start).
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {DAYS.map((d) => {
          let t = 0;
          return (
            <section key={d.day}>
              <div className={`rounded-3xl bg-gradient-to-r ${d.gradient} p-5`}>
                <div className="text-sm font-bold uppercase tracking-widest text-white/80">Day {d.day} · 150 minutes</div>
                <h2 className="text-2xl font-black text-white">{d.title.split("·")[1]}</h2>
                <p className="text-white/85">{d.theme}</p>
                <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-black/30">
                  {d.schedule.map((s, i) => (
                    <div key={i} title={`${s.label} · ${s.minutes}m`} className={s.kind === "break" ? "bg-white/20" : s.kind === "lab" ? "bg-emerald-300" : "bg-white/80"} style={{ width: `${(s.minutes / 150) * 100}%`, borderRight: "2px solid rgba(0,0,0,.3)" }} />
                  ))}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {d.schedule.map((s, i) => {
                  const range = clock(t, s.minutes);
                  t += s.minutes;
                  if (!s.slug) return <div key={i} className="rounded-2xl border border-dashed border-white/15 px-4 py-3 text-sm text-white/50">☕ {range} · {s.label}</div>;
                  const m = moduleBySlug(s.slug)!;
                  return (
                    <Link key={i} href={`/learn/${m.slug}`} className="group flex gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 transition hover:-translate-y-0.5 hover:border-white/30">
                      <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${m.gradient} text-3xl`}>{m.emoji}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-white/50">
                          <span className="font-mono">{range}</span> · Module {m.order} · {m.minutes} min
                          {s.kind === "lab" && <span className="rounded-full bg-emerald-500/20 px-2 text-emerald-200">LAB</span>}
                        </div>
                        <div className="text-lg font-black text-white group-hover:underline">{m.title}</div>
                        <div className="text-sm text-white/60">{m.subtitle}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {m.concepts.map((c) => (
                            <span key={c.term} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/75">{c.emoji} {c.term}</span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
