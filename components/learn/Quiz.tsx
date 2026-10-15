"use client";

import { useState } from "react";
import type { Module } from "@/lib/curriculum";

export default function Quiz({ quiz }: { quiz: Module["quiz"] }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const score = quiz.filter((q, i) => picked[i] === q.answer).length;
  return (
    <div className="space-y-4">
      {quiz.map((q, i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="font-semibold text-white">
            {i + 1}. {q.q}
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {q.options.map((o, j) => {
              const chosen = picked[i] === j;
              const reveal = picked[i] !== undefined;
              const cls = reveal && j === q.answer ? "border-emerald-400 bg-emerald-500/20" : chosen ? "border-rose-400 bg-rose-500/20" : "border-white/10 bg-white/5 hover:bg-white/10";
              return (
                <button key={j} disabled={reveal} onClick={() => setPicked((p) => ({ ...p, [i]: j }))} className={`rounded-xl border px-3 py-2 text-left text-sm text-white/90 transition ${cls}`}>
                  {String.fromCharCode(65 + j)}. {o}
                </button>
              );
            })}
          </div>
          {picked[i] !== undefined && <p className="mt-2 text-sm text-white/70">{picked[i] === q.answer ? "✅ Correct — " : "❌ Not quite — "}{q.why}</p>}
        </div>
      ))}
      {Object.keys(picked).length === quiz.length && (
        <div className="rounded-2xl bg-gradient-to-r from-fuchsia-500/30 to-sky-500/30 p-3 text-center font-bold text-white">
          Score: {score}/{quiz.length} {score === quiz.length ? "🏆" : "💪"}
        </div>
      )}
    </div>
  );
}
