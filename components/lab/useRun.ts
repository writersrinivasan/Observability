"use client";

import { useCallback, useReducer, useRef } from "react";
import type { AgentId, FaultId, ObsEvent, RunTotals, SpanKind, SpanStatus, TokenUsage } from "@/lib/types";
import { AGENT_ORDER } from "@/lib/agents/meta";

export interface SpanRec {
  id: string;
  parentId?: string;
  node?: AgentId;
  name: string;
  kind: SpanKind;
  start: number;
  end?: number;
  durationMs?: number;
  status: SpanStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  tokens?: TokenUsage;
  costUsd?: number;
  attrs?: Record<string, unknown>;
}

type Ev<T extends ObsEvent["type"]> = Extract<ObsEvent, { type: T }>;
export type NodeStatus = "idle" | "running" | "done" | "error";

export interface NodeStat { ms: number; tokens: number; cost: number; visits: number; errors: number }

export interface RunView {
  status: "idle" | "running" | "done" | "error";
  runId?: string;
  threadId?: string;
  startTs?: number;
  endTs?: number;
  llm?: "groq" | "simulated";
  model?: string;
  fault?: FaultId;
  input?: string;
  isFork?: boolean;
  spans: Record<string, SpanRec>;
  spanOrder: string[];
  logs: Ev<"log">[];
  messages: Ev<"message">[];
  states: Ev<"state">[];
  checkpoints: Ev<"checkpoint">[];
  evals: Ev<"eval">[];
  alerts: Ev<"alert">[];
  workflow: Ev<"workflow">[];
  nodeStatus: Record<AgentId, NodeStatus>;
  nodeStats: Record<AgentId, NodeStat>;
  edgePulses: Record<string, number>; // edgeId → pulse counter (each increment animates a packet)
  traveled: Record<string, number>;
  output?: string;
  error?: string;
  totals?: RunTotals;
  eventCount: number;
  counts: Partial<Record<ObsEvent["type"], number>>;
}

const blankNodes = <T,>(v: () => T) => Object.fromEntries(AGENT_ORDER.map((a) => [a, v()])) as Record<AgentId, T>;

export const initialRun = (): RunView => ({
  status: "idle",
  spans: {},
  spanOrder: [],
  logs: [],
  messages: [],
  states: [],
  checkpoints: [],
  evals: [],
  alerts: [],
  workflow: [],
  nodeStatus: blankNodes<NodeStatus>(() => "idle"),
  nodeStats: blankNodes<NodeStat>(() => ({ ms: 0, tokens: 0, cost: 0, visits: 0, errors: 0 })),
  edgePulses: {},
  traveled: {},
  eventCount: 0,
  counts: {},
});

export function edgeIdFor(from: string, to: string) {
  if (from === "user") return "start-planner";
  if (to === "user") return "judge-end";
  return `${from}-${to}`;
}

type Action = { t: "reset"; fork?: boolean } | { t: "event"; e: ObsEvent } | { t: "fail"; error: string };

function reduce(s: RunView, a: Action): RunView {
  if (a.t === "reset") return { ...initialRun(), status: "running", isFork: a.fork };
  if (a.t === "fail") return { ...s, status: "error", error: a.error, endTs: Date.now() };
  const e = a.e;
  const n: RunView = { ...s, eventCount: s.eventCount + 1, counts: { ...s.counts, [e.type]: (s.counts[e.type] ?? 0) + 1 } };
  switch (e.type) {
    case "run_start":
      return { ...n, runId: e.runId, threadId: e.threadId, startTs: e.ts, llm: e.llm, model: e.model, fault: e.fault, input: e.input };
    case "span_start": {
      const rec: SpanRec = { id: e.spanId, parentId: e.parentId, node: e.node, name: e.name, kind: e.kind, start: e.ts, status: "running", input: e.input, attrs: e.attrs };
      n.spans = { ...s.spans, [e.spanId]: rec };
      n.spanOrder = [...s.spanOrder, e.spanId];
      if (e.kind === "agent" && e.node) {
        n.nodeStatus = { ...s.nodeStatus, [e.node]: "running" };
        const st = s.nodeStats[e.node];
        n.nodeStats = { ...s.nodeStats, [e.node]: { ...st, visits: st.visits + 1 } };
      }
      return n;
    }
    case "span_end": {
      const prev = s.spans[e.spanId];
      if (!prev) return n;
      const rec: SpanRec = { ...prev, end: e.ts, durationMs: e.durationMs, status: e.status, output: e.output, error: e.error, tokens: e.tokens, costUsd: e.costUsd, attrs: { ...prev.attrs, ...e.attrs } };
      n.spans = { ...s.spans, [e.spanId]: rec };
      if (prev.node) {
        const st = s.nodeStats[prev.node];
        const upd = { ...st };
        if (prev.kind === "agent") {
          upd.ms += e.durationMs;
          n.nodeStatus = { ...s.nodeStatus, [prev.node]: e.status === "error" ? "error" : "done" };
        }
        if (e.tokens) upd.tokens += e.tokens.prompt + e.tokens.completion;
        if (e.costUsd) upd.cost += e.costUsd;
        if (e.status === "error") upd.errors += 1;
        n.nodeStats = { ...s.nodeStats, [prev.node]: upd };
      }
      return n;
    }
    case "log":
      return { ...n, logs: [...s.logs, e] };
    case "message": {
      const id = edgeIdFor(e.from, e.to);
      return { ...n, messages: [...s.messages, e], edgePulses: { ...s.edgePulses, [id]: (s.edgePulses[id] ?? 0) + 1 }, traveled: { ...s.traveled, [id]: (s.traveled[id] ?? 0) + 1 } };
    }
    case "state":
      return { ...n, states: [...s.states, e] };
    case "checkpoint":
      return { ...n, checkpoints: [...s.checkpoints, e] };
    case "eval":
      return { ...n, evals: [...s.evals, e] };
    case "alert":
      return { ...n, alerts: [...s.alerts, e] };
    case "workflow":
      return { ...n, workflow: [...s.workflow, e] };
    case "run_end":
      return { ...n, status: e.status === "ok" ? "done" : "error", output: e.output, error: e.error, totals: e.totals, endTs: e.ts };
  }
}

export interface RunRequest {
  request: string;
  fault: FaultId;
  speed: number;
  fork?: { threadId: string; checkpointId: string; budget?: number };
}

export function useRun(headers: () => Record<string, string>, onDone?: (v: RunView) => void) {
  const [view, dispatch] = useReducer(reduce, undefined, initialRun);
  const abortRef = useRef<AbortController | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const start = useCallback(
    async (body: RunRequest) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      dispatch({ t: "reset", fork: !!body.fork });
      try {
        const res = await fetch("/api/run", { method: "POST", headers: headers(), body: JSON.stringify(body), signal: ac.signal });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            if (chunk.startsWith("data: ")) dispatch({ t: "event", e: JSON.parse(chunk.slice(6)) });
          }
        }
        // allow the reducer to flush before reporting
        setTimeout(() => onDone?.(viewRef.current), 50);
      } catch (err) {
        if ((err as Error).name !== "AbortError") dispatch({ t: "fail", error: (err as Error).message });
      }
    },
    [headers, onDone],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  return { view, start, stop };
}
