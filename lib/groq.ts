// Resolve the Groq key: browser-supplied header (Settings dialog) wins, then .env.local
export function resolveGroq(req: Request) {
  const header = req.headers.get("x-groq-key")?.trim();
  const apiKey = header || process.env.GROQ_API_KEY || undefined;
  const model = req.headers.get("x-groq-model")?.trim() || process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  return { apiKey, model };
}
