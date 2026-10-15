"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Play, Square } from "lucide-react";
import { FAULTS } from "@/lib/agents/meta";
import { MODULES } from "@/lib/curriculum";
import type { AgentId, FaultId } from "@/lib/types";
import { useSettings } from "@/components/settings";
import Markdown from "@/components/Markdown";
import AgentGraph from "./AgentGraph";
import BlackBox from "./BlackBox";
import { useRun, type RunView } from "./useRun";
import { AlertsPanel, EvalsPanel, InspectorPanel, LayerFlow, LogsPanel, MessagesPanel, MetricsPanel, StatePanel, TracesPanel, useNow, WorkflowPanel, type RunHistoryItem } from "./Layers";

type Tab = "inspector" | "traces" | "logs" | "metrics" | "state" | "evals" | "alerts" | "messages" | "workflow";
type Mode = "compare" | "glass" | "black";

const PRESETS = [
  { label: "🗼 Tokyo", text: "Plan a 4 day trip from Chennai to Tokyo in April for 2 people, budget $3000, love food and temples" },
  { label: "🥐 Paris", text: "Plan a 5 day trip from Mumbai to Paris in May for a couple with a budget of $4200, into art and museums" },
  { label: "🌴 Bali", text: "Plan a 6 day trip from Bangalore to Bali in July for 3 people, budget $2600, beaches, surfing and nature" },
  { label: "🏙️ Dubai", text: "Plan a 3 day trip from Delhi to Dubai in December for 2 people, budget $1800, shopping and culture" },
];

const TABS: { id: Tab; label: string; module: string; steps: { emoji: string; label: string; color: string }[]; caption: string }[] = [
  { id: "inspector", label: "🔍 Inspector", module: "agent-anatomy", steps: [{ emoji: "🤖", label: "Agent node", color: "#a855f7" }, { emoji: "📥", label: "reads state", color: "#0ea5e9" }, { emoji: "🧠", label: "LLM / 🔧 tools", color: "#f97316" }, { emoji: "📤", label: "writes update", color: "#22c55e" }], caption: "Every LangGraph node is a function (state) → partial update. Click an agent to see exactly what it read, called and wrote." },
  { id: "traces", label: "🧵 Traces", module: "distributed-tracing", steps: [{ emoji: "🤖", label: "agent / llm / tool call", color: "#a855f7" }, { emoji: "🟢", label: "span_start", color: "#0ea5e9" }, { emoji: "🔴", label: "span_end + tokens + cost", color: "#f97316" }, { emoji: "🌳", label: "parent→child tree", color: "#14b8a6" }, { emoji: "🌊", label: "waterfall", color: "#eab308" }], caption: "Each operation opens a span with a parent ID; closing it records duration, status, tokens and cost. The tree + timeline = a trace." },
  { id: "logs", label: "📜 Logs", module: "telemetry-pillars", steps: [{ emoji: "✍️", label: "span.log(level, msg)", color: "#a855f7" }, { emoji: "🏷️", label: "+ span_id, agent, ts", color: "#0ea5e9" }, { emoji: "📜", label: "structured log stream", color: "#22c55e" }, { emoji: "🔗", label: "jump to span", color: "#eab308" }], caption: "Logs explain *why*. Because each line carries its span ID, you can pivot from a log to the exact call that wrote it." },
  { id: "metrics", label: "📊 Metrics", module: "metrics-cost", steps: [{ emoji: "🧾", label: "span tokens & durations", color: "#a855f7" }, { emoji: "🏷️", label: "× price table", color: "#f97316" }, { emoji: "➕", label: "aggregate per agent/run", color: "#0ea5e9" }, { emoji: "📈", label: "p50 / p95 over runs", color: "#eab308" }], caption: "Metrics are numbers aggregated from spans: latency, calls, tokens and $ — per agent, per run and across runs." },
  { id: "state", label: "🧠 State & Time-travel", module: "state-workflow", steps: [{ emoji: "🤖", label: "node returns update", color: "#a855f7" }, { emoji: "🧮", label: "reducers merge", color: "#0ea5e9" }, { emoji: "💾", label: "checkpoint saved", color: "#22c55e" }, { emoji: "🍴", label: "replay / fork", color: "#ec4899" }], caption: "LangGraph checkpoints the full state after every super-step. Pick one, patch it, and fork — only downstream agents re-run." },
  { id: "evals", label: "✅ Evals", module: "evals-guardrails", steps: [{ emoji: "📝", label: "draft", color: "#22c55e" }, { emoji: "⚓", label: "groundedness", color: "#0ea5e9" }, { emoji: "🔒", label: "PII scan", color: "#a855f7" }, { emoji: "⚖️", label: "LLM judge", color: "#eab308" }, { emoji: "🛡️", label: "gate → pass / rewrite", color: "#ef4444" }], caption: "The Quality Judge runs deterministic and LLM-based evaluators; a failed hard check loops the draft back to the writer." },
  { id: "alerts", label: "🚨 Alerts", module: "alerts-tooling", steps: [{ emoji: "📡", label: "span / metric / eval", color: "#0ea5e9" }, { emoji: "📏", label: "rule threshold", color: "#eab308" }, { emoji: "🚨", label: "alert fires", color: "#ef4444" }, { emoji: "🧵", label: "deep-link to agent", color: "#a855f7" }], caption: "Rules watch every signal as it's emitted. When a threshold is crossed an alert fires with a link to the culprit." },
  { id: "messages", label: "💬 Agent Messages", module: "agent-anatomy", steps: [{ emoji: "🧭", label: "supervisor dispatch", color: "#a855f7" }, { emoji: "⚡", label: "parallel specialists", color: "#0ea5e9" }, { emoji: "🔗", label: "join at budget", color: "#eab308" }, { emoji: "🛡️", label: "judge → user", color: "#ef4444" }], caption: "How the agents talk: every hand-off is a message. Watch the packets fly along the graph edges in real time." },
  { id: "workflow", label: "🔁 Workflow Mgmt", module: "state-workflow", steps: [{ emoji: "💥", label: "failure / loop", color: "#ef4444" }, { emoji: "📏", label: "policy check", color: "#eab308" }, { emoji: "🔁", label: "retry · fallback · guard", color: "#ec4899" }, { emoji: "✅", label: "recover or stop safely", color: "#22c55e" }], caption: "Reliability policies wrap unreliable agents and tools. Each time a policy fires, it's an observable event." },
];

