import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import type { AgentId, FaultId, ObsEvent } from "@/lib/types";
import { callLLM, parseJson, type LlmCtx } from "./llm";
import { destInfo, getForecast, searchFlights, searchHotels, sleep, ToolError, type Flight, type Hotel, type Intent, type Weather } from "./tools";
import { Tracer, type SpanHandle } from "./tracer";

interface AgentMsg { from: string; to: string; summary: string }
interface BudgetCheck { total: number; budget: number; ok: boolean; breakdown: Record<string, number> }
interface JudgeResult { pass: boolean; score: number; issues: string[] }

// ---------- LangGraph state schema ----------
const TravelState = Annotation.Root({
  request: Annotation<string>,
  intent: Annotation<Intent | undefined>,
  flight: Annotation<Flight | undefined>,
  hotelOptions: Annotation<Hotel[] | undefined>,
  hotel: Annotation<Hotel | undefined>,
  forecast: Annotation<Weather | undefined>,
  budgetCheck: Annotation<BudgetCheck | undefined>,
  dealAttempts: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),
  draft: Annotation<string | undefined>,
  writerAttempts: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),
  verdict: Annotation<JudgeResult | undefined>,
  // Agent-to-agent messages are appended by parallel nodes → needs a reducer
  messages: Annotation<AgentMsg[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
});
type S = typeof TravelState.State;
type U = typeof TravelState.Update;

const MAX_DEAL_ATTEMPTS = 3;
const MAX_WRITER_ATTEMPTS = 2;
const HOTEL_MAX_RETRIES = 3;

// Shared checkpointer survives across requests (and Next.js hot reloads) → enables time-travel / forking
const g = globalThis as unknown as { __obsCheckpointer?: MemorySaver };
export const checkpointer = (g.__obsCheckpointer ??= new MemorySaver());

export interface RunOptions {
  request: string;
  fault: FaultId;
  apiKey?: string;
  model: string;
  speed: number;
  emit: (e: ObsEvent) => void;
  fork?: { threadId: string; checkpointId: string; budget?: number };
}

const nightsOf = (i: Intent) => Math.max(1, i.days - 1);
const roomsOf = (i: Intent) => Math.max(1, Math.ceil(i.travelers / 2));

function computeBudget(intent: Intent, flight: Flight, hotel: Hotel): BudgetCheck {
  const flights = flight.pricePerPerson * intent.travelers;
  const lodging = hotel.pricePerNight * nightsOf(intent) * roomsOf(intent);
  const daily = 70 * intent.days * intent.travelers;
  const total = flights + lodging + daily;
  return { total, budget: intent.budget, ok: total <= intent.budget, breakdown: { flights, lodging, food_and_activities: daily } };
}

// ---------- Simulated planner (used when no Groq key) ----------
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const INTERESTS = ["food", "temples", "museums", "beaches", "hiking", "nightlife", "shopping", "art", "history", "nature", "surfing", "culture"];

function heuristicIntent(req: string): Intent {
  const cap = (s?: string) => s?.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  const lower = req.toLowerCase();
  const dest = req.match(/\bto\s+([A-Za-z]+(?:\s[A-Z][a-z]+)?)/)?.[1];
  const origin = req.match(/\bfrom\s+([A-Za-z]+(?:\s[A-Z][a-z]+)?)/)?.[1];
  const days = Number(lower.match(/(\d+)\s*-?\s*(day|night)/)?.[1] ?? 4);
  const travelers = /couple/.test(lower) ? 2 : Number(lower.match(/(\d+)\s*(people|persons|travell?ers|adults|of us|pax)/)?.[1] ?? 2);
  const budget = Number((req.match(/\$\s?([\d,]+)/)?.[1] ?? lower.match(/budget\D{0,10}([\d,]+)/)?.[1] ?? "3000").replace(/,/g, ""));
  const month = cap(MONTHS.find((m) => lower.includes(m))) ?? "May";
  const interests = INTERESTS.filter((k) => lower.includes(k));
  return { origin: cap(origin) ?? "Chennai", destination: cap(dest) ?? "Tokyo", days, travelers, budget, month, interests: interests.length ? interests : ["culture", "food"] };
}

function normalizeIntent(raw: Partial<Intent>, req: string): Intent {
  const h = heuristicIntent(req);
  const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return {
    origin: raw.origin || h.origin,
    destination: raw.destination || h.destination,
    days: Math.min(14, num(raw.days, h.days)),
    travelers: Math.min(8, num(raw.travelers, h.travelers)),
    budget: num(raw.budget, h.budget),
    month: raw.month || h.month,
    interests: Array.isArray(raw.interests) && raw.interests.length ? raw.interests.slice(0, 5) : h.interests,
  };
}

