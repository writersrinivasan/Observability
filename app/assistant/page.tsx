import AssistantChat from "@/components/assistant/AssistantChat";

export default function AssistantPage() {
  return (
    <div className="mx-auto flex h-[calc(100vh-60px)] max-w-5xl flex-col px-4 pt-6">
      <div className="mb-3">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-300">AI Assistant · Groq</div>
        <h1 className="bg-gradient-to-r from-fuchsia-300 via-sky-300 to-amber-200 bg-clip-text text-3xl font-black text-transparent">Ask Obi — answers you can see</h1>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <AssistantChat />
      </div>
    </div>
  );
}
