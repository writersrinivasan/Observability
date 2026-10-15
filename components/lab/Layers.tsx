"use client";

import { useEffect, useMemo, useState } from "react";
import { AGENTS, AGENT_ORDER } from "@/lib/agents/meta";
import type { AgentId, SpanKind } from "@/lib/types";
import type { RunView, SpanRec } from "./useRun";
import { ALERT_RULES } from "@/lib/agents/tracer";

export interface RunHistoryItem { id: string; fault: string; durationMs: number; costUsd: number; tokens: number; llm: string; errors: number; retries: number; alerts: number; evalPass: boolean }

// ─────────── helpers ───────────
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(t);
  }, [active]);
  return now;
}
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`);
const rel = (ts: number, start?: number) => `+${((ts - (start ?? ts)) / 1000).toFixed(2)}s`;
const colorOf = (n?: AgentId | string) => (n && n in AGENTS ? AGENTS[n as AgentId].color : "#94a3b8");
const emojiOf = (n?: string) => (n === "user" ? "🙋" : n && n in AGENTS ? AGENTS[n as AgentId].emoji : "🧵");
const KIND_ICON: Record<SpanKind, string> = { run: "🧵", agent: "🤖", llm: "🧠", tool: "🔧", guardrail: "🛡️" };

function Json({ value }: { value: unknown }) {
  if (value === undefined) return <span className="text-white/40">—</span>;
  const s = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-emerald-100">{s}</pre>;
}

function Empty({ text }: { text: string }) {
  return <div className="grid h-40 place-items-center rounded-2xl border border-dashed border-white/15 text-sm text-white/50">{text}</div>;
}

/** The mini "how this layer is produced" pipeline shown on top of every layer. */
export function LayerFlow({ steps, tick, caption }: { steps: { emoji: string; label: string; color: string }[]; tick: number; caption: string }) {
  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div key={`${tick}-${i}`} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ background: `${s.color}30`, border: `1px solid ${s.color}80`, animation: tick ? `stepflash 0.9s ease-out ${i * 0.12}s` : undefined }}>
              <span>{s.emoji}</span>
              {s.label}
            </div>
            {i < steps.length - 1 && <span className="flow-arrow text-white/40">➜</span>}
          </div>
        ))}
        <span className="ml-auto rounded-full bg-white/10 px-2.5 py-1 font-mono text-[11px] text-white/80">{tick} signals</span>
      </div>
      <p className="mt-2 text-xs text-white/60">{caption}</p>
    </div>
  );
}

// ─────────── 🧵 Traces ───────────
function spanTree(view: RunView) {
  const children: Record<string, string[]> = {};
  const roots: string[] = [];
  for (const id of view.spanOrder) {
    const p = view.spans[id].parentId;
    if (p && view.spans[p]) (children[p] ??= []).push(id);
    else roots.push(id);
  }
  const out: { span: SpanRec; depth: number }[] = [];
  const walk = (id: string, d: number) => {
    out.push({ span: view.spans[id], depth: d });
    (children[id] ?? []).forEach((c) => walk(c, d + 1));
  };
  roots.forEach((r) => walk(r, 0));
  return out;
}

export function SpanDetail({ span, view }: { span: SpanRec; view: RunView }) {
  const logs = view.logs.filter((l) => l.spanId === span.id);
  return (
    <div className="mt-3 grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 md:grid-cols-2">
      <div className="md:col-span-2 flex flex-wrap items-center gap-2">
        <span className="text-lg">{KIND_ICON[span.kind]}</span>
        <span className="font-mono text-sm font-bold text-white">{span.name}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${span.status === "error" ? "bg-red-500/30 text-red-200" : span.status === "ok" ? "bg-emerald-500/25 text-emerald-200" : "bg-sky-500/25 text-sky-200"}`}>{span.status}</span>
        {span.durationMs !== undefined && <span className="font-mono text-xs text-white/70">⏱ {fmtMs(span.durationMs)}</span>}
        {span.tokens && <span className="font-mono text-xs text-violet-200">🔤 {span.tokens.prompt} in / {span.tokens.completion} out</span>}
        {span.costUsd !== undefined && <span className="font-mono text-xs text-amber-200">💵 ${span.costUsd.toFixed(6)}</span>}
        <span className="ml-auto font-mono text-[10px] text-white/40">span_id {span.id}</span>
      </div>
      <div>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-sky-300">Input</div>
        <Json value={span.input} />
      </div>
      <div>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">{span.error ? "Error" : "Output"}</div>
        <Json value={span.error ?? span.output} />
      </div>
      {span.attrs && Object.keys(span.attrs).length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-fuchsia-300">Attributes</div>
          <Json value={span.attrs} />
        </div>
      )}
      {logs.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber-300">Correlated logs</div>
          <div className="space-y-1 rounded-xl bg-black/50 p-3 font-mono text-[11px]">
            {logs.map((l, i) => (
              <div key={i} className="text-white/80">
                <LevelBadge level={l.level} /> {l.msg}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TracesPanel({ view, selectedSpan, onSelectSpan }: { view: RunView; selectedSpan?: string | null; onSelectSpan: (id: string) => void }) {
  const now = useNow(view.status === "running");
  const rows = useMemo(() => spanTree(view), [view]);
  if (!rows.length) return <Empty text="Run the crew to see the trace waterfall build in real time." />;
  const t0 = view.startTs ?? rows[0].span.start;
  const tEnd = Math.max(view.endTs ?? now, ...rows.map((r) => r.span.end ?? now), t0 + 1);
  const total = tEnd - t0;
  const sel = selectedSpan ? view.spans[selectedSpan] : undefined;
  const slowest = rows.filter((r) => r.span.kind === "tool" || r.span.kind === "llm").sort((a, b) => (b.span.durationMs ?? 0) - (a.span.durationMs ?? 0))[0];
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-white/60">
        {(Object.keys(KIND_ICON) as SpanKind[]).map((k) => (
          <span key={k}>
            {KIND_ICON[k]} {k}
          </span>
        ))}
        {slowest?.span.durationMs && view.status !== "running" && (
          <span className="ml-auto rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-200">
            🛤️ slowest leaf: <b>{slowest.span.name}</b> ({fmtMs(slowest.span.durationMs)})
          </span>
        )}
      </div>
      <div className="max-h-[420px] overflow-auto rounded-2xl border border-white/10 bg-black/20">
        {rows.map(({ span, depth }) => {
          const end = span.end ?? now;
          const left = ((span.start - t0) / total) * 100;
          const width = Math.max(0.6, ((end - span.start) / total) * 100);
          const c = span.status === "error" ? "#ef4444" : colorOf(span.node);
          return (
            <button key={span.id} onClick={() => onSelectSpan(span.id)} className={`grid w-full grid-cols-[minmax(180px,38%)_1fr] items-center gap-2 border-b border-white/5 px-3 py-1.5 text-left hover:bg-white/5 ${selectedSpan === span.id ? "bg-white/10" : ""}`}>
              <div className="flex min-w-0 items-center gap-1.5 text-xs" style={{ paddingLeft: depth * 14 }}>
                <span>{KIND_ICON[span.kind]}</span>
                <span className="truncate font-mono text-white/90">{span.name}</span>
              </div>
              <div className="relative h-5">
                <div
                  title={`${span.name} · ${fmtMs(end - span.start)}${span.tokens ? ` · ${span.tokens.prompt + span.tokens.completion} tokens` : ""}`}
                  className={`absolute top-0.5 h-4 rounded ${span.status === "running" ? "animate-pulse" : ""}`}
                  style={{ left: `${left}%`, width: `${width}%`, background: span.kind === "agent" || span.kind === "run" ? `${c}55` : c, border: `1px solid ${c}` }}
                />
                <span className="absolute top-0.5 whitespace-nowrap pl-1 font-mono text-[10px] text-white/70" style={{ left: `${Math.min(left + width, 88)}%` }}>
                  {fmtMs(end - span.start)}
                  {span.costUsd ? ` · $${span.costUsd.toFixed(5)}` : ""}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {sel ? <SpanDetail span={sel} view={view} /> : <p className="mt-2 text-xs text-white/50">👆 Click any span to inspect its input, output, attributes and correlated logs.</p>}
    </div>
  );
}

// ─────────── 📜 Logs ───────────
function LevelBadge({ level }: { level: string }) {
  const c = { debug: "bg-slate-500/40 text-slate-200", info: "bg-sky-500/30 text-sky-200", warn: "bg-amber-500/30 text-amber-200", error: "bg-red-500/40 text-red-200" }[level] ?? "";
  return <span className={`inline-block w-12 rounded px-1 text-center text-[10px] font-bold uppercase ${c}`}>{level}</span>;
}

export function LogsPanel({ view, onSpan }: { view: RunView; onSpan: (id: string) => void }) {
  const [level, setLevel] = useState<string>("all");
  const logs = view.logs.filter((l) => level === "all" || l.level === level);
  return (
    <div>
      <div className="mb-2 flex gap-1.5">
        {["all", "debug", "info", "warn", "error"].map((l) => (
          <button key={l} onClick={() => setLevel(l)} className={`rounded-full px-3 py-1 text-xs font-semibold ${level === l ? "bg-white text-slate-900" : "bg-white/10 text-white/70 hover:bg-white/20"}`}>
            {l} {l !== "all" && <span className="opacity-60">{view.logs.filter((x) => x.level === l).length}</span>}
          </button>
        ))}
      </div>
      {!logs.length ? (
        <Empty text="Structured logs appear here, each linked to the span that wrote it." />
      ) : (
        <div className="max-h-[420px] space-y-0.5 overflow-auto rounded-2xl border border-white/10 bg-black/40 p-3 font-mono text-[12px]">
          {logs.map((l, i) => (
            <div key={i} className="flex items-start gap-2 rounded px-1 py-0.5 hover:bg-white/5">
              <span className="w-14 shrink-0 text-white/40">{rel(l.ts, view.startTs)}</span>
              <LevelBadge level={l.level} />
              <span className="shrink-0" style={{ color: colorOf(l.node) }}>
                {emojiOf(l.node)} {l.node ?? "run"}
              </span>
              <span className="flex-1 text-white/85">{l.msg}</span>
              {l.spanId && (
                <button onClick={() => onSpan(l.spanId!)} className="shrink-0 rounded bg-white/10 px-1.5 text-[10px] text-sky-200 hover:bg-sky-500/30">
                  span ↗
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────── 📊 Metrics ───────────
function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl border border-white/10 p-3" style={{ background: `linear-gradient(135deg, ${color}26, transparent)` }}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-black text-white">{value}</div>
      {sub && <div className="text-[11px] text-white/50">{sub}</div>}
    </div>
  );
}

function HBars({ title, rows, fmt }: { title: string; rows: { id: AgentId; v: number }[]; fmt: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r.v), 1e-9);
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 text-xs font-bold text-white/80">{title}</div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.id} className="group grid grid-cols-[110px_1fr_70px] items-center gap-2 text-[11px]" title={`${AGENTS[r.id].name}: ${fmt(r.v)}`}>
            <span className="truncate text-white/80">
              {AGENTS[r.id].emoji} {AGENTS[r.id].name}
            </span>
            <div className="h-2.5 rounded-r bg-white/5">
              <div className="h-2.5 rounded-r transition-all duration-500 group-hover:brightness-125" style={{ width: `${(r.v / max) * 100}%`, background: AGENTS[r.id].color }} />
            </div>
            <span className="text-right font-mono text-white/70">{fmt(r.v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function pct(vals: number[], p: number) {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

function HistoryChart({ title, history, pick, fmt, color }: { title: string; history: RunHistoryItem[]; pick: (h: RunHistoryItem) => number; fmt: (v: number) => string; color: string }) {
  const vals = history.map(pick);
  const max = Math.max(...vals, 1e-9);
  const p50 = pct(vals, 50);
  const p95 = pct(vals, 95);
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center text-xs font-bold text-white/80">
        {title}
        <span className="ml-auto font-mono text-[10px] font-normal text-white/60">
          p50 {fmt(p50)} · p95 {fmt(p95)}
        </span>
      </div>
      <div className="relative flex h-28 items-end gap-1 border-b border-white/15">
        <div className="absolute inset-x-0 border-t border-dashed border-white/40" style={{ bottom: `${(p95 / max) * 100}%` }}>
          <span className="absolute -top-3.5 right-0 text-[9px] text-white/60">p95</span>
        </div>
        {history.map((h, i) => (
          <div key={h.id} className="group relative flex-1" style={{ height: `${(vals[i] / max) * 100}%`, minWidth: 6, maxWidth: 34 }}>
            <div className="h-full rounded-t transition-all group-hover:brightness-125" style={{ background: h.errors || !h.evalPass ? "#f43f5e" : color }} />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] text-white shadow-xl group-hover:block">
              Run {i + 1} · {h.fault} · {fmt(vals[i])}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 text-[10px] text-white/50">Each bar = one run (red = errors or failed eval). Hover for details.</div>
    </div>
  );
}

export function MetricsPanel({ view, history }: { view: RunView; history: RunHistoryItem[] }) {
  const now = useNow(view.status === "running");
  const spans = Object.values(view.spans);
  const tokIn = spans.reduce((a, s) => a + (s.tokens?.prompt ?? 0), 0);
  const tokOut = spans.reduce((a, s) => a + (s.tokens?.completion ?? 0), 0);
  const cost = spans.reduce((a, s) => a + (s.costUsd ?? 0), 0);
  const elapsed = view.startTs ? (view.endTs ?? now) - view.startTs : 0;
  const llm = spans.filter((s) => s.kind === "llm").length;
  const tools = spans.filter((s) => s.kind === "tool");
  const toolErr = tools.filter((s) => s.status === "error").length;
  const used = AGENT_ORDER.filter((a) => view.nodeStats[a].visits > 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <Tile label="Latency" value={fmtMs(elapsed)} sub="end-to-end" color="#0ea5e9" />
        <Tile label="LLM calls" value={String(llm)} color="#a855f7" />
        <Tile label="Tool calls" value={String(tools.length)} sub={`${toolErr} errored`} color="#f97316" />
        <Tile label="Tokens in" value={tokIn.toLocaleString()} color="#8b5cf6" />
        <Tile label="Tokens out" value={tokOut.toLocaleString()} color="#6366f1" />
        <Tile label="Cost" value={`$${cost.toFixed(4)}`} sub="Groq list price" color="#eab308" />
        <Tile label="Retries" value={String(view.workflow.filter((w) => w.action === "retry").length)} color="#ec4899" />
        <Tile label="Alerts" value={String(view.alerts.length)} color="#ef4444" />
      </div>
      {used.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          <HBars title="⏱ Latency by agent (this run)" rows={used.map((id) => ({ id, v: view.nodeStats[id].ms }))} fmt={fmtMs} />
          <HBars title="💵 Cost by agent (this run)" rows={used.map((id) => ({ id, v: view.nodeStats[id].cost }))} fmt={(v) => `$${v.toFixed(5)}`} />
        </div>
      )}
      {history.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <HistoryChart title="Run latency history" history={history} pick={(h) => h.durationMs} fmt={fmtMs} color="#38bdf8" />
          <HistoryChart title="Run cost history" history={history} pick={(h) => h.costUsd} fmt={(v) => `$${v.toFixed(4)}`} color="#facc15" />
        </div>
      ) : (
        <p className="text-xs text-white/50">Complete a few runs to build latency and cost histograms (p50 / p95) across runs.</p>
      )}
    </div>
  );
}

// ─────────── 🧠 State & checkpoints ───────────
export function StatePanel({ view, onFork }: { view: RunView; onFork: (checkpointId: string, budget?: number) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const [budget, setBudget] = useState("");
  const cps = view.checkpoints;
  const idx = sel ?? cps.length - 1;
  const cp = cps[idx];
  const prev = cps[idx - 1];
  const changed = cp && prev ? Object.keys(cp.values).filter((k) => JSON.stringify(cp.values[k]) !== JSON.stringify(prev.values[k])) : [];
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 text-xs font-bold text-white/80">🔴 Live state updates (LangGraph streamMode: &quot;updates&quot;)</div>
        {!view.states.length ? (
          <Empty text="Each node's partial state update streams here as the graph runs." />
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {view.states.map((s, i) => (
              <div key={i} className="w-52 shrink-0 rounded-xl border p-2" style={{ borderColor: `${colorOf(s.node)}88`, background: `${colorOf(s.node)}18` }}>
                <div className="mb-1 text-xs font-bold text-white">
                  {emojiOf(s.node)} step {s.step} · {s.node}
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(s.update).map((k) => (
                    <span key={k} className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-emerald-200">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <div className="mb-1.5 text-xs font-bold text-white/80">💾 Checkpoint timeline (MemorySaver · thread {view.threadId?.slice(-8) ?? "—"})</div>
        {!cps.length ? (
          <Empty text="Checkpoints are listed after the run completes (graph.getStateHistory)." />
        ) : (
          <>
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {cps.map((c, i) => (
                <button key={c.checkpointId} onClick={() => setSel(i)} className={`flex shrink-0 flex-col items-center rounded-xl px-2 py-1.5 text-[10px] ${i === idx ? "bg-white text-slate-900" : "bg-white/10 text-white/80 hover:bg-white/20"}`}>
                  <span className="font-bold">step {c.step}</span>
                  <span className="opacity-70">{c.next.length ? `→ ${c.next.join(", ")}` : "✓ end"}</span>
                </button>
              ))}
            </div>
            {cp && (
              <div className="grid gap-3 md:grid-cols-[1fr_280px]">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <div className="mb-2 flex flex-wrap gap-1 text-[11px]">
                    <span className="text-white/60">changed since previous:</span>
                    {changed.length ? changed.map((k) => <span key={k} className="rounded bg-fuchsia-500/30 px-1.5 font-mono text-fuchsia-100">{k}</span>) : <span className="text-white/40">—</span>}
                  </div>
                  <Json value={cp.values} />
                </div>
                <div className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-3 text-sm">
                  <div className="font-bold text-white">🍴 Time travel</div>
                  <p className="mt-1 text-xs text-white/70">Resume this thread from step {cp.step}. Optionally patch the budget first — only downstream agents re-run.</p>
                  {cp.next.length ? (
                    <>
                      <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} placeholder={`new budget (now $${(cp.values.intent as { budget?: number })?.budget ?? "?"})`} className="mt-2 w-full rounded-lg border border-white/20 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-fuchsia-400" />
                      <button disabled={view.status === "running"} onClick={() => onFork(cp.checkpointId, budget ? Number(budget) : undefined)} className="mt-2 w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 py-1.5 text-xs font-bold text-white disabled:opacity-40">
                        {budget ? "Fork with patched budget" : "Replay from here"}
                      </button>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-amber-200">Final checkpoint — pick an earlier step to fork.</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────── ✅ Evals ───────────
export function EvalsPanel({ view }: { view: RunView }) {
  if (!view.evals.length) return <Empty text="The Quality Judge's evaluators report here: groundedness, PII, budget, LLM-as-judge." />;
  const drafts: (typeof view.evals)[] = [];
  view.evals.forEach((e) => {
    if (e.name === "groundedness") drafts.push([]);
    drafts[drafts.length - 1]?.push(e);
  });
  return (
    <div className="space-y-3">
      {drafts.map((d, i) => {
        const pass = d.filter((e) => e.name !== "budget_compliance").every((e) => e.pass);
        return (
          <div key={i} className={`rounded-2xl border p-3 ${pass ? "border-emerald-400/40 bg-emerald-500/10" : "border-rose-400/40 bg-rose-500/10"}`}>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
              📝 Draft v{i + 1}
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${pass ? "bg-emerald-500/40" : "bg-rose-500/40"}`}>{pass ? "✅ PASSED gate" : "❌ REJECTED → rewrite"}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {d.map((e) => (
                <div key={e.name} className="rounded-xl bg-black/30 p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-white">{e.name}</span>
                    <span>{e.pass ? "✅" : e.name === "budget_compliance" ? "⚠️" : "❌"}</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${e.score * 100}%`, background: e.pass ? "#22c55e" : e.name === "budget_compliance" ? "#f59e0b" : "#ef4444" }} />
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-white/60">score {e.score.toFixed(2)}</div>
                  <div className="mt-1 text-[11px] text-white/75">{e.reason}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────── 🚨 Alerts ───────────
const RULES = [
  { rule: "tool_latency_slo", desc: `Tool span > ${ALERT_RULES.toolLatencyMs / 1000}s`, sev: "warning" },
  { rule: "prompt_token_budget", desc: `Prompt > ${ALERT_RULES.promptTokens.toLocaleString()} tokens`, sev: "critical" },
  { rule: "run_cost_budget", desc: `Run cost > $${ALERT_RULES.runCostUsd}`, sev: "critical" },
  { rule: "loop_guard_tripped", desc: "Max-iteration guard fired", sev: "warning" },
  { rule: "quality_gate_failed", desc: "Judge failed after all rewrites", sev: "critical" },
  { rule: "run_failed", desc: "Unhandled run error", sev: "critical" },
];

export function AlertsPanel({ view, onNode }: { view: RunView; onNode: (a: AgentId) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-[300px_1fr]">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <div className="mb-2 text-xs font-bold text-white/80">📏 Alert rules</div>
        <div className="space-y-1.5">
          {RULES.map((r) => {
            const firing = view.alerts.some((a) => a.rule === r.rule);
            return (
              <div key={r.rule} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] ${firing ? "bg-red-500/25" : "bg-white/5"}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${firing ? "animate-pulse bg-red-400" : "bg-emerald-400"}`} />
                <div className="flex-1">
                  <div className="font-mono text-white">{r.rule}</div>
                  <div className="text-white/50">{r.desc}</div>
                </div>
                <span className="font-bold uppercase text-white/60">{firing ? "FIRING" : "ok"}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        {!view.alerts.length ? (
          <Empty text="No alerts. Try 🐢 Slow tool, 🎈 Token bloat or 🔁 Budget loop." />
        ) : (
          <div className="space-y-2">
            {view.alerts.map((a, i) => (
              <button key={i} onClick={() => a.node && onNode(a.node)} className={`block w-full rounded-2xl border p-3 text-left ${a.severity === "critical" ? "border-red-400/50 bg-red-500/15" : a.severity === "warning" ? "border-amber-400/50 bg-amber-500/15" : "border-sky-400/50 bg-sky-500/15"}`}>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-base">{a.severity === "critical" ? "🚨" : "⚠️"}</span>
                  <span className="font-bold uppercase text-white">{a.severity}</span>
                  <span className="font-mono text-white/70">{a.rule}</span>
                  <span className="ml-auto text-white/50">{rel(a.ts, view.startTs)}</span>
                </div>
                <div className="mt-1 text-sm text-white">{a.msg}</div>
                {a.node && <div className="mt-1 text-[11px] text-sky-200">→ jump to {emojiOf(a.node)} {AGENTS[a.node].name}</div>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────── 💬 Agent messages ───────────
export function MessagesPanel({ view }: { view: RunView }) {
  if (!view.messages.length) return <Empty text="Agent-to-agent hand-offs appear here as a conversation." />;
  return (
    <div className="max-h-[440px] space-y-2 overflow-auto pr-1">
      {view.messages.map((m, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-14 shrink-0 font-mono text-[10px] text-white/40">{rel(m.ts, view.startTs)}</span>
          <div className="flex shrink-0 items-center gap-1 text-lg">
            <span>{emojiOf(m.from)}</span>
            <span className="text-xs text-white/40">➜</span>
            <span>{emojiOf(m.to)}</span>
          </div>
          <div className="rounded-2xl rounded-tl-sm px-3 py-1.5 text-sm text-white" style={{ background: `linear-gradient(90deg, ${colorOf(m.from === "user" ? undefined : m.from)}55, ${colorOf(m.to === "user" ? undefined : m.to)}22)` }}>
            <span className="mr-1.5 text-[10px] font-bold uppercase text-white/60">
              {m.from} → {m.to}
            </span>
            {m.summary}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────── 🔁 Workflow management ───────────
export function WorkflowPanel({ view }: { view: RunView }) {
  const count = (a: string) => view.workflow.filter((w) => w.action === a).length;
  const policies = [
    { emoji: "🔁", name: "Retry + exponential backoff", cfg: "hotel_search: max 3 attempts · 300ms × 2ⁿ", n: count("retry"), color: "#f97316" },
    { emoji: "🪂", name: "Fallback", cfg: "Groq error → simulator response", n: count("fallback"), color: "#0ea5e9" },
    { emoji: "🔄", name: "Bounded loops", cfg: "budget↔dealhunter ≤ 3 · judge→writer ≤ 2", n: count("loop"), color: "#a855f7" },
    { emoji: "🚧", name: "Guards", cfg: "max-iteration guards · recursionLimit 40", n: count("guard"), color: "#ec4899" },
    { emoji: "💾", name: "Checkpointing", cfg: "MemorySaver per thread_id", n: view.checkpoints.length, color: "#22c55e" },
    { emoji: "⚡", name: "Parallel fan-out", cfg: "flights ∥ hotels ∥ weather → join", n: view.states.filter((s) => ["flights", "hotels", "weather"].includes(s.node)).length, color: "#14b8a6" },
  ];
  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
        {policies.map((p) => (
          <div key={p.name} className="rounded-2xl border p-3" style={{ borderColor: `${p.color}66`, background: `${p.color}18` }}>
            <div className="flex items-center gap-2">
              <span className="text-xl">{p.emoji}</span>
              <span className="text-sm font-bold text-white">{p.name}</span>
              <span className="ml-auto rounded-full px-2 py-0.5 font-mono text-xs font-bold text-white" style={{ background: p.n ? p.color : "#ffffff22" }}>
                {p.n}
              </span>
            </div>
            <div className="mt-1 font-mono text-[11px] text-white/60">{p.cfg}</div>
          </div>
        ))}
      </div>
      {view.workflow.length ? (
        <div className="space-y-1.5">
          {view.workflow.map((w, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm">
              <span className="font-mono text-[10px] text-white/40">{rel(w.ts, view.startTs)}</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase text-white">{w.action}</span>
              <span style={{ color: colorOf(w.node) }}>
                {emojiOf(w.node)} {w.node}
              </span>
              <span className="text-white/85">{w.detail}</span>
            </div>
          ))}
        </div>
      ) : (
        <Empty text="Policy events (retry, fallback, loop, guard) appear here. Try 💥 Flaky API or 🔁 Budget loop." />
      )}
    </div>
  );
}

// ─────────── 🔍 Inspector ───────────
export function InspectorPanel({ view, agent, onSpan }: { view: RunView; agent: AgentId | null; onSpan: (id: string) => void }) {
  if (!agent) return <Empty text="Click any agent in the graph to inspect what it received, what it produced and every call it made." />;
  const m = AGENTS[agent];
  const agentSpans = view.spanOrder.map((id) => view.spans[id]).filter((s) => s.node === agent && s.kind === "agent");
  const updates = view.states.filter((s) => s.node === agent);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: `linear-gradient(90deg, ${m.color}44, transparent)` }}>
        <span className="text-4xl">{m.emoji}</span>
        <div>
          <div className="text-lg font-black text-white">{m.name}</div>
          <div className="text-sm text-white/70">{m.role}</div>
        </div>
        <div className="ml-auto text-right font-mono text-xs text-white/70">
          visits {view.nodeStats[agent].visits} · {fmtMs(view.nodeStats[agent].ms)} · ${view.nodeStats[agent].cost.toFixed(5)}
        </div>
      </div>
      {!agentSpans.length && <Empty text="This agent hasn't run yet in this trace." />}
      {agentSpans.map((s, i) => {
        const kids = view.spanOrder.map((id) => view.spans[id]).filter((c) => c.parentId === s.id || (c.parentId && view.spans[c.parentId]?.parentId === s.id));
        return (
          <div key={s.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2 text-sm font-bold text-white">
              Visit #{i + 1} <span className="font-mono text-xs font-normal text-white/60">{s.durationMs ? fmtMs(s.durationMs) : "running…"}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase text-sky-300">Read from state</div>
                <Json value={s.input} />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase text-emerald-300">Wrote to state</div>
                <Json value={updates[i]?.update ?? s.output} />
              </div>
            </div>
            {kids.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {kids.map((k) => (
                  <button key={k.id} onClick={() => onSpan(k.id)} className={`rounded-full px-2.5 py-1 font-mono text-[11px] ${k.status === "error" ? "bg-red-500/30 text-red-100" : "bg-white/10 text-white/80 hover:bg-white/20"}`}>
                    {KIND_ICON[k.kind]} {k.name} {k.durationMs ? `· ${fmtMs(k.durationMs)}` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
