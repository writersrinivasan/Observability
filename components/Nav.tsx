"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { useSettings } from "./settings";

const LINKS = [
  { href: "/", label: "Home", emoji: "🏠" },
  { href: "/learn", label: "Learn", emoji: "📚" },
  { href: "/lab", label: "Lab", emoji: "🧪" },
  { href: "/assistant", label: "AI Assistant", emoji: "🦉" },
];

export default function Nav() {
  const path = usePathname();
  const s = useSettings();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070a16]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] items-center gap-2 px-4 py-2.5">
        <Link href="/" className="mr-3 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-sky-500 text-lg shadow-[0_0_20px_rgba(168,85,247,.5)]">🔭</span>
          <span className="hidden font-black leading-tight text-white sm:block">
            AgentOps <span className="bg-gradient-to-r from-fuchsia-300 to-sky-300 bg-clip-text text-transparent">Observatory</span>
          </span>
        </Link>
        <nav className="flex gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition ${active ? "bg-white text-slate-900" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                <span className="mr-1">{l.emoji}</span>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={() => s.setOpen(true)} className="ml-auto flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10">
          <Settings size={14} />
          <span className={`h-2 w-2 rounded-full ${s.groqKey ? "bg-emerald-400" : "bg-amber-400"}`} />
          <span className="hidden sm:inline">Groq</span>
        </button>
      </div>
    </header>
  );
}
