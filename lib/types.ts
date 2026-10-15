// Shared contract between the LangGraph runtime (server) and the visual layers (client).
// Every observability "layer" in the Lab is just a different lens on this one event stream.

export type AgentId =
  | "planner"
  | "flights"
  | "hotels"
  | "weather"
  | "budget"
  | "dealhunter"
  | "writer"
  | "judge";

export type SpanKind = "run" | "agent" | "llm" | "tool" | "guardrail";
export type SpanStatus = "running" | "ok" | "error";
export type LogLevel = "debug" | "info" | "warn" | "error";

export type FaultId =
  | "none"
  | "slow_tool"
  | "tool_error"
  | "hallucination"
  | "budget_loop"
  | "token_bloat";

export interface TokenUsage {
  prompt: number;
  completion: number;
}

export type ObsEvent =
  | { type: "run_start"; runId: string; threadId: string; ts: number; input: string; fault: FaultId; llm: "groq" | "simulated"; model: string }
  | { type: "span_start"; spanId: string; parentId?: string; node?: AgentId; name: string; kind: SpanKind; ts: number; input?: unknown; attrs?: Record<string, unknown> }
  | { type: "span_end"; spanId: string; ts: number; durationMs: number; status: SpanStatus; output?: unknown; error?: string; tokens?: TokenUsage; costUsd?: number; attrs?: Record<string, unknown> }
  | { type: "log"; ts: number; level: LogLevel; node?: AgentId; spanId?: string; msg: string }
  | { type: "message"; ts: number; from: AgentId | "user"; to: AgentId | "user"; summary: string }
  | { type: "state"; ts: number; node: AgentId; step: number; update: Record<string, unknown> }
  | { type: "checkpoint"; ts: number; checkpointId: string; step: number; next: string[]; source: string; values: Record<string, unknown> }
  | { type: "eval"; ts: number; node: AgentId; name: string; score: number; pass: boolean; reason: string }
  | { type: "alert"; ts: number; severity: "info" | "warning" | "critical"; rule: string; msg: string; node?: AgentId }
  | { type: "workflow"; ts: number; node: AgentId; action: "retry" | "loop" | "fallback" | "guard" | "timeout"; detail: string }
  | { type: "run_end"; ts: number; status: "ok" | "error"; output?: string; error?: string; totals: RunTotals };

export interface RunTotals {
  durationMs: number;
  tokens: TokenUsage;
  costUsd: number;
  llmCalls: number;
  toolCalls: number;
  retries: number;
  errors: number;
  steps: number;
}

export interface FlowSpec {
  title?: string;
  nodes: { id: string; label: string; emoji?: string; color?: string; desc?: string }[];
  edges: { from: string; to: string; label?: string }[];
}
