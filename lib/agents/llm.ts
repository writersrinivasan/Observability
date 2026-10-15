import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { AgentId } from "@/lib/types";
import { estimateTokens, Tracer } from "./tracer";
import { sleep } from "./tools";

export interface LlmCtx {
  tracer: Tracer;
  apiKey?: string;
  model: string;
  speed: number;
}

interface CallOpts {
  node: AgentId;
  parentId: string;
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
  simulate: () => string; // deterministic stand-in when no Groq key is configured
}

const clip = (s: string, n = 600) => (s.length > n ? s.slice(0, n) + ` … [+${s.length - n} chars]` : s);

/** One LLM call == one "llm" span carrying model, prompt, completion, tokens and cost. */
export async function callLLM(ctx: LlmCtx, o: CallOpts): Promise<string> {
  const { tracer } = ctx;
  return tracer.span(
    {
      name: `llm.chat ${ctx.apiKey ? ctx.model : "simulated"}`,
      kind: "llm",
      node: o.node,
      parentId: o.parentId,
      input: { system: clip(o.system), user: clip(o.user) },
      attrs: { "gen_ai.system": ctx.apiKey ? "groq" : "simulator", "gen_ai.request.model": ctx.model, "gen_ai.request.temperature": o.temperature ?? 0.4 },
    },
    async (s) => {
      if (ctx.apiKey) {
        try {
          const llm = new ChatGroq({
            apiKey: ctx.apiKey,
            model: ctx.model,
            temperature: o.temperature ?? 0.4,
            maxRetries: 1,
          });
          // gpt-oss models are reasoning models: keep reasoning short so the crew stays fast and cheap
          const callOpts = {
            ...(o.json ? { response_format: { type: "json_object" as const } } : {}),
            ...(ctx.model.includes("gpt-oss") ? { reasoning_effort: "low" as const } : {}),
          };
          const res = await llm.invoke([new SystemMessage(o.system), new HumanMessage(o.user)], callOpts);
          const text = typeof res.content === "string" ? res.content : JSON.stringify(res.content);
          const u = res.usage_metadata;
          s.setTokens({ prompt: u?.input_tokens ?? estimateTokens(o.system + o.user), completion: u?.output_tokens ?? estimateTokens(text) });
          s.setAttr("gen_ai.response.finish_reason", res.response_metadata?.finish_reason ?? "stop");
          s.setOutput(clip(text, 1200));
          return text;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          s.log("warn", `Groq call failed (${clip(msg, 140)}) → falling back to simulator`);
          s.setAttr("fallback", "simulator");
          tracer.emit({ type: "workflow", ts: Date.now(), node: o.node, action: "fallback", detail: `Groq error → simulated response (${clip(msg, 80)})` });
        }
      }
      // Simulation: realistic latency + token accounting so every layer still lights up.
      await sleep((500 + Math.random() * 700) * ctx.speed);
      const text = o.simulate();
      s.setTokens({ prompt: estimateTokens(o.system + o.user), completion: estimateTokens(text) });
      s.setOutput(clip(text, 1200));
      return text;
    },
  );
}

export function parseJson<T>(text: string, fallback: T): T {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as T) : fallback;
  } catch {
    return fallback;
  }
}
