import type { FaultId, FlowSpec } from "@/lib/types";

export type LayerId = "graph" | "traces" | "logs" | "metrics" | "state" | "evals" | "alerts" | "messages" | "workflow";

export interface Module {
  slug: string;
  day: 1 | 2;
  order: number;
  title: string;
  subtitle: string;
  minutes: number;
  emoji: string;
  gradient: string;
  objectives: string[];
  sections: { heading: string; body: string; bullets?: string[] }[];
  concepts: { term: string; emoji: string; def: string }[];
  flow: FlowSpec;
  code?: { title: string; lang: string; code: string };
  lab?: { fault: FaultId; layer: LayerId; steps: string[] };
  quiz: { q: string; options: string[]; answer: number; why: string }[];
  agenda: { min: number; activity: string }[];
}

export interface DayPlan {
  day: 1 | 2;
  title: string;
  theme: string;
  gradient: string;
  schedule: { slug?: string; label: string; minutes: number; kind: "module" | "break" | "lab" }[];
}

export const DAYS: DayPlan[] = [
  {
    day: 1,
    title: "Day 1 · See Inside Your Agents",
    theme: "From black box to glass box — foundations, agent anatomy and tracing",
    gradient: "from-fuchsia-500 via-purple-500 to-sky-500",
    schedule: [
      { slug: "why-observability", label: "Why agents fail silently", minutes: 25, kind: "module" },
      { slug: "agent-anatomy", label: "Anatomy of a LangGraph workflow", minutes: 30, kind: "module" },
      { slug: "telemetry-pillars", label: "The telemetry pillars for LLM systems", minutes: 30, kind: "module" },
      { label: "Break ☕", minutes: 10, kind: "break" },
      { slug: "distributed-tracing", label: "Tracing agents: spans, waterfalls, context", minutes: 30, kind: "module" },
      { slug: "lab-black-vs-glass", label: "Lab 1 · Black box vs glass box", minutes: 25, kind: "lab" },
    ],
  },
  {
    day: 2,
    title: "Day 2 · Operate & Govern Workflows",
    theme: "Metrics, state, evals, alerts and the workflow-management toolkit",
    gradient: "from-amber-400 via-orange-500 to-rose-500",
    schedule: [
      { slug: "metrics-cost", label: "Metrics, latency & cost engineering", minutes: 25, kind: "module" },
      { slug: "state-workflow", label: "State, checkpoints & workflow management", minutes: 30, kind: "module" },
      { slug: "evals-guardrails", label: "Evaluations & guardrails", minutes: 25, kind: "module" },
      { label: "Break ☕", minutes: 10, kind: "break" },
      { slug: "alerts-tooling", label: "Alerting, dashboards & the tool landscape", minutes: 25, kind: "module" },
      { slug: "capstone-incidents", label: "Capstone · Incident war-room", minutes: 35, kind: "lab" },
    ],
  },
];

