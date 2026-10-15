"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { Background, BaseEdge, EdgeLabelRenderer, getBezierPath, Handle, Position, ReactFlow, type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import { AGENTS, AGENT_ORDER, GRAPH_EDGES, type AgentMeta } from "@/lib/agents/meta";
import type { AgentId } from "@/lib/types";
import type { NodeStat, NodeStatus, RunView } from "./useRun";

type AgentData = { meta: AgentMeta; status: NodeStatus; stat: NodeStat; selected: boolean; showStats: boolean };
type TermData = { label: string; emoji: string; color: string; active: boolean };
type PacketData = { color: string; pulse: number; traveled: boolean; conditional?: boolean; label?: string; active: boolean };

const hidden = { opacity: 0, width: 6, height: 6, border: 0 };
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`);

const AgentNode = memo(function AgentNode({ data }: NodeProps<Node<AgentData>>) {
  const { meta, status, stat, selected, showStats } = data;
  const running = status === "running";
  const glow = running ? `0 0 0 3px ${meta.color}, 0 0 38px ${meta.color}` : status === "done" ? `0 0 0 2px ${meta.color}aa, 0 0 18px ${meta.color}55` : status === "error" ? "0 0 0 3px #ef4444, 0 0 30px #ef4444" : `0 0 0 1px ${meta.color}44`;
  return (
    <div
      className={`relative w-[196px] cursor-pointer rounded-2xl px-3 py-2.5 transition-all duration-300 ${selected ? "scale-105" : ""}`}
      style={{ background: `linear-gradient(135deg, ${meta.color}${status === "idle" ? "22" : "40"}, #0b1020ee 70%)`, boxShadow: glow, outline: selected ? "2px dashed #fff" : "none", outlineOffset: 4 }}
    >
      {running && <span className="absolute -right-1.5 -top-1.5 h-4 w-4 animate-ping rounded-full" style={{ background: meta.color }} />}
      <Handle type="target" position={Position.Left} id="l" style={hidden} />
      <Handle type="source" position={Position.Right} id="r" style={hidden} />
      <Handle type="source" position={Position.Top} id="ts" style={{ ...hidden, left: "65%" }} />
      <Handle type="target" position={Position.Top} id="tt" style={{ ...hidden, left: "35%" }} />
      <Handle type="source" position={Position.Bottom} id="bs" style={{ ...hidden, left: "35%" }} />
      <Handle type="target" position={Position.Bottom} id="bt" style={{ ...hidden, left: "65%" }} />
      <div className="flex items-center gap-2.5">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl ${running ? "animate-floaty" : ""}`} style={{ background: `${meta.color}33` }}>
          {meta.emoji}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-white">{meta.name}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: meta.color }}>
            {meta.kind} · {status === "idle" ? "waiting" : status}
          </div>
        </div>
        {stat.visits > 1 && <div className="ml-auto rounded-full bg-white/15 px-1.5 text-[10px] font-bold text-white">×{stat.visits}</div>}
      </div>
      {showStats && stat.visits > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 font-mono text-[10px]">
          <span className="rounded bg-black/40 px-1.5 py-0.5 text-sky-200">⏱ {fmtMs(stat.ms)}</span>
          {stat.tokens > 0 && <span className="rounded bg-black/40 px-1.5 py-0.5 text-violet-200">🔤 {stat.tokens.toLocaleString()}</span>}
          {stat.cost > 0 && <span className="rounded bg-black/40 px-1.5 py-0.5 text-amber-200">${stat.cost.toFixed(5)}</span>}
          {stat.errors > 0 && <span className="rounded bg-red-500/40 px-1.5 py-0.5 text-red-100">✖ {stat.errors}</span>}
        </div>
      )}
    </div>
  );
});

const TermNode = memo(function TermNode({ data }: NodeProps<Node<TermData>>) {
  return (
    <div className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: `linear-gradient(90deg, ${data.color}, ${data.color}88)`, boxShadow: data.active ? `0 0 30px ${data.color}` : "none" }}>
      <Handle type="target" position={Position.Left} id="l" style={hidden} />
      <Handle type="source" position={Position.Right} id="r" style={hidden} />
      <span className="text-lg">{data.emoji}</span>
      {data.label}
    </div>
  );
});

function Packet({ path, color, pulse }: { path: string; color: string; pulse: number }) {
  const g = useRef<SVGGElement>(null);
  useEffect(() => {
    // SMIL animations inserted after page load must be started manually
    g.current?.querySelectorAll("animateMotion, animate").forEach((a) => (a as SVGAnimationElement).beginElement());
  }, [pulse]);
  return (
    <g ref={g} key={pulse}>
      <circle r="9" fill={color} opacity="0.35">
        <animateMotion dur="1s" begin="indefinite" fill="freeze" path={path} />
        <animate attributeName="opacity" values="0.35;0.35;0" keyTimes="0;0.85;1" dur="1s" begin="indefinite" fill="freeze" />
      </circle>
      <circle r="5" fill="#fff" stroke={color} strokeWidth="3">
        <animateMotion dur="1s" begin="indefinite" fill="freeze" path={path} />
        <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.85;1" dur="1s" begin="indefinite" fill="freeze" />
      </circle>
    </g>
  );
}

const PacketEdge = memo(function PacketEdge(p: EdgeProps<Edge<PacketData>>) {
  const loop = p.sourcePosition === Position.Top && p.targetPosition === Position.Top;
  const [path, lx, ly] = getBezierPath({ ...p, curvature: loop ? 0.9 : 0.35 });
  const d = p.data!;
  const stroke = d.traveled ? d.color : "#ffffff30";
  return (
    <>
      {d.traveled && <BaseEdge path={path} style={{ stroke: d.color, strokeWidth: 10, opacity: 0.12 }} />}
      <BaseEdge path={path} style={{ stroke, strokeWidth: d.traveled ? 2.5 : 1.5, strokeDasharray: d.conditional && !d.traveled ? "6 6" : d.active ? "8 6" : undefined, animation: d.active ? "dashdraw 0.6s linear infinite" : undefined }} />
      {d.pulse > 0 && <Packet path={path} color={d.color} pulse={d.pulse} />}
      {d.label && (
        <EdgeLabelRenderer>
          <div className="pointer-events-none absolute rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ transform: `translate(-50%,-50%) translate(${lx}px,${ly + (loop ? -8 : 0)}px)`, background: d.traveled ? d.color : "#1e293b", color: "#fff" }}>
            {d.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

const nodeTypes = { agent: AgentNode, term: TermNode };
const edgeTypes = { packet: PacketEdge };

const HANDLES: Record<string, [string, string]> = {
  "budget-dealhunter": ["bs", "tt"],
  "dealhunter-budget": ["ts", "bt"],
  "judge-writer": ["ts", "tt"],
};

export default function AgentGraph({ view, selected, onSelect, showStats = true, height = 460 }: { view: RunView; selected?: AgentId | null; onSelect?: (a: AgentId) => void; showStats?: boolean; height?: number }) {
  const nodes: Node[] = useMemo(() => {
    const ns: Node[] = AGENT_ORDER.map((id) => ({
      id,
      type: "agent",
      position: AGENTS[id].pos,
      draggable: false,
      data: { meta: AGENTS[id], status: view.nodeStatus[id], stat: view.nodeStats[id], selected: selected === id, showStats } satisfies AgentData,
    }));
    ns.push({ id: "start", type: "term", position: { x: -175, y: 185 }, draggable: false, data: { label: "Traveler", emoji: "🙋", color: "#7c3aed", active: view.status === "running" } satisfies TermData });
    ns.push({ id: "end", type: "term", position: { x: 1225, y: 185 }, draggable: false, data: { label: "Itinerary", emoji: "🎉", color: "#059669", active: view.status === "done" } satisfies TermData });
    return ns;
  }, [view.nodeStatus, view.nodeStats, view.status, selected, showStats]);

  const edges: Edge[] = useMemo(
    () =>
      GRAPH_EDGES.map((e) => {
        const [sh, th] = HANDLES[e.id] ?? ["r", "l"];
        const src = e.from === "start" ? "#7c3aed" : AGENTS[e.from as AgentId]?.color ?? "#fff";
        const targetRunning = e.to !== "end" && e.to !== "start" && view.nodeStatus[e.to as AgentId] === "running";
        return {
          id: e.id,
          source: e.from,
          target: e.to,
          sourceHandle: sh,
          targetHandle: th,
          type: "packet",
          data: { color: src, pulse: view.edgePulses[e.id] ?? 0, traveled: !!view.traveled[e.id], conditional: e.conditional, label: e.label, active: targetRunning && !!view.traveled[e.id] } satisfies PacketData,
        };
      }),
    [view.edgePulses, view.traveled, view.nodeStatus],
  );

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top,_#1e1b4b_0%,_#0b1020_60%)]" style={{ height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.06 }}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        zoomOnScroll={false}
        panOnScroll={false}
        preventScrolling={false}
        onNodeClick={(_, n) => AGENT_ORDER.includes(n.id as AgentId) && onSelect?.(n.id as AgentId)}
      >
        <Background color="#ffffff14" gap={22} size={1.5} />
      </ReactFlow>
    </div>
  );
}