function simulatedItinerary(s: S, feedback?: string, fake?: string): string {
  const i = s.intent!;
  const info = destInfo(i.destination);
  const hotelName = fake ?? s.hotel!.name;
  const lines = [
    `## ${i.days}-day ${i.destination} escape for ${i.travelers}`,
    `**Fly:** ${s.flight!.airline} ${s.flight!.flightNo} from ${i.origin}, departing ${s.flight!.depart} (${s.flight!.stops} stop${s.flight!.stops === 1 ? "" : "s"}) · $${s.flight!.pricePerPerson}/person`,
    `**Stay:** ${hotelName} in ${s.hotel!.area} · ${s.hotel!.stars}★ · $${s.hotel!.pricePerNight}/night`,
    `**Weather:** ${s.forecast!.summary}, ${s.forecast!.lowC}–${s.forecast!.highC}°C, ${s.forecast!.rainChance}% rain → ${s.forecast!.rainChance > 40 ? "pack an umbrella" : "light layers are enough"}`,
    "",
  ];
  for (let d = 1; d <= Math.min(i.days, 7); d++) {
    const sight = info.sights[(d - 1) % info.sights.length];
    const food = info.foods[(d - 1) % info.foods.length];
    lines.push(`- **Day ${d}:** ${d === 1 ? "Arrive, check in, slow evening walk. " : ""}Morning at ${sight}; dinner: ${food}.`);
  }
  lines.push("", `**Estimated total:** $${s.budgetCheck!.total.toLocaleString()} of $${i.budget.toLocaleString()} budget.`);
  if (feedback) lines.push(`_Revised after judge feedback: ${feedback}_`);
  return lines.join("\n");
}

const FAKE_HOTEL = "The Grand Imperial Sakura Palace";

