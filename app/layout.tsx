import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import SettingsDialog from "@/components/SettingsDialog";
import AssistantDock from "@/components/assistant/AssistantDock";
import { SettingsProvider } from "@/components/settings";

const sans = Space_Grotesk({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "AgentOps Observatory — AI Observability & Workflow Management",
  description: "A 2-day course and live LangGraph lab for observing and managing agentic AI workflows.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <SettingsProvider>
          <Nav />
          <main>{children}</main>
          <AssistantDock />
          <SettingsDialog />
        </SettingsProvider>
      </body>
    </html>
  );
}