export const MODULES: Module[] = [
  // ───────────────────────────── DAY 1 ─────────────────────────────
  {
    slug: "why-observability",
    day: 1,
    order: 1,
    title: "Why Agents Fail Silently",
    subtitle: "The black-box problem of agentic AI",
    minutes: 25,
    emoji: "🕳️",
    gradient: "from-fuchsia-500 to-purple-600",
    objectives: [
      "Explain why agentic systems are harder to debug than classic software or single LLM calls",
      "Name the five failure families: latency, errors, quality, cost and loops",
      "Define observability vs monitoring and why both matter for agents",
    ],
    sections: [
      {
        heading: "From one prompt to a crew of agents",
        body: "A chatbot is one request → one LLM call → one answer. An **agentic workflow** is a graph: a supervisor plans, specialists call tools in parallel, a guardian checks rules, a writer drafts, a judge reviews — and any of them can loop. One user request can fan out into 10–40 LLM and tool calls.",
        bullets: [
          "**Non-determinism:** the same input can take a different path through the graph",
          "**Compounding error:** a 95%-reliable step chained 8 times succeeds only ~66% of the time",
          "**Hidden cost:** tokens are spent by agents talking to each other, not just to the user",
          "**Silent failure:** the final answer *looks* fine while being wrong (hallucination)",
        ],
      },
      {
        heading: "Monitoring vs observability",
        body: "**Monitoring** answers questions you knew to ask in advance (\"is error rate > 2%?\"). **Observability** lets you ask *new* questions about behaviour you didn't predict (\"why did the Hotel Finder retry 3 times only for Tokyo requests?\"). Agents produce emergent behaviour, so you need observability — rich, correlated, high-cardinality telemetry.",
      },
      {
        heading: "The five failure families",
        body: "Every incident in this course belongs to one of these families. You'll inject each one in the Lab.",
        bullets: [
          "🐢 **Latency** — a slow tool or model stalls the whole graph",
          "💥 **Errors** — flaky APIs, rate limits, malformed JSON",
          "👻 **Quality** — hallucinations, off-policy answers, PII leaks",
          "🎈 **Cost** — prompt bloat, runaway context, oversized models",
          "🔁 **Loops** — agents ping-ponging until a recursion limit hits",
        ],
      },
    ],
    concepts: [
      { term: "Agentic workflow", emoji: "🕸️", def: "A graph of LLM-powered steps that plan, call tools, and decide what to do next based on shared state." },
      { term: "Black box", emoji: "🕳️", def: "A system where you only see input and output — no visibility into intermediate decisions." },
      { term: "Observability", emoji: "🔭", def: "The ability to understand a system's internal state from the telemetry it emits." },
      { term: "Telemetry", emoji: "📡", def: "Data a system emits about itself: traces, logs, metrics, events, evals." },
    ],
    flow: {
      title: "Black box vs glass box",
      nodes: [
        { id: "u", label: "User request", emoji: "🙋", color: "#a855f7" },
        { id: "bb", label: "Black box crew", emoji: "🕳️", color: "#475569", desc: "8 agents, 15+ calls… invisible" },
        { id: "out", label: "Answer (maybe wrong?)", emoji: "❓", color: "#64748b" },
        { id: "gb", label: "Glass box crew", emoji: "🔭", color: "#0ea5e9", desc: "Every step emits telemetry" },
        { id: "tel", label: "Traces · Logs · Metrics · Evals", emoji: "📡", color: "#22c55e" },
        { id: "fix", label: "Root cause in minutes", emoji: "🎯", color: "#eab308" },
      ],
      edges: [
        { from: "u", to: "bb" },
        { from: "bb", to: "out", label: "no clues" },
        { from: "u", to: "gb" },
        { from: "gb", to: "tel", label: "instrumented" },
        { from: "tel", to: "fix" },
      ],
    },
    lab: {
      fault: "slow_tool",
      layer: "graph",
      steps: [
        "Open the Lab in **Compare** mode and run the 🐢 Slow tool scenario.",
        "Watch the left (black box) panel: you only see a spinner and an elapsed timer.",
        "Watch the right (glass box) panel: which agent is glowing for 4 seconds?",
        "Discuss: how long would it take your team to find this without telemetry?",
      ],
    },
    quiz: [
      { q: "A step that is 95% reliable is chained 8 times. Roughly how often does the whole chain succeed?", options: ["95%", "~80%", "~66%", "~40%"], answer: 2, why: "0.95⁸ ≈ 0.66 — reliability compounds, which is why per-step visibility matters." },
      { q: "Which question needs observability rather than plain monitoring?", options: ["Is the API up?", "Is p95 latency above 3s?", "Why does the hotel agent only retry for Tokyo?", "How many requests per minute?"], answer: 2, why: "It's an unanticipated, high-cardinality question — exactly what observability is for." },
    ],
    agenda: [
      { min: 5, activity: "Icebreaker: 'Tell me about an AI bug you couldn't explain'" },
      { min: 10, activity: "Lecture: agentic workflows & the compounding-error math" },
      { min: 5, activity: "Demo: black box vs glass box in the Lab (compare mode)" },
      { min: 5, activity: "Quiz + discussion" },
    ],
  },
  {
    slug: "agent-anatomy",
    day: 1,
    order: 2,
    title: "Anatomy of a LangGraph Workflow",
    subtitle: "State, nodes, edges, routers and checkpoints",
    minutes: 30,
    emoji: "🧬",
    gradient: "from-purple-500 to-indigo-600",
    objectives: [
      "Read a LangGraph StateGraph: state schema, nodes, edges and conditional routes",
      "Recognise orchestration patterns: supervisor, fan-out/fan-in, loops, evaluator–optimizer",
      "Understand reducers and why parallel agents need them",
    ],
    sections: [
      {
        heading: "The four building blocks",
        body: "LangGraph models an agent system as a **state machine**. Each node is a function `(state) → partial update`. Edges decide what runs next. A checkpointer saves state after every super-step.",
        bullets: [
          "**State** — a typed object shared by all agents (our `TravelState`)",
          "**Nodes** — agents or functions: Trip Planner, Flight Scout, Hotel Finder…",
          "**Edges** — fixed transitions (`planner → flights`) or **conditional** routers (`budget → dealhunter | writer`)",
          "**Checkpointer** — persists state per `thread_id` so you can resume, replay, or time-travel",
        ],
      },
      {
        heading: "Patterns in our Travel Crew",
        body: "The Lab's crew uses the most common production patterns, so every concept has a live example.",
        bullets: [
          "🧭 **Supervisor** — the Trip Planner turns free text into a structured intent and dispatches work",
          "🔀 **Fan-out / fan-in** — flights, hotels and weather run *in parallel*, then join at the Budget Guardian",
          "🔁 **Loop with guard** — Budget ↔ Deal Hunter loops at most 3 times",
          "🛡️ **Evaluator–optimizer** — the Judge rejects drafts and sends them back to the Writer",
        ],
      },
      {
        heading: "Reducers: how parallel agents share state safely",
        body: "When three agents write to the same key in the same step, LangGraph needs a **reducer** to merge them. Our `messages` channel uses `(a, b) => a.concat(b)` so every agent's message is kept. Without it LangGraph throws `InvalidUpdateError` — a classic first-week bug.",
      },
    ],
    concepts: [
      { term: "StateGraph", emoji: "🗺️", def: "LangGraph's builder for graphs whose nodes read and update a shared typed state." },
      { term: "Conditional edge", emoji: "🔀", def: "A router function that inspects state and returns the next node's name." },
      { term: "Super-step", emoji: "⏱️", def: "One tick of the graph: all runnable nodes execute (possibly in parallel), then state is checkpointed." },
      { term: "Reducer", emoji: "🧮", def: "A merge function for a state key — needed when parallel nodes write the same key." },
    ],
    flow: {
      title: "The Travel Crew graph",
      nodes: [
        { id: "s", label: "START", emoji: "🚦", color: "#64748b" },
        { id: "p", label: "Trip Planner", emoji: "🧭", color: "#a855f7", desc: "supervisor" },
        { id: "f", label: "Flight Scout", emoji: "✈️", color: "#0ea5e9" },
        { id: "h", label: "Hotel Finder", emoji: "🏨", color: "#f97316" },
        { id: "w", label: "Weather Oracle", emoji: "🌦️", color: "#14b8a6" },
        { id: "b", label: "Budget Guardian", emoji: "💰", color: "#eab308", desc: "router" },
        { id: "d", label: "Deal Hunter", emoji: "💸", color: "#ec4899" },
        { id: "wr", label: "Itinerary Writer", emoji: "📝", color: "#22c55e" },
        { id: "j", label: "Quality Judge", emoji: "🛡️", color: "#ef4444" },
      ],
      edges: [
        { from: "s", to: "p" },
        { from: "p", to: "f", label: "fan-out" },
        { from: "p", to: "h" },
        { from: "p", to: "w" },
        { from: "f", to: "b", label: "join" },
        { from: "h", to: "b" },
        { from: "w", to: "b" },
        { from: "b", to: "d", label: "over budget" },
        { from: "d", to: "b", label: "loop" },
        { from: "b", to: "wr", label: "ok" },
        { from: "wr", to: "j" },
        { from: "j", to: "wr", label: "reject" },
      ],
    },
    code: {
      title: "lib/agents/graph.ts — the real graph running in the Lab",
      lang: "ts",
      code: `const TravelState = Annotation.Root({
  request: Annotation<string>,
  intent: Annotation<Intent | undefined>,
  budgetCheck: Annotation<BudgetCheck | undefined>,
  dealAttempts: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),
  // parallel agents append messages → needs a reducer
  messages: Annotation<AgentMsg[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
});

const graph = new StateGraph(TravelState)
  .addNode("planner", planner)
  .addNode("flights", flights).addNode("hotels", hotels).addNode("weather", weather)
  .addNode("budget", budget).addNode("dealhunter", dealhunter)
  .addNode("writer", writer).addNode("judge", judge)
  .addEdge(START, "planner")
  .addEdge("planner", "flights").addEdge("planner", "hotels").addEdge("planner", "weather")
  .addEdge(["flights", "hotels", "weather"], "budget")        // fan-in join
  .addConditionalEdges("budget", routeBudget, ["writer", "dealhunter"])
  .addEdge("dealhunter", "budget")                              // loop
  .addEdge("writer", "judge")
  .addConditionalEdges("judge", routeJudge, ["writer", END])
  .compile({ checkpointer: new MemorySaver() });`,
    },
    lab: {
      fault: "none",
      layer: "messages",
      steps: [
        "Run the 🌈 Happy path with observability ON.",
        "Watch the three specialists light up *at the same time* — that's fan-out.",
        "Open the 💬 Agent Messages layer and follow the conversation from user → planner → … → user.",
        "Click the Budget Guardian node: which state keys did it read, and which did it write?",
      ],
    },
    quiz: [
      { q: "Why does the `messages` key need a reducer?", options: ["For speed", "Parallel nodes write it in the same super-step", "LangGraph requires one on every key", "To compress tokens"], answer: 1, why: "Flights, hotels and weather all append messages in the same step; the reducer merges them." },
      { q: "Which LangGraph feature makes 'resume from step 3' possible?", options: ["Reducers", "Conditional edges", "The checkpointer", "Fan-out"], answer: 2, why: "Checkpoints persist state after each super-step per thread_id." },
    ],
    agenda: [
      { min: 10, activity: "Whiteboard the four building blocks" },
      { min: 10, activity: "Code walk-through of lib/agents/graph.ts" },
      { min: 7, activity: "Lab: watch fan-out and follow agent messages" },
      { min: 3, activity: "Quiz" },
    ],
  },
  {
    slug: "telemetry-pillars",
    day: 1,
    order: 3,
    title: "The Telemetry Pillars for LLM Systems",
    subtitle: "Traces, logs, metrics — plus events and evals",
    minutes: 30,
    emoji: "🏛️",
    gradient: "from-sky-500 to-cyan-500",
    objectives: [
      "Differentiate traces, logs, metrics, events and evaluations",
      "Know what LLM-specific attributes to capture (model, tokens, prompt, cost)",
      "Understand the OpenTelemetry GenAI semantic conventions and the instrumentation pipeline",
    ],
    sections: [
      {
        heading: "Five signals, one story",
        body: "Classic observability has three pillars. LLM systems add two more. They're most powerful when **correlated by trace and span IDs**.",
        bullets: [
          "🧵 **Traces** — the tree of everything that happened for one request (the *where* and *when*)",
          "📜 **Logs** — timestamped human-readable lines attached to spans (the *why*)",
          "📊 **Metrics** — aggregated numbers over many runs: p95 latency, tokens/run, error rate (the *how much*)",
          "⚡ **Events** — discrete facts: retries, fallbacks, loop iterations, guard trips",
          "✅ **Evals** — scores for quality: groundedness, helpfulness, safety (the *how good*)",
        ],
      },
      {
        heading: "What to capture on every LLM call",
        body: "OpenTelemetry's **GenAI semantic conventions** standardise attribute names so any backend can read them:",
        bullets: [
          "`gen_ai.system` (groq, openai, anthropic) and `gen_ai.request.model`",
          "`gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`",
          "`gen_ai.request.temperature`, `gen_ai.response.finish_reason`",
          "Prompt and completion content (opt-in — watch out for PII!)",
        ],
      },
      {
        heading: "The instrumentation pipeline",
        body: "Agents emit telemetry via an SDK → a **collector** batches, samples and scrubs it → a **backend** stores and indexes it → **dashboards, alerts and eval jobs** consume it. In the Lab, our `Tracer` class plays SDK + collector and streams straight to your browser via Server-Sent Events.",
      },
    ],
    concepts: [
      { term: "Trace", emoji: "🧵", def: "All the spans produced by a single request, linked by a shared trace ID." },
      { term: "Metric", emoji: "📊", def: "A numeric aggregate over time (counter, gauge, histogram)." },
      { term: "Semantic conventions", emoji: "📖", def: "Standard attribute names (e.g. gen_ai.usage.input_tokens) so tools interoperate." },
      { term: "Collector", emoji: "🧺", def: "A service that receives, processes (sample, redact) and exports telemetry." },
    ],
    flow: {
      title: "Telemetry pipeline",
      nodes: [
        { id: "a", label: "Agents & tools", emoji: "🤖", color: "#a855f7" },
        { id: "sdk", label: "Instrumentation SDK", emoji: "🧰", color: "#0ea5e9", desc: "OTel / LangSmith / Langfuse" },
        { id: "col", label: "Collector", emoji: "🧺", color: "#14b8a6", desc: "batch · sample · redact PII" },
        { id: "db", label: "Telemetry store", emoji: "🗄️", color: "#f97316" },
        { id: "dash", label: "Dashboards", emoji: "📊", color: "#eab308" },
        { id: "al", label: "Alerts", emoji: "🚨", color: "#ef4444" },
        { id: "ev", label: "Eval jobs", emoji: "✅", color: "#22c55e" },
      ],
      edges: [
        { from: "a", to: "sdk", label: "spans/logs" },
        { from: "sdk", to: "col", label: "OTLP" },
        { from: "col", to: "db" },
        { from: "db", to: "dash" },
        { from: "db", to: "al" },
        { from: "db", to: "ev" },
      ],
    },
    code: {
      title: "Every LLM call becomes a span with GenAI attributes",
      lang: "ts",
      code: `return tracer.span({
  name: \`llm.chat \${model}\`,
  kind: "llm",
  parentId: agentSpan.id,               // links it into the trace tree
  attrs: {
    "gen_ai.system": "groq",
    "gen_ai.request.model": model,
    "gen_ai.request.temperature": 0.4,
  },
}, async (s) => {
  const res = await llm.invoke([new SystemMessage(sys), new HumanMessage(user)]);
  s.setTokens({ prompt: res.usage_metadata.input_tokens,
                completion: res.usage_metadata.output_tokens });   // → cost
  return res.content;
});`,
    },
    lab: {
      fault: "none",
      layer: "logs",
      steps: [
        "Run the Happy path. Switch between 🧵 Traces, 📜 Logs and 📊 Metrics.",
        "Click a log line — notice it links to the span that produced it (correlation!).",
        "Find an `llm.chat` span. Which `gen_ai.*` attributes does it carry?",
      ],
    },
    quiz: [
      { q: "Which signal best answers 'what was our p95 latency last hour?'", options: ["Traces", "Logs", "Metrics", "Evals"], answer: 2, why: "Metrics aggregate across many runs; a single trace shows one run." },
      { q: "Where should PII be scrubbed from prompts?", options: ["In the dashboard", "In the collector / SDK before storage", "Never", "Only in alerts"], answer: 1, why: "Redact as early as possible — before telemetry is persisted." },
    ],
    agenda: [
      { min: 12, activity: "Lecture: five signals, GenAI semantic conventions" },
      { min: 8, activity: "Pipeline diagram + build-vs-buy discussion" },
      { min: 8, activity: "Lab: correlate a log line with its span" },
      { min: 2, activity: "Quiz" },
    ],
  },
  {
    slug: "distributed-tracing",
    day: 1,
    order: 4,
    title: "Tracing Agents",
    subtitle: "Spans, parent–child trees, waterfalls & context propagation",
    minutes: 30,
    emoji: "🧵",
    gradient: "from-cyan-500 to-emerald-500",
    objectives: [
      "Read a trace waterfall and spot the critical path",
      "Understand span kinds (run, agent, llm, tool, guardrail) and nesting",
      "Explain context propagation across parallel and async agents",
    ],
    sections: [
      {
        heading: "Spans all the way down",
        body: "A **span** is one timed operation with a name, start/end, status, attributes and a parent. In our crew: `travel_crew.run` → `agent.hotels` → `tool.hotel_search (attempt 2)`. The tree shows *who called whom*; the timeline shows *what overlapped*.",
      },
      {
        heading: "Reading a waterfall",
        body: "Bars on the same row-depth that overlap ran in parallel. The **critical path** is the longest chain of sequential bars — speeding up anything else doesn't reduce total latency.",
        bullets: [
          "Parallel fan-out: flight, hotel and weather bars overlap — total = the slowest of the three",
          "A 4-second `tool.flight_search` bar while others finish in 1s = your bottleneck",
          "Red bars = error status; stacked attempts = retries",
          "LLM spans carry tokens and cost — sort by cost to find expensive agents",
        ],
      },
      {
        heading: "Context propagation",
        body: "To build a tree, every child must know its parent's span ID. Across HTTP calls this travels in the W3C `traceparent` header; across async code it travels in context (AsyncLocalStorage in Node). Our tracer passes `parentId` explicitly so you can see the mechanism.",
      },
    ],
    concepts: [
      { term: "Span", emoji: "📏", def: "A named, timed operation with attributes, status and a parent span." },
      { term: "Waterfall", emoji: "🌊", def: "A timeline view of spans, indented by depth, showing overlap and duration." },
      { term: "Critical path", emoji: "🛤️", def: "The longest sequential chain of spans that determines end-to-end latency." },
      { term: "traceparent", emoji: "🔗", def: "W3C header carrying trace and parent span IDs between services." },
    ],
    flow: {
      title: "Span tree of one run",
      nodes: [
        { id: "r", label: "travel_crew.run", emoji: "🧵", color: "#64748b" },
        { id: "p", label: "agent.planner", emoji: "🧭", color: "#a855f7" },
        { id: "pl", label: "llm.chat", emoji: "🧠", color: "#c084fc" },
        { id: "h", label: "agent.hotels", emoji: "🏨", color: "#f97316" },
        { id: "h1", label: "tool.hotel_search #1 ❌", emoji: "💥", color: "#ef4444" },
        { id: "h2", label: "tool.hotel_search #2 ✅", emoji: "🔧", color: "#fb923c" },
        { id: "j", label: "agent.judge", emoji: "🛡️", color: "#ef4444" },
        { id: "g", label: "guardrail.evaluate", emoji: "✅", color: "#22c55e" },
      ],
      edges: [
        { from: "r", to: "p" },
        { from: "p", to: "pl" },
        { from: "r", to: "h" },
        { from: "h", to: "h1" },
        { from: "h", to: "h2", label: "retry" },
        { from: "r", to: "j" },
        { from: "j", to: "g" },
      ],
    },
    lab: {
      fault: "slow_tool",
      layer: "traces",
      steps: [
        "Run 🐢 Slow tool with observability ON and open the 🧵 Traces waterfall.",
        "Identify the critical path. Which span dominates?",
        "Now run 💥 Flaky API. Find the red error spans and the successful retry.",
        "Click any span to inspect its input, output, attributes and duration.",
      ],
    },
    quiz: [
      { q: "Flights (4s), hotels (1s) and weather (0.5s) run in parallel. How long does the fan-out take?", options: ["0.5s", "1s", "4s", "5.5s"], answer: 2, why: "Parallel branches finish when the slowest one does — 4s is the critical path." },
      { q: "What carries trace context between two microservices?", options: ["Cookies", "The traceparent header", "The prompt", "Environment variables"], answer: 1, why: "W3C Trace Context standardises the traceparent header." },
    ],
    agenda: [
      { min: 10, activity: "Lecture: spans, kinds, nesting" },
      { min: 10, activity: "Guided reading of a live waterfall" },
      { min: 8, activity: "Lab: find the bottleneck and the retries" },
      { min: 2, activity: "Quiz" },
    ],
  },
  {
    slug: "lab-black-vs-glass",
    day: 1,
    order: 5,
    title: "Lab 1 · Black Box vs Glass Box",
    subtitle: "Same run, two lenses — feel the difference",
    minutes: 25,
    emoji: "🔬",
    gradient: "from-emerald-500 to-lime-500",
    objectives: [
      "Experience debugging the same incident with and without telemetry",
      "Practise using traces, logs and agent messages together",
      "Write a one-paragraph root-cause analysis from telemetry",
    ],
    sections: [
      {
        heading: "Setup",
        body: "Open the Lab, choose **Compare** mode. Both panels watch the *same* LangGraph run — the left panel only receives what an un-instrumented app would give you: a start signal, a final answer, and maybe an error string.",
      },
      {
        heading: "Challenge rounds (pairs, 5 minutes each)",
        body: "One partner may only look at the left panel and must guess the cause. The other uses the right panel. Swap each round.",
        bullets: [
          "Round 1 — 🐢 Slow tool: which agent, and how slow?",
          "Round 2 — 💥 Flaky API: did the run fail? How many retries? What HTTP status?",
          "Round 3 — 👻 Hallucination: the answer looks fine… is it?",
        ],
      },
      {
        heading: "Debrief",
        body: "Compare time-to-root-cause between partners. Typical result: black box = guesswork after minutes, glass box = precise answer in under 30 seconds. That gap is the business case for observability.",
      },
    ],
    concepts: [
      { term: "MTTR", emoji: "⏱️", def: "Mean time to resolve — the metric observability most directly improves." },
      { term: "RCA", emoji: "🎯", def: "Root-cause analysis: the evidence-backed explanation of an incident." },
    ],
    flow: {
      title: "Lab 1 loop",
      nodes: [
        { id: "i", label: "Inject fault", emoji: "💉", color: "#ec4899" },
        { id: "bb", label: "Guess from black box", emoji: "🕳️", color: "#475569" },
        { id: "gb", label: "Diagnose from glass box", emoji: "🔭", color: "#0ea5e9" },
        { id: "rca", label: "Write RCA", emoji: "📝", color: "#22c55e" },
        { id: "cmp", label: "Compare MTTR", emoji: "⏱️", color: "#eab308" },
      ],
      edges: [
        { from: "i", to: "bb" },
        { from: "i", to: "gb" },
        { from: "bb", to: "rca" },
        { from: "gb", to: "rca" },
        { from: "rca", to: "cmp" },
      ],
    },
    lab: {
      fault: "hallucination",
      layer: "evals",
      steps: [
        "Compare mode → 👻 Hallucination. Read the final answer on the left: does anything look wrong?",
        "On the right, open ✅ Evals: which check failed on draft v1?",
        "Follow the loop judge → writer in the graph and the 💬 messages layer.",
        "Write a 3-sentence RCA: symptom, evidence (span/eval), fix.",
      ],
    },
    quiz: [
      { q: "In the hallucination round, what tells you the black-box answer was revised?", options: ["Nothing — you can't tell", "The spinner colour", "The error message", "The token count"], answer: 0, why: "Without telemetry, the rewrite loop is invisible — you only see the final text." },
    ],
    agenda: [
      { min: 3, activity: "Setup & pairing" },
      { min: 15, activity: "Three challenge rounds" },
      { min: 7, activity: "Debrief & Day 1 wrap-up" },
    ],
  },

  // ───────────────────────────── DAY 2 ─────────────────────────────
  {
    slug: "metrics-cost",
    day: 2,
    order: 6,
    title: "Metrics, Latency & Cost Engineering",
    subtitle: "Tokens, p95, TTFT, cost per run and SLOs",
    minutes: 25,
    emoji: "📊",
    gradient: "from-amber-400 to-orange-500",
    objectives: [
      "Choose the key metrics for agentic systems and define SLOs",
      "Compute cost per run from token usage",
      "Spot token bloat and the levers to reduce cost",
    ],
    sections: [
      {
        heading: "The golden signals for agents",
        body: "Adapt SRE's golden signals to LLM workflows:",
        bullets: [
          "⏱️ **Latency** — end-to-end p50/p95, per-agent latency, time-to-first-token (TTFT)",
          "🔁 **Traffic** — runs/min, LLM calls per run, tool calls per run",
          "💥 **Errors** — tool error rate, LLM failures, fallback rate, guard trips",
          "🎈 **Saturation & cost** — tokens per run, $ per run, rate-limit headroom",
          "✅ **Quality** — eval pass rate, judge score distribution",
        ],
      },
      {
        heading: "Cost = tokens × price",
        body: "`cost = input_tokens × price_in + output_tokens × price_out`. In multi-agent systems most tokens are **agent-to-agent** context, not user-visible text. A planner that pastes the whole conversation history into every call can multiply cost 5–10×.",
        bullets: [
          "Trim context: summarise history, retrieve only relevant docs",
          "Right-size models: small fast models for routing/extraction, large ones for writing",
          "Cache: prompt caching and semantic caching for repeated sub-queries",
          "Cap loops: every extra iteration is another round of tokens",
        ],
      },
      {
        heading: "SLOs and error budgets",
        body: "An **SLO** is a target like *\"95% of itineraries delivered in < 8s and pass all guardrails\"*. The **error budget** (the remaining 5%) tells you when to stop shipping features and fix reliability.",
      },
    ],
    concepts: [
      { term: "p95 latency", emoji: "📈", def: "95% of runs are faster than this value — better than averages for user experience." },
      { term: "TTFT", emoji: "⚡", def: "Time to first token — perceived responsiveness for streaming UIs." },
      { term: "Cost per run", emoji: "💵", def: "Sum of token cost across every LLM call in one workflow execution." },
      { term: "SLO", emoji: "🎯", def: "Service level objective — a measurable reliability target." },
    ],
    flow: {
      title: "From spans to cost dashboards",
      nodes: [
        { id: "s", label: "LLM span", emoji: "🧠", color: "#a855f7", desc: "tokens in/out" },
        { id: "p", label: "Price table", emoji: "🏷️", color: "#f97316" },
        { id: "c", label: "Cost per call", emoji: "💵", color: "#eab308" },
        { id: "r", label: "Cost per run", emoji: "🧾", color: "#f59e0b" },
        { id: "h", label: "Histogram p50/p95", emoji: "📊", color: "#0ea5e9" },
        { id: "slo", label: "SLO check", emoji: "🎯", color: "#22c55e" },
      ],
      edges: [
        { from: "s", to: "c" },
        { from: "p", to: "c" },
        { from: "c", to: "r", label: "sum" },
        { from: "r", to: "h", label: "aggregate" },
        { from: "h", to: "slo" },
      ],
    },
    lab: {
      fault: "token_bloat",
      layer: "metrics",
      steps: [
        "Run the Happy path 2–3 times to build a baseline in 📊 Metrics.",
        "Run 🎈 Token bloat. Compare tokens and cost per run in the run-history chart.",
        "Which agent caused it? Use the per-agent cost breakdown.",
        "Check 🚨 Alerts — which rule fired, and at what threshold?",
      ],
    },
    quiz: [
      { q: "Why prefer p95 over average latency?", options: ["It's cheaper to compute", "Averages hide slow tail experiences", "It's always lower", "Dashboards require it"], answer: 1, why: "A few very slow runs barely move the mean but ruin user experience." },
      { q: "Most effective first fix for token bloat in a planner?", options: ["Bigger model", "Trim/summarise context sent in the prompt", "Increase temperature", "Add more agents"], answer: 1, why: "Input tokens dominate cost when context is unfiltered." },
    ],
    agenda: [
      { min: 8, activity: "Lecture: golden signals & cost math" },
      { min: 5, activity: "Exercise: compute cost for 3,000 in / 400 out tokens" },
      { min: 10, activity: "Lab: baseline vs token-bloat runs" },
      { min: 2, activity: "Quiz" },
    ],
  },
  {
    slug: "state-workflow",
    day: 2,
    order: 7,
    title: "State, Checkpoints & Workflow Management",
    subtitle: "Retries, fallbacks, loop guards, time travel and HITL",
    minutes: 30,
    emoji: "🧠",
    gradient: "from-orange-500 to-rose-500",
    objectives: [
      "Use checkpoints to inspect, replay and fork a workflow (time travel)",
      "Apply reliability patterns: retry + backoff, timeout, fallback, circuit breaker, loop guards",
      "Know where human-in-the-loop interrupts belong",
    ],
    sections: [
      {
        heading: "State is the agents' shared memory",
        body: "Every super-step, LangGraph saves a **checkpoint**: full state + which nodes run next. Observing state diffs answers *\"what did each agent know when it decided?\"* — the most common question in agent debugging.",
      },
      {
        heading: "Time travel",
        body: "Because checkpoints are persisted per `thread_id`, you can **replay** from any past step, or **fork**: patch state (e.g. change the budget) and re-run only the downstream agents. Perfect for reproducing bugs and for what-if analysis — without re-paying for upstream LLM calls.",
      },
      {
        heading: "The workflow-management toolkit",
        body: "Agents call unreliable things. Wrap them in policies — and *observe the policies firing*:",
        bullets: [
          "🔁 **Retry with exponential backoff** — Hotel Finder: 300ms → 600ms → success",
          "⏳ **Timeouts** — fail fast instead of hanging the whole graph",
          "🪂 **Fallbacks** — Groq error → simulator / smaller model / cached answer",
          "🚧 **Loop guards** — max 3 budget iterations, max 2 rewrites, `recursionLimit: 40`",
          "🔌 **Circuit breaker** — stop calling a provider that keeps failing",
          "🙋 **Human-in-the-loop** — `interrupt()` before booking or spending money",
        ],
      },
    ],
    concepts: [
      { term: "Checkpoint", emoji: "💾", def: "A persisted snapshot of graph state and next nodes after a super-step." },
      { term: "Fork", emoji: "🍴", def: "Resume from an old checkpoint with modified state, creating a new branch of history." },
      { term: "Exponential backoff", emoji: "📶", def: "Wait 1×, 2×, 4×… between retries to let a struggling service recover." },
      { term: "Loop guard", emoji: "🚧", def: "A hard cap on iterations so agents can't loop forever (and burn tokens)." },
    ],
    flow: {
      title: "Retry, fallback & guard policies",
      nodes: [
        { id: "c", label: "Agent calls tool", emoji: "🏨", color: "#f97316" },
        { id: "e", label: "HTTP 503", emoji: "💥", color: "#ef4444" },
        { id: "b", label: "Backoff 300→600ms", emoji: "📶", color: "#eab308" },
        { id: "ok", label: "Success", emoji: "✅", color: "#22c55e" },
        { id: "fb", label: "Fallback", emoji: "🪂", color: "#0ea5e9", desc: "after max retries" },
        { id: "g", label: "Loop guard", emoji: "🚧", color: "#ec4899", desc: "max N iterations" },
        { id: "ck", label: "Checkpoint saved", emoji: "💾", color: "#a855f7" },
      ],
      edges: [
        { from: "c", to: "e" },
        { from: "e", to: "b", label: "retry" },
        { from: "b", to: "c" },
        { from: "c", to: "ok" },
        { from: "e", to: "fb", label: "exhausted" },
        { from: "ok", to: "ck" },
        { from: "ck", to: "g" },
      ],
    },
    code: {
      title: "Retry with exponential backoff — every attempt is its own span",
      lang: "ts",
      code: `for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    options = await tracer.span({ name: \`tool.hotel_search (attempt \${attempt})\`, kind: "tool" },
      () => searchHotels(intent));
    break;
  } catch (err) {
    if (attempt === 3) throw err;
    const backoff = 300 * 2 ** (attempt - 1);
    tracer.emit({ type: "workflow", action: "retry", detail: \`HTTP 503 → retry after \${backoff}ms\` });
    await sleep(backoff);
  }
}

// Time travel: fork from a checkpoint with a patched budget
const cfg = await graph.updateState({ configurable: { thread_id, checkpoint_id } }, { intent: { ...intent, budget: 1500 } });
for await (const chunk of await graph.stream(null, cfg)) { /* only downstream agents re-run */ }`,
    },
    lab: {
      fault: "budget_loop",
      layer: "state",
      steps: [
        "Run 💥 Flaky API and open 🔁 Workflow: count the retries and backoff delays.",
        "Run 🔁 Budget loop. Watch Budget ↔ Deal Hunter cycle until the guard trips.",
        "Open 🧠 State: step through the checkpoints and watch `dealAttempts` climb.",
        "Pick the checkpoint after the Trip Planner, set a new budget and **Fork** — only downstream agents re-run.",
      ],
    },
    quiz: [
      { q: "What does forking from a checkpoint save you?", options: ["Disk space", "Re-running (and paying for) upstream steps", "The need for a checkpointer", "Network latency"], answer: 1, why: "Only nodes after the checkpoint execute; upstream results are reused." },
      { q: "Where should a human approval interrupt go in a booking agent?", options: ["Before the planner", "Right before an irreversible action like payment", "After the response is sent", "Nowhere"], answer: 1, why: "Gate irreversible, high-impact actions." },
    ],
    agenda: [
      { min: 8, activity: "Lecture: state, checkpoints, time travel" },
      { min: 8, activity: "Reliability patterns toolkit" },
      { min: 12, activity: "Lab: retries, loop guard, fork a checkpoint" },
      { min: 2, activity: "Quiz" },
    ],
  },
  {
    slug: "evals-guardrails",
    day: 2,
    order: 8,
    title: "Evaluations & Guardrails",
    subtitle: "Groundedness, LLM-as-judge, PII and quality gates",
    minutes: 25,
    emoji: "🛡️",
    gradient: "from-rose-500 to-pink-600",
    objectives: [
      "Distinguish offline evals, online evals and runtime guardrails",
      "Combine deterministic checks with LLM-as-judge scoring",
      "Design a quality gate that loops back for self-correction",
    ],
    sections: [
      {
        heading: "Three places to evaluate",
        body: "Quality isn't one check — it's a pipeline.",
        bullets: [
          "🧪 **Offline evals** — run a dataset of test requests before every release (regression testing for prompts)",
          "📡 **Online evals** — score a sample of production traces asynchronously; trend quality over time",
          "🛡️ **Runtime guardrails** — synchronous checks that can *block* or *reroute* a response before the user sees it",
        ],
      },
      {
        heading: "The Quality Judge in our crew",
        body: "Our Judge runs four evaluators and emits each as an `eval` event attached to the trace:",
        bullets: [
          "**groundedness** — every hotel named must appear in tool results (deterministic, catches hallucination)",
          "**pii_leak** — regex for emails, phone and card numbers",
          "**budget_compliance** — soft check; reported but doesn't trigger a rewrite",
          "**llm_judge_helpfulness** — a second LLM scores 0–10 with a reason",
        ],
      },
      {
        heading: "Evaluator–optimizer loop",
        body: "If a hard check fails, the judge sends feedback to the writer (`judge → writer`), capped at 2 attempts. If it still fails, ship with a warning and fire a critical alert. Every rejection is visible in traces — so you can measure *how often* self-correction is needed.",
      },
    ],
    concepts: [
      { term: "Groundedness", emoji: "⚓", def: "Whether claims in the output are supported by retrieved / tool data." },
      { term: "LLM-as-judge", emoji: "⚖️", def: "Using a model with a rubric to score another model's output." },
      { term: "Guardrail", emoji: "🛡️", def: "A runtime check that can block, modify or reroute output." },
      { term: "Golden dataset", emoji: "🏅", def: "Curated inputs + expected properties used for offline regression evals." },
    ],
    flow: {
      title: "Quality gate",
      nodes: [
        { id: "w", label: "Writer draft", emoji: "📝", color: "#22c55e" },
        { id: "g", label: "Groundedness", emoji: "⚓", color: "#0ea5e9" },
        { id: "p", label: "PII scan", emoji: "🔒", color: "#a855f7" },
        { id: "l", label: "LLM judge", emoji: "⚖️", color: "#eab308" },
        { id: "d", label: "Decision", emoji: "🛡️", color: "#ef4444" },
        { id: "u", label: "Deliver to user", emoji: "🎉", color: "#14b8a6" },
      ],
      edges: [
        { from: "w", to: "g" },
        { from: "w", to: "p" },
        { from: "w", to: "l" },
        { from: "g", to: "d" },
        { from: "p", to: "d" },
        { from: "l", to: "d" },
        { from: "d", to: "w", label: "fail → feedback" },
        { from: "d", to: "u", label: "pass" },
      ],
    },
    lab: {
      fault: "hallucination",
      layer: "evals",
      steps: [
        "Run 👻 Hallucination. In ✅ Evals, compare draft v1 and v2 scores.",
        "Read the judge's feedback message in 💬 Agent Messages.",
        "Discuss: which of these four checks would you run offline, online, or at runtime?",
      ],
    },
    quiz: [
      { q: "Which check catches the invented hotel most reliably?", options: ["LLM judge helpfulness", "Deterministic groundedness vs tool results", "PII regex", "Budget compliance"], answer: 1, why: "Comparing names against tool outputs is cheap, deterministic and exact." },
      { q: "Online evals typically run…", options: ["Before release on a dataset", "Asynchronously on sampled production traces", "Inside the user's browser", "Only when an alert fires"], answer: 1, why: "They monitor real traffic quality without adding latency." },
    ],
    agenda: [
      { min: 8, activity: "Lecture: offline vs online vs runtime" },
      { min: 7, activity: "Design an LLM-judge rubric in groups" },
      { min: 8, activity: "Lab: watch the gate reject and repair" },
      { min: 2, activity: "Quiz" },
    ],
  },
  {
    slug: "alerts-tooling",
    day: 2,
    order: 9,
    title: "Alerting, Dashboards & the Tool Landscape",
    subtitle: "From signals to action — and what to buy vs build",
    minutes: 25,
    emoji: "🚨",
    gradient: "from-pink-500 to-violet-600",
    objectives: [
      "Write actionable alert rules with sensible thresholds",
      "Design a dashboard for an agent platform",
      "Compare LangSmith, Langfuse, Arize Phoenix, Helicone, Datadog and OpenTelemetry",
    ],
    sections: [
      {
        heading: "Alerts that people don't mute",
        body: "Every alert should be **actionable**, have an **owner**, and link to a **trace**. Our crew ships with five rules:",
        bullets: [
          "`tool_latency_slo` — any tool span > 3s (warning)",
          "`prompt_token_budget` — any prompt > 1,500 tokens (critical)",
          "`run_cost_budget` — run cost above budget (critical)",
          "`loop_guard_tripped` — a max-iterations guard fired (warning)",
          "`quality_gate_failed` — judge failed after all rewrites (critical)",
        ],
      },
      {
        heading: "The agent-platform dashboard",
        body: "Top row: runs/min, success rate, p95 latency, cost/hour. Second row: per-agent latency & cost, tool error rates. Third row: eval pass rate & judge score trend. Bottom: recent alerts with deep links to traces.",
      },
      {
        heading: "Tool landscape (2026)",
        body: "Most teams combine an LLM-native tracer with their existing APM:",
        bullets: [
          "🦜 **LangSmith** — first-party LangChain/LangGraph tracing, datasets, evals, prompt hub",
          "🪢 **Langfuse** — open-source tracing, evals, prompt management; self-hostable",
          "🔥 **Arize Phoenix** — open-source, OpenTelemetry-native (OpenInference) tracing & evals",
          "🌀 **Helicone** — proxy-based logging, caching and cost tracking",
          "🐶 **Datadog / New Relic / Grafana** — APM with LLM observability modules",
          "🔭 **OpenTelemetry GenAI** — the vendor-neutral standard underneath it all",
        ],
      },
    ],
    concepts: [
      { term: "Actionable alert", emoji: "🎯", def: "An alert with a clear owner, threshold and runbook — linked to evidence." },
      { term: "Runbook", emoji: "📕", def: "Step-by-step response guide for a specific alert." },
      { term: "Alert fatigue", emoji: "😵", def: "When noisy alerts train people to ignore them." },
      { term: "Vendor-neutral", emoji: "🔌", def: "Instrument once with OTel, export to any backend." },
    ],
    flow: {
      title: "Signal → action",
      nodes: [
        { id: "m", label: "Metric / eval / span", emoji: "📡", color: "#0ea5e9" },
        { id: "r", label: "Alert rule", emoji: "📏", color: "#eab308" },
        { id: "a", label: "Alert fires", emoji: "🚨", color: "#ef4444" },
        { id: "o", label: "On-call owner", emoji: "🧑‍🚒", color: "#a855f7" },
        { id: "t", label: "Linked trace", emoji: "🧵", color: "#14b8a6" },
        { id: "f", label: "Fix + postmortem", emoji: "🛠️", color: "#22c55e" },
      ],
      edges: [
        { from: "m", to: "r" },
        { from: "r", to: "a", label: "threshold" },
        { from: "a", to: "o", label: "page" },
        { from: "a", to: "t", label: "deep link" },
        { from: "o", to: "f" },
        { from: "t", to: "f" },
      ],
    },
    lab: {
      fault: "slow_tool",
      layer: "alerts",
      steps: [
        "Run 🐢 Slow tool, 🎈 Token bloat and 🔁 Budget loop.",
        "In 🚨 Alerts, click each alert to jump to the agent that caused it.",
        "Group exercise: write a 3-step runbook for `prompt_token_budget`.",
      ],
    },
    quiz: [
      { q: "Which makes an alert actionable?", options: ["A bright colour", "Owner + threshold + link to evidence + runbook", "Firing very often", "Being sent to everyone"], answer: 1, why: "Actionability is about knowing who does what, with evidence at hand." },
    ],
    agenda: [
      { min: 8, activity: "Lecture: alert design & dashboards" },
      { min: 7, activity: "Tool landscape tour & build-vs-buy" },
      { min: 8, activity: "Lab: alerts → traces; write a runbook" },
      { min: 2, activity: "Quiz" },
    ],
  },
  {
    slug: "capstone-incidents",
    day: 2,
    order: 10,
    title: "Capstone · Incident War-Room",
    subtitle: "Diagnose five incidents with every layer — then ship a readiness checklist",
    minutes: 35,
    emoji: "🏆",
    gradient: "from-violet-600 to-fuchsia-500",
    objectives: [
      "Diagnose unknown incidents using all observability layers together",
      "Choose the right workflow-management fix for each failure family",
      "Produce a production-readiness checklist for an agent system",
    ],
    sections: [
      {
        heading: "War-room rules",
        body: "Teams of 3: **Incident Commander**, **Investigator**, **Scribe**. The facilitator injects a mystery fault (don't peek!). Teams have 4 minutes per incident to report: *symptom → layer used → evidence → root cause → fix*.",
      },
      {
        heading: "Scoring",
        body: "+3 correct root cause · +2 correct agent · +2 best fix (retry/guard/eval/trim) · +1 fastest team. Bonus +3: use time-travel fork to prove your fix.",
      },
      {
        heading: "Production-readiness checklist",
        body: "Before an agent ships, it should have:",
        bullets: [
          "✅ Every node, LLM call and tool call traced with GenAI attributes",
          "✅ Token, cost and latency metrics per agent with SLOs",
          "✅ Retries + backoff + timeouts on every external tool",
          "✅ Loop guards and a recursion limit",
          "✅ Runtime guardrails + offline eval dataset + online eval sampling",
          "✅ Actionable alerts with runbooks and trace deep-links",
          "✅ Checkpointing for replay and human-in-the-loop before irreversible actions",
          "✅ PII redaction before telemetry storage",
        ],
      },
    ],
    concepts: [
      { term: "Incident Commander", emoji: "🧑‍✈️", def: "Coordinates the response and decides when it's resolved." },
      { term: "Postmortem", emoji: "📜", def: "Blameless write-up: timeline, root cause, action items." },
    ],
    flow: {
      title: "Incident response loop",
      nodes: [
        { id: "d", label: "Detect (alert)", emoji: "🚨", color: "#ef4444" },
        { id: "t", label: "Triage (metrics)", emoji: "📊", color: "#eab308" },
        { id: "i", label: "Investigate (traces/logs)", emoji: "🧵", color: "#0ea5e9" },
        { id: "r", label: "Reproduce (fork)", emoji: "🍴", color: "#a855f7" },
        { id: "f", label: "Fix (policy/prompt)", emoji: "🛠️", color: "#22c55e" },
        { id: "v", label: "Verify (evals)", emoji: "✅", color: "#14b8a6" },
      ],
      edges: [
        { from: "d", to: "t" },
        { from: "t", to: "i" },
        { from: "i", to: "r" },
        { from: "r", to: "f" },
        { from: "f", to: "v" },
        { from: "v", to: "d", label: "monitor" },
      ],
    },
    lab: {
      fault: "tool_error",
      layer: "workflow",
      steps: [
        "Facilitator picks a scenario at random; teams use any layer.",
        "Report the five-part RCA for each incident.",
        "Finish by filling in the readiness checklist for your own project.",
      ],
    },
    quiz: [
      { q: "Best fix for the 🔁 Budget loop incident?", options: ["Remove the loop guard", "Bigger LLM", "Smarter Deal Hunter + keep the guard + ask the user to raise budget (HITL)", "Increase recursionLimit"], answer: 2, why: "The guard prevents runaway cost; a better strategy and a human decision resolve the actual problem." },
      { q: "Which layer first tells you an incident is happening?", options: ["State", "Alerts", "Agent messages", "Code"], answer: 1, why: "Detection comes from alerts; investigation uses traces, logs and state." },
    ],
    agenda: [
      { min: 3, activity: "Form teams, assign roles" },
      { min: 20, activity: "Five incident rounds (4 min each)" },
      { min: 7, activity: "Readiness checklist on your own project" },
      { min: 5, activity: "Course wrap-up, feedback, next steps" },
    ],
  },
];

export const moduleBySlug = (slug: string) => MODULES.find((m) => m.slug === slug);
