"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useSidebar } from "./SidebarContext";

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
  },
  {
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
    label: "Calculadora Jurídica",
    href: "/dashboard/calculadora",
  },
  {
    icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    label: "Mensagens",
    href: "/dashboard/chat",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const { data: session } = useSession();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className="fixed top-0 left-0 h-screen z-40 flex flex-col transition-all duration-300 ease-in-out"
      style={{
        width: collapsed ? "64px" : "240px",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center h-16 flex-shrink-0 px-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <Image src="/logo.png" alt="Legallis" width={120} height={36} className="object-contain" />
          </div>
        )}
        <button
          onClick={toggle}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5 flex-shrink-0"
          style={{ color: "var(--text3)", marginLeft: collapsed ? "auto" : "8px" }}
        >
          {collapsed ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className="flex items-center gap-3 px-2 py-2.5 rounded-lg transition-all group relative"
              style={{
                background: active ? "rgba(201,168,76,0.12)" : "transparent",
                color: active ? "var(--gold)" : "var(--text2)",
                borderLeft: active ? "2px solid var(--gold)" : "2px solid transparent",
                paddingLeft: active ? "calc(0.5rem - 2px)" : "0.5rem",
              }}
            >
              {item.icon}
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
              {collapsed && (
                <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2A2A2A] border border-[#3A3A3A] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 space-y-1" style={{ borderTop: "1px solid var(--border)" }}>
        {/* Admin link */}
        {session?.user?.role === "admin" && (() => {
          const active = pathname.startsWith("/dashboard/admin");
          return (
            <Link href="/dashboard/admin" title={collapsed ? "Admin" : undefined}
              className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg transition-all group relative"
              style={{
                background: active ? "rgba(201,168,76,0.12)" : "transparent",
                color: active ? "var(--gold)" : "var(--text3)",
                borderLeft: active ? "2px solid var(--gold)" : "2px solid transparent",
                paddingLeft: active ? "calc(0.5rem - 2px)" : "0.5rem",
              }}>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {!collapsed && <span className="text-sm font-medium">Admin</span>}
              {collapsed && (
                <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2A2A2A] border border-[#3A3A3A] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">Admin</span>
              )}
            </Link>
          );
        })()}
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
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">
                    {session?.user?.name ?? "Minha Conta"}
                  </span>
                </div>
              )}
              {collapsed && (
                <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2A2A2A] border border-[#3A3A3A] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">Minha Conta</span>
              )}
            </Link>
          );
        })()}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={collapsed ? "Sair" : undefined}
          className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors group relative hover:bg-white/5"
          style={{ color: "var(--text3)" }}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && <span className="text-sm font-medium">Sair</span>}
          {collapsed && (
            <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#2A2A2A] border border-[#3A3A3A] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
              Sair
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
