"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";

const PLANS = [
  {
    id: "basic",
    name: "Básico",
    price: "R$ 97",
    period: "/mês",
    description: "cobrado mensalmente",
    trial: "4 dias grátis · sem cartão de crédito",
    features: [
      { text: "1 admin + até 2 usuários", ok: true },
      { text: "Até 80 processos cadastrados", ok: true },
      { text: "Controle Processual completo", ok: true },
      { text: "Calculadora Jurídica (TJMG/TJSP)", ok: true },
      { text: "Export em PDF", ok: true },
      { text: "Financeiro do escritório", ok: false },
      { text: "Export Word e Excel", ok: false },
    ],
    paymentLink: "https://buy.stripe.com/test_9B600ke867Gta2EdNveEo09",
    color: "var(--text3)",
    btnLabel: "Testar grátis por 4 dias",
    btnStyle: "outline",
  },
  {
    id: "profissional",
    name: "Profissional",
    price: "R$ 197",
    period: "/mês",
    description: "cobrado mensalmente",
    trial: null,
    features: [
      { text: "1 admin + até 4 usuários", ok: true },
      { text: "Até 200 processos cadastrados", ok: true },
      { text: "Todos os módulos", ok: true },
      { text: "Calculadora Jurídica (TJMG/TJSP)", ok: true },
      { text: "Financeiro completo", ok: true },
      { text: "Export PDF, Word e Excel", ok: true },
      { text: "Suporte por e-mail", ok: true },
    ],
    paymentLink: "https://buy.stripe.com/test_00wfZi8NMe4RcaMfVDeEo0a",
    color: "var(--gold)",
    destaque: true,
    btnLabel: "Assinar agora",
    btnStyle: "gold",
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 347",
    period: "/mês",
    description: "cobrado mensalmente",
    trial: null,
    features: [
      { text: "1 admin + até 20 usuários", ok: true },
      { text: "Até 5.000 processos cadastrados", ok: true },
      { text: "Todos os módulos", ok: true },
      { text: "Calculadora Jurídica (TJMG/TJSP)", ok: true },
      { text: "Export PDF, Word e Excel", ok: true },
      { text: "Suporte prioritário", ok: true },
      { text: "Onboarding incluso", ok: true },
    ],
    paymentLink: "https://buy.stripe.com/test_eVq7sM1lk7Gt7Uw9xfeEo0b",
    color: "#818cf8",
    btnLabel: "Assinar agora",
    btnStyle: "outline",
  },
];

export default function AssinarPage() {
  const { data: session } = useSession();
  const isExpired = session?.user?.subscriptionStatus === "expired" ||
    session?.user?.subscriptionStatus === "cancelled";

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <Image src="/logo.png" alt="Legallis" width={140} height={42} priority />
          <button onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs px-4 py-2 rounded-lg transition-colors"
            style={{ background: "var(--surface2)", color: "var(--text3)" }}>
            Sair
          </button>
        </div>

        {isExpired && (
          <div className="rounded-xl p-5 mb-8 flex items-start gap-4"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#f87171" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-semibold text-sm" style={{ color: "#f87171" }}>Período de teste encerrado</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
                Seus dados estão salvos por mais 1 dia. Assine um plano para continuar usando o Legallis.
              </p>
            </div>
          </div>
        )}

        <h1 className="font-serif text-3xl font-semibold text-center mb-2" style={{ color: "var(--text)" }}>
          Escolha seu plano
        </h1>
        <p className="text-center text-sm mb-10" style={{ color: "var(--text3)" }}>
          Cancele quando quiser. Sem taxa de adesão.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map(plan => (
            <div key={plan.id}
              className="relative rounded-2xl p-6 transition-all hover:scale-[1.02]"
              style={{
                background: "var(--surface)",
                border: `2px solid ${plan.destaque ? "var(--gold)" : "var(--border)"}`,
                boxShadow: plan.destaque ? "0 0 24px rgba(201,168,76,0.15)" : "none",
              }}>
              {plan.destaque && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: "var(--gold)", color: "#000" }}>
                  Mais popular
                </div>
              )}
              <div className="mb-4">
                <h3 className="font-semibold text-lg" style={{ color: plan.color }}>{plan.name}</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{plan.description}</p>
              </div>
              <div className="flex items-baseline gap-1 mb-0.5">
                <span className="text-4xl font-bold" style={{ color: "var(--text)" }}>{plan.price}</span>
                <span className="text-sm" style={{ color: "var(--text3)" }}>{plan.period}</span>
              </div>
              {plan.trial
                ? <p className="text-xs mb-5" style={{ color: "var(--gold)" }}>✦ {plan.trial}</p>
                : <p className="text-xs mb-5" style={{ color: "var(--text3)" }}>Sem período de teste · cobrança imediata</p>
              }
              <ul className="space-y-2 mb-6">
                {plan.features.map(f => (
                  <li key={f.text} className="flex items-center gap-2 text-sm"
                    style={{ color: f.ok ? "var(--text2)" : "var(--text3)", textDecoration: f.ok ? "none" : "line-through", opacity: f.ok ? 1 : 0.5 }}>
                    <span className="w-3.5 h-3.5 flex-shrink-0 text-xs">{f.ok ? "●" : "●"}</span>
                    {f.text}
                  </li>
                ))}
              </ul>
              <a
                href={`${plan.paymentLink}?prefilled_email=${encodeURIComponent(session?.user?.email ?? "")}&client_reference_id=${session?.user?.id ?? ""}`}
                className="block w-full py-3 rounded-xl text-sm font-semibold text-center transition-all"
                style={{
                  background: plan.btnStyle === "gold" ? "var(--gold)" : "transparent",
                  color: plan.btnStyle === "gold" ? "#000" : plan.color,
                  border: `1px solid ${plan.btnStyle === "gold" ? "var(--gold)" : plan.color}`,
                }}>
                {plan.btnLabel}
              </a>
            </div>
          ))}
        </div>

        <p className="text-center text-xs mt-8" style={{ color: "var(--text3)" }}>
          Pagamento processado com segurança pelo Stripe · SSL
        </p>
      </div>
    </div>
  );
}
