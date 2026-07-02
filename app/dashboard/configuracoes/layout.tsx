"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const TABS = [
  { href: "/dashboard/configuracoes/perfil", label: "Perfil" },
  { href: "/dashboard/configuracoes/empresa", label: "Empresa" },
  { href: "/dashboard/configuracoes/assinatura", label: "Assinatura" },
  { href: "/dashboard/configuracoes/usuarios", label: "Usuários" },
  { href: "/dashboard/configuracoes/aparencia", label: "Aparência" },
];

export default function ConfigLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "admin";
  const isOwner = !!session?.user && session.user.tenantId === `t_${session.user.id}`;
  const canManageUsers = isSuperAdmin || isOwner;

  const tabs = canManageUsers ? TABS : TABS.filter(t => !t.href.includes("/usuarios"));

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>Configurações</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>Gerencie seu perfil, empresa e assinatura</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-8 overflow-x-auto pb-1"
        style={{ borderBottom: "1px solid var(--border)" }}>
        {tabs.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href}
              className="px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors rounded-t-lg"
              style={{
                color: active ? "var(--gold)" : "var(--text3)",
                borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
                marginBottom: "-1px",
              }}>
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