// ---------- Run (or fork) the graph with full instrumentation ----------
export async function runTravelCrew(opts: RunOptions) {
  const tracer = new Tracer(opts.emit);
  const llmCtx: LlmCtx = { tracer, apiKey: opts.apiKey, model: opts.model, speed: opts.speed };
  const f = opts.fault;
  const threadId = opts.fork?.threadId ?? `thread_${tracer.runId}`;

  const say = (from: AgentId | "user", to: AgentId | "user", summary: string): AgentMsg => {
    tracer.emit({ type: "message", ts: Date.now(), from, to, summary });
    return { from, to, summary };
  };

  // Every graph node becomes an "agent" span that parents its LLM / tool spans.
  const agentNode =
    (id: AgentId, fn: (st: S, span: SpanHandle) => Promise<U>) =>
    async (st: S): Promise<U> =>
      tracer.span({ name: `agent.${id}`, kind: "agent", node: id, parentId: tracer.rootSpanId, input: nodeInput(id, st) }, async (span) => {
        tracer.totals.steps++;
        span.log("info", `▶ ${id} started`);
        const update = await fn(st, span);
        span.setOutput(preview(update));
        return update;
      });

  // ---- Nodes ----
  const planner = agentNode("planner", async (st, span) => {
    const bloat = f === "token_bloat" ? "\n\n### Full conversation history & policy docs (unfiltered)\n" + "Previous travel preference record: window seat, vegetarian options, loyalty programs, refund policies, visa rules... ".repeat(110) : "";
    if (bloat) span.log("warn", `Prompt includes ${bloat.length.toLocaleString()} chars of unfiltered context`);
    const text = await callLLM(llmCtx, {
      node: "planner",
      parentId: span.id,
      json: true,
      temperature: 0,
      system: "You are the Trip Planner supervisor in a multi-agent travel crew. Extract the traveler's intent as strict JSON with keys: origin (city), destination (city), days (int), travelers (int), budget (total USD, int), month (string), interests (array of short strings). Use sensible defaults if missing.",
      user: `Request: ${st.request}${bloat}`,
      simulate: () => JSON.stringify(heuristicIntent(st.request)),
    });
    const intent = normalizeIntent(parseJson<Partial<Intent>>(text, {}), st.request);
    span.log("info", `Intent: ${intent.origin} → ${intent.destination}, ${intent.days}d, ${intent.travelers} pax, $${intent.budget}`);
    return {
      intent,
      messages: [
        say("planner", "flights", `Find flights ${intent.origin} → ${intent.destination} for ${intent.travelers}`),
        say("planner", "hotels", `Find ${nightsOf(intent)} nights in ${intent.destination}, ${roomsOf(intent)} room(s)`),
        say("planner", "weather", `Forecast for ${intent.destination} in ${intent.month}`),
      ],
    };
  });

  const flights = agentNode("flights", async (st, span) => {
    const options = await tracer.span({ name: "tool.flight_search", kind: "tool", node: "flights", parentId: span.id, input: { from: st.intent!.origin, to: st.intent!.destination, pax: st.intent!.travelers }, attrs: { "http.url": "https://api.skylark.example/v2/search" } }, async (t) => {
      const r = await searchFlights(st.intent!, { slow: f === "slow_tool", pricey: f === "budget_loop", speed: opts.speed });
      t.setAttr("results", r.length);
      return r;
    });
    const best = [...options].sort((a, b) => a.pricePerPerson + a.stops * 90 - (b.pricePerPerson + b.stops * 90))[0];
    span.log("info", `Picked ${best.airline} ${best.flightNo} at $${best.pricePerPerson}/pp (value score incl. stop penalty)`);
    return { flight: best, messages: [say("flights", "budget", `${best.airline} $${best.pricePerPerson}/pp`)] };
  });

  const hotels = agentNode("hotels", async (st, span) => {
    let options: Hotel[] | undefined;
    for (let attempt = 1; attempt <= HOTEL_MAX_RETRIES; attempt++) {
      try {
        options = await tracer.span({ name: `tool.hotel_search (attempt ${attempt})`, kind: "tool", node: "hotels", parentId: span.id, input: { city: st.intent!.destination, nights: nightsOf(st.intent!) }, attrs: { "http.url": "https://api.hotelhub.example/search", attempt } }, () =>
          searchHotels(st.intent!, { failThisCall: f === "tool_error" && attempt < 3, pricey: f === "budget_loop", speed: opts.speed }),
        );
        break;
      } catch (err) {
        if (!(err instanceof ToolError) || attempt === HOTEL_MAX_RETRIES) throw err;
        const backoff = 300 * 2 ** (attempt - 1);
        tracer.totals.retries++;
        tracer.emit({ type: "workflow", ts: Date.now(), node: "hotels", action: "retry", detail: `HTTP ${err.status} → retry #${attempt} after ${backoff}ms exponential backoff` });
        span.log("warn", `Attempt ${attempt} failed (HTTP ${err.status}); backing off ${backoff}ms`);
        await sleep(backoff * opts.speed);
      }
    }
    const nightlyCap = (st.intent!.budget * 0.45) / nightsOf(st.intent!) / roomsOf(st.intent!);
    const pick = options!.find((h) => h.pricePerNight <= nightlyCap) ?? options![0];
    span.log("info", `Picked ${pick.name} ($${pick.pricePerNight}/night, nightly cap $${Math.round(nightlyCap)})`);
    return { hotel: pick, hotelOptions: options, messages: [say("hotels", "budget", `${pick.name} $${pick.pricePerNight}/night`)] };
  });

  const weather = agentNode("weather", async (st, span) => {
    const w = await tracer.span({ name: "tool.weather_forecast", kind: "tool", node: "weather", parentId: span.id, input: { city: st.intent!.destination, month: st.intent!.month } }, () => getForecast(st.intent!, { speed: opts.speed }));
    return { forecast: w, messages: [say("weather", "budget", `${w.summary}, ${w.highC}°C`)] };
  });

  const budget = agentNode("budget", async (st, span) => {
    const check = computeBudget(st.intent!, st.flight!, st.hotel!);
    span.log(check.ok ? "info" : "warn", `Total $${check.total} vs budget $${check.budget} → ${check.ok ? "OK" : "OVER by $" + (check.total - check.budget)}`);
    const next = check.ok || st.dealAttempts >= MAX_DEAL_ATTEMPTS ? "writer" : "dealhunter";
    return { budgetCheck: check, messages: [say("budget", next, check.ok ? `Within budget ($${check.total})` : `Over budget by $${check.total - check.budget}`)] };
  });

  const dealhunter = agentNode("dealhunter", async (st, span) => {
    const attempt = st.dealAttempts + 1;
    tracer.emit({ type: "workflow", ts: Date.now(), node: "dealhunter", action: "loop", detail: `Budget loop iteration ${attempt}/${MAX_DEAL_ATTEMPTS}` });
    const maxPrice = Math.round(st.hotel!.pricePerNight * 0.7);
    const cheaper = await tracer.span({ name: "tool.hotel_search (cheaper)", kind: "tool", node: "dealhunter", parentId: span.id, input: { city: st.intent!.destination, maxPrice } }, () =>
      searchHotels(st.intent!, { failThisCall: false, pricey: f === "budget_loop", maxPrice: f === "budget_loop" ? 1 : maxPrice, speed: opts.speed }),
    );
    const pick = cheaper[0];
    span.log(pick ? "info" : "warn", pick ? `Found ${pick.name} at $${pick.pricePerNight}/night` : `No hotel under $${maxPrice}/night`);
    return { dealAttempts: attempt, hotel: pick ?? st.hotel, messages: [say("dealhunter", "budget", pick ? `Swap to ${pick.name}` : "No cheaper option found")] };
  });

  const writer = agentNode("writer", async (st, span) => {
    const attempt = st.writerAttempts + 1;
    const feedback = st.verdict && !st.verdict.pass ? st.verdict.issues.join("; ") : undefined;
    const injectFake = f === "hallucination" && attempt === 1;
    let text = await callLLM(llmCtx, {
      node: "writer",
      parentId: span.id,
      temperature: 0.7,
      system: "You are the Itinerary Writer. Write a concise, vivid markdown itinerary (max 180 words). You MUST mention the flight and the hotel by their exact names, use only facts from the provided data, and never invent hotels, prices or contact details.",
      user: JSON.stringify({ request: st.request, intent: st.intent, flight: st.flight, hotel: st.hotel, weather: st.forecast, budget: st.budgetCheck, sights: destInfo(st.intent!.destination).sights, judgeFeedback: feedback }),
      simulate: () => simulatedItinerary(st, feedback, injectFake ? FAKE_HOTEL : undefined),
    });
    if (injectFake && text.includes(st.hotel!.name)) text = text.split(st.hotel!.name).join(FAKE_HOTEL);
    else if (injectFake && !text.includes(FAKE_HOTEL)) text += `\n\nYou'll stay at **${FAKE_HOTEL}**, a hidden gem with free upgrades.`;
    if (injectFake) span.log("debug", "[fault-injection] hallucinated hotel inserted into draft");
    return { draft: text, writerAttempts: attempt, messages: [say("writer", "judge", `Draft v${attempt} (${text.length} chars)`)] };
  });

  const judge = agentNode("judge", async (st, span) => {
    const draft = st.draft ?? "";
    return tracer.span({ name: "guardrail.evaluate", kind: "guardrail", node: "judge", parentId: span.id, input: { draftChars: draft.length } }, async (g) => {
      const issues: string[] = [];
      const ev = (name: string, score: number, pass: boolean, reason: string) => tracer.emit({ type: "eval", ts: Date.now(), node: "judge", name, score, pass, reason });

      // 1. Groundedness — every hotel named must come from tool results
      // LLMs emit typographic unicode (non-breaking spaces, U+2011 hyphens) — normalise before matching
      const norm = (t: string) => t.normalize("NFKC").replace(/[\u00a0\u2007\u202f]/g, " ").replace(/[\u2010-\u2015]/g, "-").replace(/\s+/g, " ").toLowerCase();
      const known = [st.hotel!, ...(st.hotelOptions ?? [])].map((h) => h.name.toLowerCase());
      const grounded = norm(draft).includes(norm(st.hotel!.name)) && !norm(draft).includes(norm(FAKE_HOTEL));
      ev("groundedness", grounded ? 1 : 0, grounded, grounded ? `Hotel "${st.hotel!.name}" matches tool output` : `Draft names a hotel not in search results (known: ${known.slice(0, 3).join(", ")})`);
      if (!grounded) issues.push(`Use the real hotel "${st.hotel!.name}" — do not invent hotels`);

      // 2. PII / safety
      const pii = /[\w.]+@[\w.]+\.\w+|\+?\d[\d\s-]{9,}\d|\b(?:\d[ -]*?){13,16}\b/.test(draft);
      ev("pii_leak", pii ? 0 : 1, !pii, pii ? "Draft contains an email/phone/card-like pattern" : "No PII patterns detected");
      if (pii) issues.push("Remove personal contact details");

      // 3. Budget compliance (soft — rewriting can't fix prices)
      const b = st.budgetCheck!;
      ev("budget_compliance", b.ok ? 1 : Math.max(0, 1 - (b.total - b.budget) / b.budget), b.ok, b.ok ? `$${b.total} ≤ $${b.budget}` : `Over budget by $${b.total - b.budget} (guard tripped after ${st.dealAttempts} deal attempts)`);

      // 4. LLM-as-judge helpfulness score
      const verdict = await callLLM(llmCtx, {
        node: "judge",
        parentId: g.id,
        json: true,
        temperature: 0,
        system: 'You are a strict travel QA judge. Score the itinerary for helpfulness and specificity from 0 to 10. Reply JSON: {"score": number, "reason": string}',
        user: draft,
        simulate: () => JSON.stringify(grounded ? { score: 8.4 + Math.round(Math.random() * 10) / 10, reason: "Specific, day-by-day, uses real options and weather" } : { score: 4.1, reason: "Mentions a hotel that cannot be verified" }),
      });
      const v = parseJson<{ score?: number; reason?: string }>(verdict, {});
      const score = Math.max(0, Math.min(10, Number(v.score ?? 7)));
      ev("llm_judge_helpfulness", score / 10, score >= 6, v.reason ?? "n/a");
      if (score < 6) issues.push(v.reason ?? "Improve specificity");

      const pass = issues.length === 0;
      g.setAttr("eval.pass", pass);
      if (!pass && st.writerAttempts >= MAX_WRITER_ATTEMPTS) {
        tracer.emit({ type: "workflow", ts: Date.now(), node: "judge", action: "guard", detail: `Max rewrites (${MAX_WRITER_ATTEMPTS}) reached → shipping with warning` });
        tracer.alert("critical", "quality_gate_failed", `Judge failed after ${MAX_WRITER_ATTEMPTS} attempts: ${issues.join("; ")}`, "judge");
      } else if (!pass) {
        tracer.emit({ type: "workflow", ts: Date.now(), node: "judge", action: "loop", detail: `Quality gate failed → sending back to writer: ${issues[0]}` });
      }
      const to = pass || st.writerAttempts >= MAX_WRITER_ATTEMPTS ? "user" : "writer";
      return { verdict: { pass, score, issues }, messages: [say("judge", to, pass ? `Approved (${score.toFixed(1)}/10)` : `Rejected: ${issues[0]}`)] };
    });
  });

  // ---- Graph topology ----
  const graph = new StateGraph(TravelState)
    .addNode("planner", planner)
    .addNode("flights", flights)
    .addNode("hotels", hotels)
    .addNode("weather", weather)
    .addNode("budget", budget)
    .addNode("dealhunter", dealhunter)
    .addNode("writer", writer)
    .addNode("judge", judge)
    .addEdge(START, "planner")
    .addEdge("planner", "flights") // fan-out: three specialists run in parallel
    .addEdge("planner", "hotels")
    .addEdge("planner", "weather")
    .addEdge(["flights", "hotels", "weather"], "budget") // fan-in join: waits for all three
    .addConditionalEdges("budget", (st: S) => {
      if (st.budgetCheck!.ok) return "writer";
      if (st.dealAttempts >= MAX_DEAL_ATTEMPTS) {
        tracer.emit({ type: "workflow", ts: Date.now(), node: "budget", action: "guard", detail: `Max-iterations guard tripped (${MAX_DEAL_ATTEMPTS}) → proceeding over budget` });
        tracer.alert("warning", "loop_guard_tripped", `Budget loop hit ${MAX_DEAL_ATTEMPTS} iterations; itinerary is over budget`, "budget");
        return "writer";
      }
      return "dealhunter";
    }, ["writer", "dealhunter"])
    .addEdge("dealhunter", "budget")
    .addEdge("writer", "judge")
    .addConditionalEdges("judge", (st: S) => (st.verdict!.pass || st.writerAttempts >= MAX_WRITER_ATTEMPTS ? END : "writer"), ["writer", END])
    .compile({ checkpointer });

  tracer.emit({ type: "run_start", runId: tracer.runId, threadId, ts: tracer.startTs, input: opts.request, fault: f, llm: opts.apiKey ? "groq" : "simulated", model: opts.apiKey ? opts.model : "simulator" });

  try {
    const finalState = await tracer.span({ name: opts.fork ? "travel_crew.fork" : "travel_crew.run", kind: "run", input: { request: opts.request, fault: f, fork: opts.fork }, attrs: { "langgraph.thread_id": threadId } }, async (root) => {
      tracer.rootSpanId = root.id;
      let config: { configurable: Record<string, string>; recursionLimit?: number } = { configurable: { thread_id: threadId } };
      let input: U | null = { request: opts.request };

      if (opts.fork) {
        // Time travel: resume from a past checkpoint, optionally patching state first.
        config = { configurable: { thread_id: threadId, checkpoint_id: opts.fork.checkpointId } };
        input = null;
        if (opts.fork.budget) {
          const snap = await graph.getState(config);
          const intent = { ...(snap.values as S).intent!, budget: opts.fork.budget };
          config = (await graph.updateState(config, { intent })) as typeof config;
          root.log("info", `Forked checkpoint ${opts.fork.checkpointId.slice(0, 8)} with budget patched to $${opts.fork.budget}`);
        } else root.log("info", `Replaying from checkpoint ${opts.fork.checkpointId.slice(0, 8)}`);
      } else {
        say("user", "planner", opts.request.slice(0, 80));
      }

      let step = 0;
      const stream = await graph.stream(input, { ...config, recursionLimit: 40, streamMode: "updates" });
      for await (const chunk of stream) {
        for (const [node, update] of Object.entries(chunk as Record<string, U>)) {
          if (!(node in nodeLabels)) continue;
          tracer.emit({ type: "state", ts: Date.now(), node: node as AgentId, step: ++step, update: preview(update) as Record<string, unknown> });
        }
      }

      // Emit the LangGraph checkpoint history (chronological) for the time-travel layer
      const history = [];
      for await (const snap of graph.getStateHistory({ configurable: { thread_id: threadId } })) history.push(snap);
      for (const snap of history.reverse()) {
        tracer.emit({
          type: "checkpoint",
          ts: Date.now(),
          checkpointId: String(snap.config.configurable?.checkpoint_id ?? ""),
          step: Number(snap.metadata?.step ?? 0),
          next: [...snap.next],
          source: String(snap.metadata?.source ?? ""),
          values: compactState(snap.values as S),
        });
      }
      const fin = (await graph.getState({ configurable: { thread_id: threadId } })).values as S;
      root.setOutput({ judge: fin.verdict, total: fin.budgetCheck?.total });
      return fin;
    });

    tracer.emit({ type: "run_end", ts: Date.now(), status: "ok", output: finalState.draft, totals: tracer.finish() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    tracer.alert("critical", "run_failed", msg);
    tracer.emit({ type: "run_end", ts: Date.now(), status: "error", error: msg, totals: tracer.finish() });
  }
}

const nodeLabels = { planner: 1, flights: 1, hotels: 1, weather: 1, budget: 1, dealhunter: 1, writer: 1, judge: 1 };

function nodeInput(id: AgentId, st: S): unknown {
  switch (id) {
    case "planner": return { request: st.request };
    case "flights":
    case "hotels":
    case "weather": return { intent: st.intent };
    case "budget": return { flight: st.flight?.pricePerPerson, hotel: st.hotel?.name, nightly: st.hotel?.pricePerNight, dealAttempts: st.dealAttempts };
    case "dealhunter": return { currentHotel: st.hotel?.name, nightly: st.hotel?.pricePerNight };
    case "writer": return { hotel: st.hotel?.name, judgeFeedback: st.verdict?.issues };
    case "judge": return { draftPreview: st.draft?.slice(0, 160) };
  }
}

function preview(u: unknown): unknown {
  const s = JSON.stringify(u ?? {});
  if (s.length <= 1500) return u;
  const o = { ...(u as Record<string, unknown>) };
  for (const k of Object.keys(o)) if (typeof o[k] === "string" && (o[k] as string).length > 300) o[k] = (o[k] as string).slice(0, 300) + "…";
  return o;
}

function compactState(v: S): Record<string, unknown> {
  return {
    intent: v.intent,
    flight: v.flight ? `${v.flight.airline} $${v.flight.pricePerPerson}/pp` : undefined,
    hotel: v.hotel ? `${v.hotel.name} $${v.hotel.pricePerNight}/n` : undefined,
    forecast: v.forecast?.summary,
    budgetCheck: v.budgetCheck ? { total: v.budgetCheck.total, budget: v.budgetCheck.budget, ok: v.budgetCheck.ok } : undefined,
    dealAttempts: v.dealAttempts,
    writerAttempts: v.writerAttempts,
    verdict: v.verdict,
    draft: v.draft ? v.draft.slice(0, 220) + (v.draft.length > 220 ? "…" : "") : undefined,
    messages: v.messages?.length ?? 0,
  };
}
