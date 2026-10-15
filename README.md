# 🔭 AgentOps Observatory — AI Observability & Workflow Management

A dual platform for a **2-day, 5-hour workshop** (2 × 2.5h):

| | |
|---|---|
| 📚 **Learn** (`/learn`) | 10 modules — objectives, theory, animated concept flows, code, Lab exercise, quiz, facilitator run-sheet |
| 🧪 **Lab** (`/lab`) | A real **LangGraph** `StateGraph` "Travel Crew" (8 agents) streamed live over SSE, with 9 observability layers and black-box vs glass-box comparison |
| 🦉 **AI Assistant** (`/assistant` + floating dock) | Groq-powered tutor; every answer comes with an animated flow diagram |

## Run it

```bash
npm install
cp .env.local.example .env.local   # put your GROQ_API_KEY here (optional)
npm run dev                         # http://localhost:3000
```

The Groq key can also be entered in the browser via **⚙️ Groq** (top-right). With no key, a realistic simulator runs so the workshop works offline.

## The Travel Crew graph (`lib/agents/graph.ts`)

```
Traveler → 🧭 Planner ─┬→ ✈️ Flights ─┐
                       ├→ 🏨 Hotels  ─┼→ 💰 Budget ─(ok)→ 📝 Writer → 🛡️ Judge ─(pass)→ 🎉
                       └→ 🌦️ Weather ─┘     ↑   └(over)→ 💸 Deal Hunter        └(fail)→ Writer
                                            └──────────────┘ (max 3)               (max 2)
```

Fault injection: 🐢 slow tool · 💥 flaky API (retries + backoff) · 👻 hallucination (judge loop) · 🔁 budget loop (guard) · 🎈 token bloat (cost alert).

Layers: Inspector · Traces (waterfall) · Logs · Metrics (per-agent + p50/p95 history) · State & Time-travel (real LangGraph checkpoints, fork with patched budget) · Evals · Alerts · Agent Messages · Workflow Mgmt.

## Structure

```
lib/agents/   graph.ts (LangGraph) · tracer.ts (spans/alerts) · llm.ts (Groq + fallback) · tools.ts (mock APIs) · meta.ts
lib/curriculum.ts   all course content
app/api/run         SSE stream of observability events
app/api/assistant   Groq → { answer, flow, module, followups }
components/lab/     AgentGraph, BlackBox, Layers, useRun
```
