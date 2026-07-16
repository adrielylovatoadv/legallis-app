"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useSidebar } from "./SidebarContext";
import { useTheme } from "./ThemeContext";
import { exportTudo } from "@/lib/export-excel";
import { hasFinanceiroAccess } from "@/lib/acl";

const NAV = [
  {
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    label: "Início",
    href: "/dashboard",
    exact: true,
  },
  {
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    label: "Controle Processual",
    href: "/dashboard/controle",
  },
  {
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    label: "Financeiro",
    href: "/dashboard/financeiro",
    moduleKey: "financeiro" as const,
  },
  {
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
    label: "Calculadora Jurídica",
    href: "/dashboard/calculadora",
  },
  {
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zm7-5a1 1 0 11-2 0 1 1 0 012 0z" /></svg>,
    label: "Calculadora de Prazos",
    href: "/dashboard/prazos",
  },
  {
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    label: "Indicadores",
    href: "/dashboard/indicadores",
  },
  {
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    label: "Minhas Designações",
    href: "/dashboard/designacoes",
  },
  {
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2M19 21H5m0 0H3m8-14h.01M11 11h.01M11 15h.01M15 7h.01M15 11h.01M15 15h.01M7 7h.01M7 11h.01M7 15h.01" /></svg>,
    label: "Publicações",
    href: "/dashboard/publicacoes",
  },
  {
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4m0-18h10a2 2 0 012 2v14a2 2 0 01-2 2H9m0-18v18m-4-13h0m0 4h0m0 4h0" /></svg>,
    label: "Kanban",
    href: "/dashboard/kanban",
  },
  {
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    label: "Mensagens",
    href: "/dashboard/chat",
  },
];