const tickFor = (v: RunView, t: Tab) =>
  ({
    inspector: v.counts.state ?? 0,
    traces: (v.counts.span_start ?? 0) + (v.counts.span_end ?? 0),
    logs: v.logs.length,
    metrics: v.counts.span_end ?? 0,
    state: v.states.length + v.checkpoints.length,
    evals: v.evals.length,
    alerts: v.alerts.length,
    messages: v.messages.length,
    workflow: v.workflow.length,
  })[t];

export default function LabApp() {
  const params = useSearchParams();
  const settings = useSettings();
  const [request, setRequest] = useState(PRESETS[0].text);
  const [fault, setFault] = useState<FaultId>((params.get("fault") as FaultId) || "none");
  const [mode, setMode] = useState<Mode>((params.get("mode") as Mode) || "compare");
  const [speed, setSpeed] = useState(1);
  const [tab, setTab] = useState<Tab>(() => {
    const l = params.get("layer");
    return TABS.some((t) => t.id === l) ? (l as Tab) : "traces";
  });
  const [selAgent, setSelAgent] = useState<AgentId | null>(null);
  const [selSpan, setSelSpan] = useState<string | null>(null);
  const [history, setHistory] = useState<RunHistoryItem[]>([]);

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("obs.history") ?? "[]"));
    } catch {}
  }, []);

  const onDone = useCallback((v: RunView) => {
    if (!v.totals || !v.runId) return;
    const item: RunHistoryItem = {
      id: v.runId,
      fault: (v.isFork ? "fork:" : "") + (v.fault ?? "none"),
      durationMs: v.totals.durationMs,
      costUsd: v.totals.costUsd,
      tokens: v.totals.tokens.prompt + v.totals.tokens.completion,
      llm: v.llm ?? "",
      errors: v.totals.errors,
      retries: v.totals.retries,
      alerts: v.alerts.length,
      evalPass: v.evals.filter((e) => e.name !== "budget_compliance").slice(-3).every((e) => e.pass),
    };
    setHistory((h) => {
      const next = [...h, item].slice(-24);
      try {
        localStorage.setItem("obs.history", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const { view, start, stop } = useRun(settings.headers, onDone);
  const now = useNow(view.status === "running");
  const running = view.status === "running";

  const run = () => {
    setSelSpan(null);
    start({ request, fault, speed });
  };
  const fork = (checkpointId: string, budget?: number) => {
    if (!view.threadId) return;
    setSelSpan(null);
    start({ request, fault: "none", speed, fork: { threadId: view.threadId, checkpointId, budget } });
  };
  const pickAgent = (a: AgentId) => {
    setSelAgent(a);
    setTab("inspector");
  };
  const pickSpan = (id: string) => {
    setSelSpan(id);
    setTab("traces");
  };

  const activeTab = TABS.find((t) => t.id === tab)!;
  const faultMeta = FAULTS.find((f) => f.id === fault)!;
  const mod = MODULES.find((m) => m.slug === activeTab.module);
  const elapsed = view.startTs ? (view.endTs ?? now) - view.startTs : 0;
  const graphH = mode === "compare" ? 440 : 500;

  const kpis = useMemo(() => {
    const spans = Object.values(view.spans);
    return [
      { k: "⏱ elapsed", v: `${(elapsed / 1000).toFixed(1)}s`, c: "#0ea5e9" },
      { k: "🤖 agent steps", v: spans.filter((s) => s.kind === "agent").length, c: "#a855f7" },
      { k: "🧠 LLM calls", v: spans.filter((s) => s.kind === "llm").length, c: "#8b5cf6" },
      { k: "🔧 tool calls", v: spans.filter((s) => s.kind === "tool").length, c: "#f97316" },
      { k: "🔤 tokens", v: spans.reduce((a, s) => a + (s.tokens ? s.tokens.prompt + s.tokens.completion : 0), 0).toLocaleString(), c: "#6366f1" },
      { k: "💵 cost", v: `$${spans.reduce((a, s) => a + (s.costUsd ?? 0), 0).toFixed(4)}`, c: "#eab308" },
      { k: "🔁 retries", v: view.workflow.filter((w) => w.action === "retry").length, c: "#ec4899" },
      { k: "🚨 alerts", v: view.alerts.length, c: "#ef4444" },
    ];
  }, [view.spans, view.workflow, view.alerts, elapsed]);

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-24 pt-6">
      {/* Header */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-300">Hands-on Lab · LangGraph</div>
          <h1 className="bg-gradient-to-r from-fuchsia-300 via-sky-300 to-amber-200 bg-clip-text text-3xl font-black text-transparent md:text-4xl">The Travel Crew Observatory</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/70">8 agents plan a real trip. Inject a fault, then watch the same run through a black box and a glass box — and explore every observability layer live.</p>
        </div>
        <div className="ml-auto rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
          {view.llm ? (
            <span>
              Engine: <b className={view.llm === "groq" ? "text-emerald-300" : "text-amber-300"}>{view.llm === "groq" ? `⚡ Groq · ${view.model}` : "🎭 Simulator"}</b>
            </span>
          ) : (
            <span className="text-white/60">{settings.groqKey ? "⚡ Groq key set in browser" : "Using server key or 🎭 simulator"}</span>
          )}
          <button onClick={() => settings.setOpen(true)} className="ml-2 text-sky-300 underline">
            settings
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-5 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 lg:grid-cols-[1.1fr_1.4fr]">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-white/60">1 · Traveler request</label>
          <textarea value={request} onChange={(e) => setRequest(e.target.value)} rows={3} className="mt-1.5 w-full resize-none rounded-2xl border border-white/15 bg-black/40 p-3 text-sm text-white outline-none focus:border-fuchsia-400" />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => setRequest(p.text)} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/85 hover:bg-white/20">
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-white/60">2 · Inject a fault</label>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5 md:grid-cols-3">
            {FAULTS.map((f) => (
              <button key={f.id} onClick={() => setFault(f.id)} className={`rounded-2xl border px-3 py-2 text-left transition ${fault === f.id ? "border-fuchsia-400 bg-fuchsia-500/20 shadow-[0_0_20px_rgba(217,70,239,.35)]" : "border-white/10 bg-black/20 hover:bg-white/10"}`}>
                <div className="text-sm font-bold text-white">
                  {f.emoji} {f.label}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-white/65">{faultMeta.desc}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <span className="text-xs font-bold uppercase tracking-wider text-white/60">3 · View</span>
          <div className="flex rounded-full bg-black/40 p-1">
            {(
              [
                ["compare", "⚖️ Compare"],
                ["black", "🕳️ Without"],
                ["glass", "🔭 With observability"],
              ] as [Mode, string][]
            ).map(([m, l]) => (
              <button key={m} onClick={() => setMode(m)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${mode === m ? "bg-gradient-to-r from-fuchsia-500 to-sky-500 text-white" : "text-white/60 hover:text-white"}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-full bg-black/40 p-1 text-xs">
            {(
              [
                [0.5, "🐇 Fast"],
                [1, "🚶 Normal"],
                [1.8, "🎤 Presenter"],
              ] as [number, string][]
            ).map(([s, l]) => (
              <button key={s} onClick={() => setSpeed(s)} className={`rounded-full px-3 py-1.5 font-semibold ${speed === s ? "bg-white text-slate-900" : "text-white/60"}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            {running && (
              <button onClick={stop} className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20">
                <Square size={14} /> Stop
              </button>
            )}
            <button onClick={run} disabled={running} className="flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-sky-500 px-6 py-2.5 text-sm font-black text-white shadow-[0_0_30px_rgba(168,85,247,.5)] transition hover:scale-105 disabled:opacity-60">
              <Play size={16} fill="white" /> {running ? "Running…" : "Run the crew"}
            </button>
          </div>
        </div>
      </div>

      {/* Graph area */}
      <div className={`mt-5 grid gap-4 ${mode === "compare" ? "lg:grid-cols-[minmax(300px,0.6fr)_1.8fr]" : ""}`}>
        {mode !== "glass" && <BlackBox view={view} height={graphH} />}
        {mode !== "black" && (
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-300">
              <span className={`h-2 w-2 rounded-full bg-emerald-400 ${running ? "animate-pulse" : ""}`} /> With observability {view.isFork && <span className="rounded bg-fuchsia-500/30 px-2 text-fuchsia-100">forked run</span>}
              <span className="ml-auto normal-case tracking-normal text-white/50">click an agent to inspect it</span>
            </div>
            <AgentGraph view={view} selected={selAgent} onSelect={pickAgent} height={graphH - 22} />
          </div>
        )}
      </div>

      {mode !== "black" && (
        <>
          {/* KPI strip */}
          <div className="mt-4 grid grid-cols-4 gap-2 md:grid-cols-8">
            {kpis.map((k) => (
              <div key={k.k} className="rounded-2xl border border-white/10 px-3 py-2" style={{ background: `linear-gradient(135deg, ${k.c}30, transparent)` }}>
                <div className="text-[10px] font-semibold uppercase text-white/60">{k.k}</div>
                <div className="font-mono text-lg font-black text-white">{k.v}</div>
              </div>
            ))}
          </div>

          {/* Layers */}
          <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {TABS.map((t) => {
                const n = tickFor(view, t.id);
                return (
                  <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${tab === t.id ? "bg-white text-slate-900" : "bg-white/10 text-white/80 hover:bg-white/20"}`}>
                    {t.label}
                    {n > 0 && <span className={`ml-1.5 rounded-full px-1.5 ${tab === t.id ? "bg-slate-900 text-white" : "bg-white/20"}`}>{n}</span>}
                  </button>
                );
              })}
            </div>
            <LayerFlow steps={activeTab.steps} tick={tickFor(view, tab)} caption={activeTab.caption} />
            {tab === "inspector" && <InspectorPanel view={view} agent={selAgent} onSpan={pickSpan} />}
            {tab === "traces" && <TracesPanel view={view} selectedSpan={selSpan} onSelectSpan={setSelSpan} />}
            {tab === "logs" && <LogsPanel view={view} onSpan={pickSpan} />}
            {tab === "metrics" && <MetricsPanel view={view} history={history} />}
            {tab === "state" && <StatePanel view={view} onFork={fork} />}
            {tab === "evals" && <EvalsPanel view={view} />}
            {tab === "alerts" && <AlertsPanel view={view} onNode={pickAgent} />}
            {tab === "messages" && <MessagesPanel view={view} />}
            {tab === "workflow" && <WorkflowPanel view={view} />}
            {mod && (
              <Link href={`/learn/${mod.slug}`} className="mt-4 inline-flex items-center gap-1.5 text-xs text-sky-300 hover:underline">
                📚 Theory for this layer: Day {mod.day} · {mod.title} →
              </Link>
            )}
          </div>
        </>
      )}

      {/* Output */}
      {(view.output || view.error) && mode !== "black" && (
        <div className="mt-5 rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 to-sky-500/10 p-5">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-300">🎉 Final itinerary (delivered to traveler)</div>
          {view.error ? <p className="text-red-300">{view.error}</p> : <Markdown text={view.output!} className="text-sm text-white/85" />}
        </div>
      )}
    </div>
  );
}
