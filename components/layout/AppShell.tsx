"use client";

import { useSidebar } from "./SidebarContext";
import Sidebar from "./Sidebar";
import TrialBanner from "@/components/TrialBanner";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className="flex-1 min-w-0 transition-all duration-300 ease-in-out flex flex-col"
        style={{ marginLeft: collapsed ? "64px" : "240px" }}
      >
        <TrialBanner />
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
