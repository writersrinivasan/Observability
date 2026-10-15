"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface Settings {
  groqKey: string;
  model: string;
  setGroqKey(k: string): void;
  setModel(m: string): void;
  headers(): Record<string, string>;
  open: boolean;
  setOpen(o: boolean): void;
}

const Ctx = createContext<Settings | null>(null);
const read = (k: string) => {
  try {
    return localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [groqKey, setKey] = useState("");
  const [model, setM] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setKey(read("obs.groqKey"));
    setM(read("obs.groqModel"));
  }, []);
  const value: Settings = {
    groqKey,
    model,
    open,
    setOpen,
    setGroqKey: (k) => (setKey(k), write("obs.groqKey", k)),
    setModel: (m) => (setM(m), write("obs.groqModel", m)),
    headers: () => ({ "Content-Type": "application/json", ...(groqKey ? { "x-groq-key": groqKey } : {}), ...(model ? { "x-groq-model": model } : {}) }),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSettings = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("SettingsProvider missing");
  return c;
};
