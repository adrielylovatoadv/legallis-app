"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Stats {
  totalUsers: number;
  trialActive: number;
  subscriptionsActive: number;
  expiredPlans: number;
  openTickets: number;
  monthlyRevenue: number;
  annualRevenue: number;
  byPlan: { basic: number; pro: number; profissional: number };
}

function StatCard({ label, value, icon, color, sub, href }: {
  label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string; href?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}20`, color }}>
          {icon}
        </div>
        {href && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--text3)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
      <p className="text-2xl font-bold mb-0.5" style={{ color: "var(--text)" }}>{value}</p>
      <p className="text-sm" style={{ color: "var(--text3)" }}>{label}</p>
      {sub && <p className="text-xs mt-1" style={{ color }}>{sub}</p>}
    </>
  );

  if (href) {
    return (
      <Link href={href}
        className="block rounded-2xl p-5 transition-all hover:scale-[1.02] hover:border-[var(--gold)]"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {content}
    </div>
  );
}

export default function MasterPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/master").then(r => r.json()).then(d => { setStats(d); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="p-8">
      <div className="h-8 w-48 rounded-lg mb-2 animate-pulse" style={{ background: "var(--surface2)" }} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--gold)" }}>Painel Master</p>
        <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>Dashboard Geral</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>Visão completa do SaaS Legallis</p>
      </div>

      {stats && (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Usuários totais" value={stats.totalUsers}
              color="var(--gold)" href="/master/clientes"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            />
            <StatCard label="Assinaturas ativas" value={stats.subscriptionsActive}
              color="#4ade80" href="/master/clientes?status=active"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatCard label="Testes ativos" value={stats.trialActive}
              color="var(--gold)" href="/master/clientes?status=trial"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatCard label="Planos vencidos" value={stats.expiredPlans}
              color="#f87171" href="/master/clientes?status=expired"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatCard label="Receita mensal" value={`R$ ${stats.monthlyRevenue.toLocaleString("pt-BR")}`}
              color="#818cf8" href="/master/financeiro"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              sub="estimado"
            />
            <StatCard label="Receita anual" value={`R$ ${stats.annualRevenue.toLocaleString("pt-BR")}`}
              color="#818cf8" href="/master/financeiro"
              sub="projeção"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            />
            <StatCard label="Chamados abertos" value={stats.openTickets}
              color="#fb923c" href="/master/suporte"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
            />
          </div>

          {/* Plans breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <h2 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Assinaturas por Plano</h2>
              <div className="space-y-3">
                {[
                  { key: "basic", label: "Básico", color: "var(--text3)", price: 97, count: stats.byPlan.basic },
                  { key: "profissional", label: "Profissional", color: "var(--gold)", price: 197, count: stats.byPlan.profissional },
                  { key: "pro", label: "Pro", color: "#818cf8", price: 347, count: stats.byPlan.pro },
                ].map(p => (
                  <div key={p.key} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm" style={{ color: "var(--text)" }}>{p.label}</span>
                        <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{p.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${stats.subscriptionsActive > 0 ? (p.count / stats.subscriptionsActive) * 100 : 0}%`, background: p.color }} />
                      </div>
                    </div>
                    <span className="text-xs w-20 text-right" style={{ color: "var(--text3)" }}>
                      R$ {(p.count * p.price).toLocaleString("pt-BR")}/mês
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <h2 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Gestão Rápida</h2>
              <div className="space-y-2">
                {[
                  { href: "/master/clientes", label: "Gestão de Clientes", icon: "👥", desc: "Ver e gerenciar todos os clientes" },
                  { href: "/master/financeiro", label: "Controle Financeiro", icon: "💰", desc: "Pagamentos e receitas" },
                  { href: "/master/suporte", label: "Central de Suporte", icon: "💬", desc: "Responder chamados abertos" },
                ].map(l => (
                  <Link key={l.href} href={l.href}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.01]"
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                    <span className="text-2xl">{l.icon}</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{l.label}</p>
                      <p className="text-xs" style={{ color: "var(--text3)" }}>{l.desc}</p>
                    </div>
                    <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--text3)" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
