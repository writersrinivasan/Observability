import type { AgentId, FaultId } from "@/lib/types";

export interface AgentMeta {
  id: AgentId;
  name: string;
  emoji: string;
  color: string; // primary hex
  role: string;
  kind: "llm" | "tool" | "logic" | "guardrail";
  pos: { x: number; y: number };
}

export const AGENTS: Record<AgentId, AgentMeta> = {
  planner: { id: "planner", name: "Trip Planner", emoji: "🧭", color: "#a855f7", role: "Supervisor: parses the request into a structured intent and dispatches specialists", kind: "llm", pos: { x: 0, y: 170 } },
  flights: { id: "flights", name: "Flight Scout", emoji: "✈️", color: "#0ea5e9", role: "Calls the flight-search tool and picks the best fare", kind: "tool", pos: { x: 245, y: 10 } },
  hotels: { id: "hotels", name: "Hotel Finder", emoji: "🏨", color: "#f97316", role: "Calls the hotel-search tool (flaky API!)", kind: "tool", pos: { x: 245, y: 170 } },
  weather: { id: "weather", name: "Weather Oracle", emoji: "🌦️", color: "#14b8a6", role: "Fetches the forecast for the travel dates", kind: "tool", pos: { x: 245, y: 330 } },
  budget: { id: "budget", name: "Budget Guardian", emoji: "💰", color: "#eab308", role: "Sums costs and routes: within budget → writer, over → deal hunter", kind: "logic", pos: { x: 490, y: 170 } },
  dealhunter: { id: "dealhunter", name: "Deal Hunter", emoji: "💸", color: "#ec4899", role: "Searches for a cheaper hotel and loops back to the budget check", kind: "tool", pos: { x: 490, y: 340 } },
  writer: { id: "writer", name: "Itinerary Writer", emoji: "📝", color: "#22c55e", role: "LLM that writes the final day-by-day itinerary", kind: "llm", pos: { x: 735, y: 170 } },
  judge: { id: "judge", name: "Quality Judge", emoji: "🛡️", color: "#ef4444", role: "LLM-as-judge guardrail: groundedness, PII, budget compliance", kind: "guardrail", pos: { x: 980, y: 170 } },
};

export const AGENT_ORDER: AgentId[] = ["planner", "flights", "hotels", "weather", "budget", "dealhunter", "writer", "judge"];

// Static topology mirrors the LangGraph definition in graph.ts
export const GRAPH_EDGES: { id: string; from: AgentId | "start" | "end"; to: AgentId | "start" | "end"; conditional?: boolean; label?: string }[] = [
  { id: "start-planner", from: "start", to: "planner" },
  { id: "planner-flights", from: "planner", to: "flights", label: "fan-out" },
  { id: "planner-hotels", from: "planner", to: "hotels" },
  { id: "planner-weather", from: "planner", to: "weather" },
  { id: "flights-budget", from: "flights", to: "budget", label: "join" },
  { id: "hotels-budget", from: "hotels", to: "budget" },
  { id: "weather-budget", from: "weather", to: "budget" },
  { id: "budget-dealhunter", from: "budget", to: "dealhunter", conditional: true, label: "over budget" },
  { id: "dealhunter-budget", from: "dealhunter", to: "budget", label: "re-check" },
  { id: "budget-writer", from: "budget", to: "writer", conditional: true, label: "ok" },
  { id: "writer-judge", from: "writer", to: "judge" },
  { id: "judge-writer", from: "judge", to: "writer", conditional: true, label: "fail → rewrite" },
  { id: "judge-end", from: "judge", to: "end", conditional: true, label: "pass" },
];

export const FAULTS: { id: FaultId; label: string; emoji: string; desc: string; layer: string }[] = [
  { id: "none", label: "Happy path", emoji: "🌈", desc: "Everything works. Learn the baseline shape of a healthy run.", layer: "traces" },
  { id: "slow_tool", label: "Slow tool", emoji: "🐢", desc: "The flight API takes ~4s. Black box: 'it feels slow'. Glass box: the waterfall points at one span.", layer: "traces" },
  { id: "tool_error", label: "Flaky API", emoji: "💥", desc: "Hotel API returns HTTP 503 twice. Workflow management retries with backoff.", layer: "workflow" },
  { id: "hallucination", label: "Hallucination", emoji: "👻", desc: "Writer invents a hotel not in the search results. The judge catches it and forces a rewrite.", layer: "evals" },
  { id: "budget_loop", label: "Budget loop", emoji: "🔁", desc: "Prices are too high; the graph loops until the max-iterations guard trips.", layer: "workflow" },
  { id: "token_bloat", label: "Token bloat", emoji: "🎈", desc: "Planner stuffs a giant context into its prompt. Cost spikes and an alert fires.", layer: "metrics" },
];
