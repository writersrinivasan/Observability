import { runTravelCrew } from "@/lib/agents/graph";
import { resolveGroq } from "@/lib/groq";
import type { FaultId, ObsEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FAULTS: FaultId[] = ["none", "slow_tool", "tool_error", "hallucination", "budget_loop", "token_bloat"];

// Streams every observability event from the LangGraph run as Server-Sent Events.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const request = String(body.request ?? "").slice(0, 600) || "Plan a 4 day trip from Chennai to Tokyo in April for 2 people, budget $3000, love food and temples";
  const fault: FaultId = FAULTS.includes(body.fault) ? body.fault : "none";
  const speed = Math.min(3, Math.max(0.2, Number(body.speed) || 1));
  const { apiKey, model } = resolveGroq(req);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const emit = (e: ObsEvent) => {
        if (open) controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      try {
        await runTravelCrew({ request, fault, apiKey, model, speed, emit, fork: body.fork });
      } finally {
        open = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
