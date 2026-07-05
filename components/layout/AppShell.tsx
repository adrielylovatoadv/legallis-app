"use client";

import { useSidebar } from "./SidebarContext";
import Sidebar from "./Sidebar";
import TrialBanner from "@/components/TrialBanner";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { collapsed, toggleMobile } = useSidebar();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className={`flex-1 min-w-0 transition-all duration-300 ease-in-out flex flex-col ${collapsed ? "md:ml-16" : "md:ml-60"}`}
      >
        {/* Barra mobile — a sidebar vira um drawer fora da tela abaixo do breakpoint md,
            então esse botão é a única forma de abri-la em telas pequenas. */}
        <div className="md:hidden flex items-center h-14 px-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
          <button onClick={toggleMobile} aria-label="Abrir menu"
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/5"
            style={{ color: "var(--text2)" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
        <TrialBanner />
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
