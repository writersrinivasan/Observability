"use client";

import { useEffect, useState } from "react";
import { useSettings } from "./settings";

export default function SettingsDialog() {
  const s = useSettings();
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  useEffect(() => {
    if (s.open) {
      setKey(s.groqKey);
      setModel(s.model);
    }
  }, [s.open, s.groqKey, s.model]);
  if (!s.open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur" onClick={() => s.setOpen(false)}>
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#0f1430] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-black text-white">⚙️ Groq settings</h2>
        <p className="mt-1 text-sm text-white/60">
          Powers the LangGraph agents and the AI Assistant. Stored only in this browser and sent to this app&apos;s own server. Alternatively set <code className="text-amber-200">GROQ_API_KEY</code> in <code className="text-amber-200">.env.local</code>. Without any key, a realistic simulator runs.
        </p>
        <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-white/60">API key</label>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="gsk_…" className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:border-fuchsia-400" />
        <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-white/60">Model (optional)</label>
        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="openai/gpt-oss-120b" className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:border-fuchsia-400" />
        <div className="mt-5 flex gap-2">
          <button onClick={() => { s.setGroqKey(""); s.setModel(""); s.setOpen(false); }} className="rounded-full px-4 py-2 text-sm text-white/60 hover:text-white">Clear</button>
          <button onClick={() => { s.setGroqKey(key.trim()); s.setModel(model.trim()); s.setOpen(false); }} className="ml-auto rounded-full bg-gradient-to-r from-fuchsia-500 to-sky-500 px-5 py-2 text-sm font-bold text-white">Save</button>
        </div>
      </div>
    </div>
  );
}
