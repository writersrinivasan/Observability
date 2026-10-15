"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Maximize2, X } from "lucide-react";
import AssistantChat from "./AssistantChat";

export default function AssistantDock() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  if (path.startsWith("/assistant")) return null;
  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[min(680px,calc(100vh-130px))] w-[min(520px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#0b1020]/95 shadow-[0_20px_80px_rgba(0,0,0,.6)] backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-white/10 bg-gradient-to-r from-fuchsia-600/40 to-sky-600/40 px-4 py-2.5">
            <span className="text-lg">🦉</span>
            <span className="font-bold text-white">Obi · AI Assistant</span>
            <Link href="/assistant" className="ml-auto text-white/70 hover:text-white" title="Open full screen"><Maximize2 size={16} /></Link>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white"><X size={18} /></button>
          </div>
          <AssistantChat compact />
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} className="fixed bottom-5 right-5 z-50 grid h-16 w-16 animate-floaty place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-sky-500 text-3xl shadow-[0_0_40px_rgba(168,85,247,.6)]" aria-label="Open AI assistant">
        {open ? "✖️" : "🦉"}
      </button>
    </>
  );
}
