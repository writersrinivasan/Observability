"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { Background, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { Pause, Play } from "lucide-react";
import type { FlowSpec } from "@/lib/types";

const PALETTE = ["#a855f7", "#0ea5e9", "#f97316", "#22c55e", "#eab308", "#ec4899", "#14b8a6", "#ef4444", "#6366f1"];
const hidden = { opacity: 0, width: 6, height: 6, border: 0 };

type D = { label: string; emoji?: string; desc?: string; color: string; lit: boolean; visited: boolean; order: number };

const ConceptNode = memo(function ConceptNode({ data }: NodeProps<Node<D>>) {
  return (
    <div
      className="relative w-[172px] rounded-2xl px-3 py-2.5 transition-all duration-500"
      style={{
        background: `linear-gradient(135deg, ${data.color}${data.lit || data.visited ? "55" : "26"}, #0b1020f0 75%)`,
        boxShadow: data.lit ? `0 0 0 3px ${data.color}, 0 0 34px ${data.color}` : `0 0 0 1px ${data.color}77`,
        transform: data.lit ? "scale(1.07)" : "scale(1)",
      }}
    >
      <Handle type="target" position={Position.Left} id="l" style={hidden} />
      <Handle type="source" position={Position.Right} id="r" style={hidden} />
      <Handle type="source" position={Position.Bottom} id="bs" style={{ ...hidden, left: "35%" }} />
      <Handle type="target" position={Position.Bottom} id="bt" style={{ ...hidden, left: "65%" }} />
      <div className="flex items-center gap-2">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xl ${data.lit ? "animate-floaty" : ""}`} style={{ background: `${data.color}38` }}>
          {data.emoji ?? "•"}
        </span>
        <span className="text-[13px] font-bold leading-tight text-white">{data.label}</span>
      </div>
      {data.desc && <div className="mt-1 text-[10.5px] leading-snug text-white/65">{data.desc}</div>}
      <span className="absolute -left-2 -top-2 grid h-5 w-5 place-items-center rounded-full text-[10px] font-black text-white" style={{ background: data.color }}>
        {data.order}
      </span>
    </div>
  );
});
const nodeTypes = { concept: ConceptNode };

/** Layered left→right layout; back-edges (cycles) are detected and drawn underneath. */
function layout(spec: FlowSpec) {
  const ids = spec.nodes.map((n) => n.id);
  const out: Record<string, string[]> = Object.fromEntries(ids.map((i) => [i, []]));
  spec.edges.forEach((e) => out[e.from]?.push(e.to));
  const back = new Set<string>();
  const state: Record<string, 0 | 1 | 2> = {};
  const dfs = (u: string) => {
    state[u] = 1;
    for (const v of out[u] ?? []) {
      if (state[v] === 1) back.add(`${u}->${v}`);
      else if (!state[v]) dfs(v);
    }
    state[u] = 2;
  };
  const indeg: Record<string, number> = Object.fromEntries(ids.map((i) => [i, 0]));
  spec.edges.forEach((e) => indeg[e.to] !== undefined && indeg[e.to]++);
  ids.filter((i) => indeg[i] === 0).forEach((i) => !state[i] && dfs(i));
  ids.forEach((i) => !state[i] && dfs(i));

  const level: Record<string, number> = Object.fromEntries(ids.map((i) => [i, 0]));
  const fwd = spec.edges.filter((e) => !back.has(`${e.from}->${e.to}`));
  for (let k = 0; k < ids.length; k++) fwd.forEach((e) => level[e.to] !== undefined && (level[e.to] = Math.max(level[e.to], (level[e.from] ?? 0) + 1)));
  const byLevel: Record<number, string[]> = {};
  ids.forEach((i) => (byLevel[level[i]] ??= []).push(i));
  const pos: Record<string, { x: number; y: number }> = {};
  const maxRows = Math.max(...Object.values(byLevel).map((l) => l.length));
  Object.entries(byLevel).forEach(([lv, list]) => list.forEach((id, j) => (pos[id] = { x: Number(lv) * 225, y: (j - (list.length - 1) / 2) * 112 + (maxRows * 112) / 2 })));
  const order = [...ids].sort((a, b) => level[a] - level[b] || pos[a].y - pos[b].y);
  return { pos, back, order };
}

export default function FlowDiagram({ spec, height = 340, autoplay = true }: { spec: FlowSpec; height?: number; autoplay?: boolean }) {
  const { pos, back, order } = useMemo(() => layout(spec), [spec]);
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(autoplay);

  useEffect(() => {
    setStep(-1);
    setPlaying(autoplay);
  }, [spec, autoplay]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setStep((s) => (s + 1 >= order.length + 2 ? 0 : s + 1)), 1000);
    return () => clearInterval(t);
  }, [playing, order.length]);

  const litId = order[step];
  const visited = new Set(order.slice(0, Math.max(0, step)));
  const colorOf = (id: string) => spec.nodes.find((n) => n.id === id)?.color ?? PALETTE[spec.nodes.findIndex((n) => n.id === id) % PALETTE.length];

  const nodes: Node[] = spec.nodes.map((n, i) => ({
    id: n.id,
    type: "concept",
    position: pos[n.id],
    draggable: true,
    data: { label: n.label, emoji: n.emoji, desc: n.desc, color: n.color ?? PALETTE[i % PALETTE.length], lit: litId === n.id, visited: visited.has(n.id), order: order.indexOf(n.id) + 1 } satisfies D,
  }));
  const edges: Edge[] = spec.edges.map((e, i) => {
    const isBack = back.has(`${e.from}->${e.to}`);
    const active = litId === e.to && (visited.has(e.from) || isBack);
    const c = colorOf(e.from);
    return {
      id: `e${i}`,
      source: e.from,
      target: e.to,
      sourceHandle: isBack ? "bs" : "r",
      targetHandle: isBack ? "bt" : "l",
      type: "default",
      animated: true,
      label: e.label,
      labelStyle: { fill: "#fff", fontSize: 10, fontWeight: 700 },
      labelBgStyle: { fill: c },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 10,
      markerEnd: { type: MarkerType.ArrowClosed, color: c },
      style: { stroke: c, strokeWidth: active ? 4 : 2, opacity: active || visited.has(e.to) ? 1 : 0.55, filter: active ? `drop-shadow(0 0 6px ${c})` : undefined },
    };
  });

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top_left,_#2e1065_0%,_#0b1020_55%)]" style={{ height }}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.18 }} proOptions={{ hideAttribution: true }} nodesConnectable={false} zoomOnScroll={false} preventScrolling={false}>
        <Background color="#ffffff12" gap={20} size={1.4} />
      </ReactFlow>
      <div className="absolute left-3 top-3 flex items-center gap-2">
        {spec.title && <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-bold text-white backdrop-blur">{spec.title}</span>}
      </div>
      <button onClick={() => setPlaying((p) => !p)} className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-900 hover:bg-white">
        {playing ? <Pause size={12} /> : <Play size={12} />} {playing ? "Pause" : "Walk through"}
      </button>
      {litId && (
        <div className="absolute bottom-3 left-3 right-3 rounded-2xl bg-black/60 px-3 py-2 text-xs text-white backdrop-blur">
          <b>Step {order.indexOf(litId) + 1}/{order.length}:</b> {spec.nodes.find((n) => n.id === litId)?.emoji} {spec.nodes.find((n) => n.id === litId)?.label}
          {spec.nodes.find((n) => n.id === litId)?.desc ? ` — ${spec.nodes.find((n) => n.id === litId)?.desc}` : ""}
        </div>
      )}
    </div>
  );
}
