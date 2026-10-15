"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Sparkles } from "lucide-react";
import FlowDiagram from "@/components/FlowDiagram";
import Markdown from "@/components/Markdown";
import { useSettings } from "@/components/settings";
import { MODULES } from "@/lib/curriculum";
import type { FlowSpec } from "@/lib/types";

interface Turn {
  role: "user" | "assistant";
  content: string;
  flow?: FlowSpec | null;
  module?: string | null;
  followups?: string[];
  telemetry?: { model: string; latencyMs: number; promptTokens?: number; completionTokens?: number };
  offline?: boolean;
  error?: string;
}

const STARTERS = [
  "How does a trace differ from a log?",
  "Explain retries with exponential backoff in our travel crew",
  "How does LangGraph checkpointing enable time travel?",
  "What is LLM-as-judge and when should I use it?",
  "How do I calculate cost per agent run?",
  "Show me how agents communicate in a supervisor pattern",
];

export default function AssistantChat({ compact = false }: { compact?: boolean }) {
  const settings = useSettings();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: q.trim() }];
    setTurns(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: settings.headers(), body: JSON.stringify({ messages: next.map((t) => ({ role: t.role, content: t.content })) }) });
      const data = await res.json();
      setTurns([...next, { role: "assistant", content: data.answer, flow: data.flow, module: data.module, followups: data.followups, telemetry: data.telemetry, offline: data.offline, error: data.error }]);
    } catch (err) {
      setTurns([...next, { role: "assistant", content: `⚠️ ${(err as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {!turns.length && (
          <div className="py-4 text-center">
            <div className="mx-auto grid h-16 w-16 animate-floaty place-items-center rounded-3xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-sky-500 text-3xl shadow-[0_0_40px_rgba(168,85,247,.5)]">🦉</div>
            <h3 className="mt-3 text-lg font-black text-white">Ask Obi, your observability tutor</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-white/60">Every answer comes with a live, animated flow diagram so you can <i>see</i> the concept.</p>
            {!settings.groqKey && (
              <button onClick={() => settings.setOpen(true)} className="mt-2 text-xs text-amber-300 underline">
                Add your Groq API key for live answers (or use the server key)
              </button>
            )}
            <div className={`mx-auto mt-4 grid max-w-2xl gap-2 ${compact ? "" : "md:grid-cols-2"}`}>
              {STARTERS.slice(0, compact ? 4 : 6).map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/85 hover:border-fuchsia-400/60 hover:bg-fuchsia-500/10">
                  <Sparkles size={12} className="mr-1.5 inline text-fuchsia-300" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-3xl rounded-br-md bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-sm text-white">{t.content}</div>
            </div>
          ) : (
            <div key={i} className="space-y-2">
              <div className="flex gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-sky-500">🦉</div>
                <div className="min-w-0 flex-1 rounded-3xl rounded-tl-md border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/85">
                  <Markdown text={t.content} />
                  {t.error && <div className="mt-2 rounded-lg bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">Groq unavailable, answered from course material: {t.error}</div>}
                </div>
              </div>
              {t.flow && (
                <div className="pl-10">
                  <FlowDiagram spec={t.flow} height={compact ? 280 : 360} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5 pl-10">
                {t.module && MODULES.some((m) => m.slug === t.module) && (
                  <Link href={`/learn/${t.module}`} className="rounded-full bg-sky-500/20 px-2.5 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/30">
                    📚 {MODULES.find((m) => m.slug === t.module)!.title}
                  </Link>
                )}
                {t.followups?.map((f) => (
                  <button key={f} onClick={() => ask(f)} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/20">
                    ↪ {f}
                  </button>
                ))}
                {t.telemetry && (
                  <span className="ml-auto font-mono text-[10px] text-white/40" title="The assistant is observable too!">
                    🔭 {t.telemetry.model} · {t.telemetry.latencyMs}ms · {t.telemetry.promptTokens ?? "?"}→{t.telemetry.completionTokens ?? "?"} tok
                  </span>
                )}
                {t.offline && <span className="ml-auto text-[10px] text-amber-300/80">🎭 offline mode</span>}
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 pl-1 text-sm text-white/60">
            <span className="grid h-8 w-8 animate-spin place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-sky-500">🦉</span> Obi is thinking and drawing a flow…
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2 border-t border-white/10 p-3"
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about traces, retries, evals, LangGraph…" className="flex-1 rounded-full border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-fuchsia-400" />
        <button disabled={busy || !input.trim()} className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-r from-fuchsia-500 to-sky-500 text-white disabled:opacity-40">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
