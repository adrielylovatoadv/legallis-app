"use client";

import { createContext, useContext, useState, useEffect } from "react";

const SidebarContext = createContext<{
  collapsed: boolean;
  toggle: () => void;
  // Estado do menu em telas pequenas (abaixo do breakpoint md): a sidebar vira um
  // painel sobreposto (drawer) fora da tela por padrão, em vez de disputar espaço
  // com o conteúdo — "collapsed" continua sendo só a preferência de telas largas.
  mobileOpen: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
}>({ collapsed: false, toggle: () => {}, mobileOpen: false, toggleMobile: () => {}, closeMobile: () => {} });

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) setCollapsed(saved === "true");
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const toggleMobile = () => setMobileOpen((prev) => !prev);
  const closeMobile = () => setMobileOpen(false);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, mobileOpen, toggleMobile, closeMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
