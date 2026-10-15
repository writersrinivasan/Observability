import { Fragment } from "react";

// Tiny, dependency-free markdown renderer: headings, lists, bold, italics, inline code, code fences.
function inline(text: string, key: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    const k = `${key}-${i}`;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={k} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={k} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-amber-200">{p.slice(1, -1)}</code>;
    if ((p.startsWith("_") && p.endsWith("_") && p.length > 2) || (p.startsWith("*") && p.endsWith("*") && p.length > 2)) return <em key={k} className="text-white/70">{p.slice(1, -1)}</em>;
    return <Fragment key={k}>{p}</Fragment>;
  });
}

export default function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let list: string[] = [];
  let ordered = false;
  const flush = () => {
    if (!list.length) return;
    const items = list.map((l, i) => <li key={i}>{inline(l, `li${blocks.length}-${i}`)}</li>);
    blocks.push(ordered ? <ol key={blocks.length} className="ml-5 list-decimal space-y-1">{items}</ol> : <ul key={blocks.length} className="ml-5 list-disc space-y-1 marker:text-fuchsia-400">{items}</ul>);
    list = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flush();
      const code: string[] = [];
      while (++i < lines.length && !lines[i].startsWith("```")) code.push(lines[i]);
      blocks.push(<pre key={blocks.length} className="overflow-x-auto rounded-xl bg-black/50 p-3 font-mono text-xs text-emerald-200">{code.join("\n")}</pre>);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      const rows: string[][] = [];
      for (; i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]); i++) {
        if (/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) continue; // separator row
        rows.push(lines[i].trim().slice(1, -1).split("|").map((c) => c.trim()));
      }
      i--;
      const [head, ...body] = rows;
      blocks.push(
        <div key={blocks.length} className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-[0.92em]">
            <thead className="bg-white/10">
              <tr>{head.map((c, j) => <th key={j} className="px-3 py-1.5 font-semibold text-white">{inline(c, `th${i}-${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, k) => (
                <tr key={k} className="border-t border-white/5 align-top">
                  {r.map((c, j) => <td key={j} className="px-3 py-1.5">{inline(c, `td${i}-${k}-${j}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flush();
      blocks.push(<hr key={blocks.length} className="border-white/10" />);
      continue;
    }
    const ul = line.match(/^\s*[-*•]\s+(.*)/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      if (list.length && ordered !== !!ol) flush();
      ordered = !!ol;
      list.push((ul ?? ol)![1]);
      continue;
    }
    flush();
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) blocks.push(<p key={blocks.length} className={`font-bold text-white ${h[1].length <= 2 ? "text-lg" : "text-base"}`}>{inline(h[2], `h${i}`)}</p>);
    else if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line, `p${i}`)}</p>);
  }
  flush();
  return <div className={`space-y-2 leading-relaxed ${className}`}>{blocks}</div>;
}
