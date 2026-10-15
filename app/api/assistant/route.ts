import { MODULES } from "@/lib/curriculum";
import { resolveGroq } from "@/lib/groq";
import type { FlowSpec } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COURSE_INDEX = MODULES.map((m) => `- [${m.slug}] Day ${m.day}: ${m.title} — ${m.concepts.map((c) => c.term).join(", ")}`).join("\n");

const SYSTEM = `You are "Obi", the AI teaching assistant for a 2-day course "AI Observability & Workflow Management" (LangGraph agents, tracing, logs, metrics, cost, checkpoints, retries, guardrails, evals, alerts, tools like LangSmith/Langfuse/Phoenix/OpenTelemetry).
The hands-on Lab runs a LangGraph "Travel Crew": Trip Planner (supervisor) → parallel Flight Scout, Hotel Finder, Weather Oracle → Budget Guardian (router, loops with Deal Hunter max 3) → Itinerary Writer → Quality Judge (guardrail, loops back to writer max 2). Faults: slow_tool, tool_error, hallucination, budget_loop, token_bloat.

Course modules:
${COURSE_INDEX}

ALWAYS answer with a single JSON object:
{
  "answer": "clear markdown explanation (80-220 words, use **bold**, bullet lists, \`code\`). Relate to the Travel Crew lab when helpful.",
  "flow": {
    "title": "short diagram title",
    "nodes": [{"id":"a","label":"short label (max 4 words)","emoji":"one emoji","color":"#hex vivid color","desc":"optional max 6 words"}],
    "edges": [{"from":"a","to":"b","label":"optional 1-3 words"}]
  },
  "module": "most relevant module slug from the list, or null",
  "followups": ["2-3 short follow-up questions the learner might ask next"]
}
The flow must visualise the mechanism you explain step by step (4-9 nodes, vivid distinct colors, edges in logical order; loops allowed).`;

interface Msg { role: "user" | "assistant"; content: string }

export async function POST(req: Request) {
  const { messages = [] } = (await req.json().catch(() => ({}))) as { messages?: Msg[] };
  const { apiKey, model } = resolveGroq(req);
  const last = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";

  if (!apiKey) return Response.json({ ...offlineAnswer(last), offline: true });

  const started = Date.now();
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 1400,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM }, ...messages.slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return Response.json({ ...offlineAnswer(last), error: `Groq ${res.status}: ${text.slice(0, 200)}` });
    }
    const data = await res.json();
    const parsed = safeParse(data.choices?.[0]?.message?.content ?? "{}");
    return Response.json({
      answer: String(parsed.answer ?? "I couldn't produce an answer."),
      flow: sanitizeFlow(parsed.flow),
      module: typeof parsed.module === "string" ? parsed.module : null,
      followups: Array.isArray(parsed.followups) ? parsed.followups.slice(0, 3).map(String) : [],
      telemetry: { model, latencyMs: Date.now() - started, promptTokens: data.usage?.prompt_tokens, completionTokens: data.usage?.completion_tokens },
    });
  } catch (err) {
    return Response.json({ ...offlineAnswer(last), error: err instanceof Error ? err.message : String(err) });
  }
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    try {
      return m ? JSON.parse(m[0]) : {};
    } catch {
      return { answer: s };
    }
  }
}

function sanitizeFlow(f: unknown): FlowSpec | null {
  if (!f || typeof f !== "object") return null;
  const flow = f as FlowSpec;
  const nodes = (Array.isArray(flow.nodes) ? flow.nodes : []).slice(0, 12).map((n, i) => ({
    id: String(n.id ?? `n${i}`),
    label: String(n.label ?? "step").slice(0, 40),
    emoji: n.emoji ? String(n.emoji).slice(0, 4) : undefined,
    color: /^#[0-9a-f]{3,8}$/i.test(String(n.color)) ? String(n.color) : undefined,
    desc: n.desc ? String(n.desc).slice(0, 60) : undefined,
  }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = (Array.isArray(flow.edges) ? flow.edges : []).filter((e) => ids.has(String(e.from)) && ids.has(String(e.to))).slice(0, 20).map((e) => ({ from: String(e.from), to: String(e.to), label: e.label ? String(e.label).slice(0, 24) : undefined }));
  return nodes.length ? { title: flow.title ? String(flow.title) : undefined, nodes, edges } : null;
}

// Without a key, answer from the curriculum itself so the assistant still teaches visually.
function offlineAnswer(q: string) {
  const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const scored = MODULES.map((m) => {
    const hay = (m.title + " " + m.subtitle + " " + m.concepts.map((c) => c.term + " " + c.def).join(" ") + " " + m.sections.map((s) => s.heading + " " + s.body).join(" ")).toLowerCase();
    return { m, score: words.reduce((acc, w) => acc + (hay.includes(w) ? 1 : 0), 0) };
  }).sort((a, b) => b.score - a.score);
  const m = scored[0].m;
  const concept = m.concepts.find((c) => words.some((w) => c.term.toLowerCase().includes(w))) ?? m.concepts[0];
  return {
    answer: `_Offline mode — add your Groq API key in ⚙️ Settings for live answers._\n\n**${concept.emoji} ${concept.term}:** ${concept.def}\n\n${m.sections[0].body}\n\nThis is covered in **Day ${m.day} · ${m.title}**. The diagram shows the mechanism.`,
    flow: m.flow,
    module: m.slug,
    followups: m.quiz.slice(0, 2).map((x) => x.q),
  };
}