function Badge({ count, collapsed }: { count: number; collapsed: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className="flex items-center justify-center rounded-full text-[10px] font-semibold leading-none flex-shrink-0"
      style={{
        background: "#ef4444", color: "#fff",
        minWidth: 16, height: 16, padding: "0 4px",
        ...(collapsed ? { position: "absolute", top: 4, right: 4 } : { marginLeft: "auto" }),
      }}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavItem({ href, icon, label, collapsed, exact, badge }: {
  href: string; icon: React.ReactNode; label: string; collapsed: boolean; exact?: boolean; badge?: number;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link href={href} title={collapsed ? label : undefined}
      className="flex items-center gap-3 px-2 py-2.5 rounded-lg transition-all group relative"
      style={{
        background: active ? "rgba(201,168,76,0.12)" : "transparent",
        color: active ? "var(--gold)" : "var(--text2)",
        borderLeft: active ? "2px solid var(--gold)" : "2px solid transparent",
        paddingLeft: active ? "calc(0.5rem - 2px)" : "0.5rem",
      }}>
      {icon}
      {!collapsed && <span className="text-sm font-medium truncate">{label}</span>}
      {!collapsed && <Badge count={badge ?? 0} collapsed={false} />}
      {collapsed && <Badge count={badge ?? 0} collapsed={true} />}
      {collapsed && (
        <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2A2A2A] border border-[#3A3A3A] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">{label}</span>
      )}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle, mobileOpen, closeMobile } = useSidebar();
  const { data: session } = useSession();
  const { theme, toggle: toggleTheme } = useTheme();
  const [exporting, setExporting] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingRedesignacoes, setPendingRedesignacoes] = useState(0);

  const handleExport = async () => {
    setExporting(true);
    try { await exportTudo(); } finally { setExporting(false); }
  };

  useEffect(() => {
    if (!session?.user) return;
    const load = () => {
      fetch("/api/chat/unread").then(r => r.ok ? r.json() : {})
        .then((counts: Record<string, number>) => setUnreadMessages(Object.values(counts).reduce((s, n) => s + n, 0)))
        .catch(() => {});
      fetch("/api/designacoes").then(r => r.ok ? r.json() : { recebidas: [] })
        .then((d: { recebidas?: unknown[] }) => setPendingRedesignacoes(d.recebidas?.length ?? 0))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [session?.user]);

  // Fecha o drawer mobile ao navegar — sem isso, trocar de página deixaria o menu
  // aberto cobrindo o conteúdo novo.
  useEffect(() => { closeMobile(); }, [pathname, closeMobile]);

  return (
    <>
      {/* Overlay do drawer mobile — só existe abaixo do breakpoint md */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={closeMobile} />
      )}
      <aside
        className={`fixed top-0 left-0 h-screen z-40 flex flex-col transition-all duration-300 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        style={{ width: collapsed ? "64px" : "240px", background: "var(--surface)", borderRight: "1px solid var(--border)" }}
      >
      {/* Header */}
      <div className="flex items-center h-16 flex-shrink-0 px-3" style={{ borderBottom: "1px solid var(--border)" }}>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <Image src="/logo.png" alt="Legallis" width={120} height={36} className="object-contain" />
          </div>
        )}
        <button onClick={toggle} title={collapsed ? "Expandir menu" : "Recolher menu"}
          className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center transition-colors hover:bg-white/5 flex-shrink-0"
          style={{ color: "var(--text3)", marginLeft: collapsed ? "auto" : "8px" }}>
          {collapsed ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          )}
        </button>
        {/* Fechar o drawer — só faz sentido em telas pequenas, onde a sidebar é um overlay */}
        <button onClick={closeMobile} title="Fechar menu" aria-label="Fechar menu"
          className="md:hidden ml-auto w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5 flex-shrink-0"
          style={{ color: "var(--text3)" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV
          .filter(item => item.moduleKey !== "financeiro" || hasFinanceiroAccess(session?.user?.cargo))
          .map(item => {
            const badge = item.href === "/dashboard/chat" ? unreadMessages
              : item.href === "/dashboard/designacoes" ? pendingRedesignacoes
              : undefined;
            return <NavItem key={item.href} {...item} collapsed={collapsed} badge={badge} />;
          })}

        {/* Importar / Exportar dados */}
        {!collapsed && <div className="my-2" style={{ borderTop: "1px solid var(--border)" }} />}
        {collapsed && <div className="my-2" style={{ borderTop: "1px solid var(--border)" }} />}
        <NavItem href="/dashboard/importar" collapsed={collapsed}
          label="Importar dados (Excel)"
          icon={
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          }
        />
        <button onClick={handleExport} disabled={exporting}
          title={collapsed ? "Exportar todos os dados" : undefined}
          className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors group relative hover:bg-white/5"
          style={{ color: "var(--text2)" }}>
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {!collapsed && <span className="text-sm font-medium">{exporting ? "Exportando..." : "Exportar dados (Excel)"}</span>}
          {collapsed && (
            <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2A2A2A] border border-[#3A3A3A] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
              Exportar dados (Excel)
            </span>
          )}
        </button>

        {/* Divider */}
        {!collapsed && (
          <div className="px-2 pt-3 pb-1">
            <p className="text-xs uppercase tracking-widest" style={{ color: "var(--text3)" }}>Conta</p>
          </div>
        )}
        {collapsed && <div className="my-2" style={{ borderTop: "1px solid var(--border)" }} />}

        <NavItem href="/dashboard/suporte" collapsed={collapsed}
          label="Suporte"
          icon={<svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
        />
        <NavItem href="/dashboard/configuracoes" collapsed={collapsed}
          label="Configurações"
          icon={<svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />

        {/* Master Panel - só para admin */}
        {session?.user?.plan === "admin" && (
          <>
            {!collapsed && (
              <div className="px-2 pt-3 pb-1">
                <p className="text-xs uppercase tracking-widest" style={{ color: "var(--gold)" }}>Master</p>
              </div>
            )}
            {collapsed && <div className="my-2" style={{ borderTop: "1px solid var(--border)" }} />}
            <NavItem href="/master" collapsed={collapsed}
              label="Painel Master"
              exact
              icon={<svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--gold)" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            />
            <NavItem href="/dashboard/diagnostico" collapsed={collapsed}
              label="Diagnóstico"
              icon={<svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18" /></svg>}
            />
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 space-y-1" style={{ borderTop: "1px solid var(--border)" }}>
        {/* Conta */}
        {(() => {
          const active = pathname.startsWith("/dashboard/conta");
          return (
            <Link href="/dashboard/conta" title={collapsed ? "Minha Conta" : undefined}
              className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg transition-all group relative"
              style={{
                background: active ? "rgba(201,168,76,0.12)" : "transparent",
                color: active ? "var(--gold)" : "var(--text3)",
                borderLeft: active ? "2px solid var(--gold)" : "2px solid transparent",
                paddingLeft: active ? "calc(0.5rem - 2px)" : "0.5rem",
              }}>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {!collapsed && (
                <span className="text-sm font-medium truncate">{session?.user?.name ?? "Minha Conta"}</span>
              )}
              {collapsed && (
                <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2A2A2A] border border-[#3A3A3A] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">Minha Conta</span>
              )}
            </Link>
          );
        })()}

        {/* Tema toggle */}
        <button onClick={toggleTheme}
          title={collapsed ? (theme === "dark" ? "Modo claro" : "Modo escuro") : undefined}
          className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors group relative hover:bg-white/5"
          style={{ color: "var(--text3)" }}>
          {theme === "dark" ? (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          )}
          {!collapsed && <span className="text-sm font-medium">{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>}
          {collapsed && (
            <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2A2A2A] border border-[#3A3A3A] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
              {theme === "dark" ? "Modo claro" : "Modo escuro"}
            </span>
          )}
        </button>

        <button onClick={() => signOut({ callbackUrl: "/login" })}
          title={collapsed ? "Sair" : undefined}
          className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors group relative hover:bg-white/5"
          style={{ color: "var(--text3)" }}>
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && <span className="text-sm font-medium">Sair</span>}
          {collapsed && (
            <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2A2A2A] border border-[#3A3A3A] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">Sair</span>
          )}
        </button>
      </div>
      </aside>
    </>
  );
}
