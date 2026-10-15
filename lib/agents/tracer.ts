import type { AgentId, LogLevel, ObsEvent, RunTotals, SpanKind, TokenUsage } from "@/lib/types";

// Illustrative Groq pricing for openai/gpt-oss-120b (USD per 1M tokens)
const PRICE_IN = 0.15;
const PRICE_OUT = 0.75;

export const costOf = (t: TokenUsage) => (t.prompt * PRICE_IN + t.completion * PRICE_OUT) / 1_000_000;

// Alert rules — the same thresholds a team would configure in LangSmith / Langfuse / Datadog
export const ALERT_RULES = {
  toolLatencyMs: 3000,
  promptTokens: 1500,
  runCostUsd: 0.004,
};

export interface SpanHandle {
  id: string;
  setTokens(t: TokenUsage): void;
  setOutput(o: unknown): void;
  setAttr(k: string, v: unknown): void;
  log(level: LogLevel, msg: string): void;
}

interface SpanOpts {
  name: string;
  kind: SpanKind;
  node?: AgentId;
  parentId?: string;
  input?: unknown;
  attrs?: Record<string, unknown>;
}

let counter = 0;
const newId = (p: string) => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Minimal OpenTelemetry-style tracer that streams every signal to the browser in real time. */
export class Tracer {
  readonly runId = newId("run");
  readonly startTs = Date.now();
  rootSpanId?: string;
  totals: RunTotals = {
    durationMs: 0,
    tokens: { prompt: 0, completion: 0 },
    costUsd: 0,
    llmCalls: 0,
    toolCalls: 0,
    retries: 0,
    errors: 0,
    steps: 0,
  };
  private costAlerted = false;

  constructor(private sink: (e: ObsEvent) => void) {}

  emit(e: ObsEvent) {
    try {
      this.sink(e);
    } catch {
      /* client disconnected */
    }
  }

  log(level: LogLevel, msg: string, node?: AgentId, spanId?: string) {
    this.emit({ type: "log", ts: Date.now(), level, msg, node, spanId });
  }

  alert(severity: "info" | "warning" | "critical", rule: string, msg: string, node?: AgentId) {
    this.emit({ type: "alert", ts: Date.now(), severity, rule, msg, node });
  }

  async span<T>(opts: SpanOpts, fn: (s: SpanHandle) => Promise<T>): Promise<T> {
    const id = newId("span");
    const start = Date.now();
    let tokens: TokenUsage | undefined;
    let output: unknown;
    const attrs: Record<string, unknown> = { ...(opts.attrs ?? {}) };

    this.emit({ type: "span_start", spanId: id, parentId: opts.parentId, node: opts.node, name: opts.name, kind: opts.kind, ts: start, input: opts.input, attrs: opts.attrs });
    if (opts.kind === "llm") this.totals.llmCalls++;
    if (opts.kind === "tool") this.totals.toolCalls++;

    const handle: SpanHandle = {
      id,
      setTokens: (t) => (tokens = t),
      setOutput: (o) => (output = o),
      setAttr: (k, v) => (attrs[k] = v),
      log: (level, msg) => this.log(level, msg, opts.node, id),
    };

    try {
      const result = await fn(handle);
      const durationMs = Date.now() - start;
      const costUsd = tokens ? costOf(tokens) : undefined;
      if (tokens) {
        this.totals.tokens.prompt += tokens.prompt;
        this.totals.tokens.completion += tokens.completion;
        this.totals.costUsd += costUsd!;
      }
      this.emit({ type: "span_end", spanId: id, ts: Date.now(), durationMs, status: "ok", output: output ?? summarize(result), tokens, costUsd, attrs });
      this.checkRules(opts, durationMs, tokens);
      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      this.totals.errors++;
      this.emit({ type: "span_end", spanId: id, ts: Date.now(), durationMs, status: "error", error: msg, attrs });
      this.log("error", `${opts.name} failed: ${msg}`, opts.node, id);
      throw err;
    }
  }

  private checkRules(opts: SpanOpts, durationMs: number, tokens?: TokenUsage) {
    if (opts.kind === "tool" && durationMs > ALERT_RULES.toolLatencyMs) {
      this.alert("warning", "tool_latency_slo", `${opts.name} took ${(durationMs / 1000).toFixed(1)}s (SLO: < ${ALERT_RULES.toolLatencyMs / 1000}s)`, opts.node);
    }
    if (tokens && tokens.prompt > ALERT_RULES.promptTokens) {
      this.alert("critical", "prompt_token_budget", `${opts.name} sent ${tokens.prompt.toLocaleString()} prompt tokens (budget: ${ALERT_RULES.promptTokens.toLocaleString()})`, opts.node);
    }
    if (!this.costAlerted && this.totals.costUsd > ALERT_RULES.runCostUsd) {
      this.costAlerted = true;
      this.alert("critical", "run_cost_budget", `Run cost $${this.totals.costUsd.toFixed(4)} exceeded per-run budget $${ALERT_RULES.runCostUsd}`, opts.node);
    }
  }

  finish() {
    this.totals.durationMs = Date.now() - this.startTs;
    return this.totals;
  }
}

function summarize(v: unknown): unknown {
  if (v == null) return v;
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 1200 ? s.slice(0, 1200) + "…" : v;
}

export const estimateTokens = (s: string) => Math.max(1, Math.ceil(s.length / 4));
