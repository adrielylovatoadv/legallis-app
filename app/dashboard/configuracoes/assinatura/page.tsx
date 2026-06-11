"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

const PLAN_INFO: Record<string, { label: string; price: string; maxUsers: number; features: string[] }> = {
  admin: { label: "Administrador", price: "Interno", maxUsers: Infinity, features: ["Acesso total", "Painel Master", "Suporte prioritário"] },
  profissional: { label: "Profissional", price: "R$ 199/mês", maxUsers: Infinity, features: ["Usuários ilimitados", "Painel admin", "Suporte prioritário"] },
  pro: { label: "Pro", price: "R$ 99/mês", maxUsers: 5, features: ["Financeiro", "Exportações", "Até 5 usuários"] },
  basic: { label: "Básico", price: "R$ 49/mês", maxUsers: 1, features: ["Controle Processual", "Calculadora", "1 usuário"] },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "#4ade80" },
  trial: { label: "Teste gratuito", color: "var(--gold)" },
  expired: { label: "Expirado", color: "#f87171" },
  cancelled: { label: "Cancelado", color: "#f87171" },
  pending: { label: "Pendente", color: "#facc15" },
};

export default function AssinaturaPage() {
  const { data: session } = useSession();
  const [portalLoading, setPortalLoading] = useState(false);

  const openPortal = async () => {
    setPortalLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    } else {
      const d = await res.json();
      alert(d.error ?? "Erro ao abrir portal.");
    }
    setPortalLoading(false);
  };
  const plan = (session?.user?.plan ?? "basic") as string;
  const status = (session?.user?.subscriptionStatus ?? "active") as string;
  const trialEndsAt = session?.user?.trialEndsAt;
  const planInfo = PLAN_INFO[plan] ?? PLAN_INFO.basic;
  const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.active;

  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Plano Atual</h2>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-semibold text-lg" style={{ color: "var(--text)" }}>{planInfo.label}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: `${statusInfo.color}22`, color: statusInfo.color }}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-sm" style={{ color: "var(--text3)" }}>{planInfo.price}</p>
            {status === "trial" && daysLeft !== null && (
              <p className="text-sm mt-1" style={{ color: "var(--gold)" }}>
                {daysLeft === 0 ? "Expira hoje" : `Expira em ${daysLeft} dia${daysLeft !== 1 ? "s" : ""}`}
                {trialEndsAt && ` · ${new Date(trialEndsAt).toLocaleDateString("pt-BR")}`}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {plan !== "admin" && (
              <Link href="/assinar"
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-center"
                style={{ background: "var(--gold)", color: "#000" }}>
                {status === "trial" ? "Assinar agora" : "Fazer upgrade"}
              </Link>
            )}
            {status === "active" && plan !== "admin" && (
              <button className="px-5 py-2 rounded-xl text-sm text-center transition-colors"
                style={{ background: "var(--surface)", color: "var(--text3)", border: "1px solid var(--border)" }}>
                Cancelar assinatura
              </button>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text3)" }}>Recursos incluídos</p>
          <ul className="space-y-1.5">
            {planInfo.features.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "var(--text2)" }}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--gold)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Billing info placeholder */}
      {status === "active" && plan !== "admin" && (
        <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Faturamento</h2>
          <p className="text-sm" style={{ color: "var(--text3)" }}>
            Para gerenciar pagamentos, faturas e dados de cobrança, acesse o portal do Stripe.
          </p>
          <button onClick={openPortal} disabled={portalLoading}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)", opacity: portalLoading ? 0.7 : 1 }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {portalLoading ? "Abrindo..." : "Portal de Faturamento"}
          </button>
        </div>
      )}
    </div>
  );
}
