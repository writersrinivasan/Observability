"use client";

import Markdown from "@/components/Markdown";
import { useNow } from "./Layers";
import type { RunView } from "./useRun";

/** What an un-instrumented app gives you: a request, a wait, and an answer. Nothing else. */
export default function BlackBox({ view, height = 460 }: { view: RunView; height?: number }) {
  const now = useNow(view.status === "running");
  const elapsed = view.startTs ? ((view.endTs ?? now) - view.startTs) / 1000 : 0;
  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-zinc-950 to-black p-5" style={{ height }}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
        <span className="h-2 w-2 rounded-full bg-slate-500" /> Without observability
      </div>
      <div className="mt-3 flex items-center gap-3 font-mono text-sm text-slate-300">
        <span className="rounded bg-slate-800 px-2 py-0.5 text-emerald-300">POST</span> /api/plan-trip
      </div>
      <div className="relative mt-4 grid flex-1 place-items-center overflow-hidden rounded-2xl border border-slate-800 bg-black/60">
        {view.status === "idle" && <div className="text-center text-slate-500"><div className="text-6xl">🕳️</div><div className="mt-2 text-sm">A black box. Press Run.</div></div>}
        {view.status === "running" && (
          <div className="text-center">
            <div className="text-6xl animate-pulse">🕳️</div>
            <div className="mt-3 font-mono text-3xl font-black text-slate-200">{elapsed.toFixed(1)}s</div>
            <div className="mt-1 text-sm text-slate-500">waiting for response…</div>
            <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded bg-slate-800">
              <div className="h-1 w-1/3 animate-[shimmer_1.2s_linear_infinite] rounded bg-slate-500" style={{ animation: "indeterminate 1.3s ease-in-out infinite" }} />
            </div>
          </div>
        )}
        {(view.status === "done" || view.status === "error") && (
          <div className="h-full w-full overflow-auto p-4">
            <div className={`mb-3 inline-block rounded px-2 py-0.5 font-mono text-xs ${view.status === "done" ? "bg-emerald-900 text-emerald-300" : "bg-red-900 text-red-300"}`}>
              {view.status === "done" ? "200 OK" : "500 Internal Server Error"} · {elapsed.toFixed(1)}s
            </div>
            {view.status === "error" ? <p className="font-mono text-sm text-red-300">Error: something went wrong.</p> : <Markdown text={view.output ?? ""} className="text-sm text-slate-300" />}
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] text-slate-500">
        {["Which agent is running?", "Why is it slow?", "How much did it cost?", "Did anything retry or fail?", "Was the answer revised?", "Is the answer grounded?"].map((q) => (
          <div key={q} className="rounded-lg bg-slate-900 px-2 py-1">❓ {q}</div>
        ))}
      </div>
    </div>
  );
}
