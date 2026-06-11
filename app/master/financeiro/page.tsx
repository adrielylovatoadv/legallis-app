"use client";

import { useState, useEffect } from "react";

interface FinanceStats {
  totalUsers: number;
  subscriptionsActive: number;
  trialActive: number;
  expiredPlans: number;
  monthlyRevenue: number;
  annualRevenue: number;
  byPlan: { basic: number; pro: number; profissional: number };
}

const PLAN_PRICES: Record<string, number> = { basic: 49, pro: 99, profissional: 199 };

export default function MasterFinanceiroPage() {
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/master").then(r => r.json()).then(d => { setStats(d); setLoading(false); });
  }, []);

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--text3)" }}>Carregando...</div>;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--gold)" }}>Painel Master</p>
        <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>Controle Financeiro</h1>
      </div>

      {stats && (
        <div className="space-y-6">
          {/* Revenue cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Receita Mensal Estimada", value: `R$ ${stats.monthlyRevenue.toLocaleString("pt-BR")}`, color: "#4ade80", icon: "📈" },
              { label: "Receita Anual Projetada", value: `R$ ${stats.annualRevenue.toLocaleString("pt-BR")}`, color: "#818cf8", icon: "📊" },
              { label: "Assinaturas Pagas", value: stats.subscriptionsActive, color: "var(--gold)", icon: "💳" },
            ].map((card, i) => (
              <div key={i} className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="text-3xl mb-3">{card.icon}</div>
                <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{card.value}</p>
                <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>{card.label}</p>
              </div>
            ))}
          </div>

          {/* Revenue by plan */}
          <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h2 className="font-semibold mb-5" style={{ color: "var(--text)" }}>Receita por Plano</h2>
            <div className="space-y-4">
              {[
                { key: "basic", label: "Básico", color: "var(--text3)", count: stats.byPlan.basic },
                { key: "pro", label: "Pro", color: "var(--gold)", count: stats.byPlan.pro },
                { key: "profissional", label: "Profissional", color: "#818cf8", count: stats.byPlan.profissional },
              ].map(p => {
                const revenue = p.count * (PLAN_PRICES[p.key] ?? 0);
                const total = stats.monthlyRevenue || 1;
                return (
                  <div key={p.key} className="rounded-xl p-4" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                        <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{p.label}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${p.color}22`, color: p.color }}>
                          {p.count} assinante{p.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>R$ {revenue.toLocaleString("pt-BR")}/mês</p>
                        <p className="text-xs" style={{ color: "var(--text3)" }}>R$ {(revenue * 12).toLocaleString("pt-BR")}/ano</p>
                      </div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${(revenue / total) * 100}%`, background: p.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <div className="rounded-xl p-4" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}>
            <p className="text-xs" style={{ color: "var(--text3)" }}>
              Os valores exibidos são estimativas baseadas nas assinaturas ativas. Para dados precisos de pagamentos, cancelamentos e reembolsos, consulte o painel do Stripe.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
