"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";

const PLANS = [
  {
    id: "basic",
    name: "Básico",
    price: "R$ 49",
    period: "/mês",
    description: "Para advogados autônomos",
    features: ["Controle Processual", "Calculadora Jurídica", "Export PDF", "1 usuário"],
    paymentLink: "https://buy.stripe.com/test_6oU4gA6FE7Gt3Eg24NeEo00",
    color: "var(--text3)",
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 99",
    period: "/mês",
    description: "Para pequenos escritórios",
    features: ["Tudo do Básico", "Financeiro", "Export PDF/Word/Excel", "Até 5 usuários"],
    paymentLink: "https://buy.stripe.com/test_8x200k8NMaSF1w87p7eEo02",
    color: "var(--gold)",
    destaque: true,
  },
  {
    id: "profissional",
    name: "Profissional",
    price: "R$ 199",
    period: "/mês",
    description: "Para escritórios em crescimento",
    features: ["Tudo do Pro", "Usuários ilimitados", "Painel admin", "Suporte prioritário"],
    paymentLink: "https://buy.stripe.com/test_3cIaEYbZY5yl0s46l3eEo01",
    color: "#818cf8",
  },
];

export default function AssinarPage() {
  const { data: session } = useSession();
  const isExpired = session?.user?.subscriptionStatus === "trial" ||
    session?.user?.subscriptionStatus === "expired" ||
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
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-3xl font-bold" style={{ color: "var(--text)" }}>{plan.price}</span>
                <span className="text-sm" style={{ color: "var(--text3)" }}>{plan.period}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "var(--text2)" }}>
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: plan.color }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={`${plan.paymentLink}?prefilled_email=${encodeURIComponent(session?.user?.email ?? "")}&client_reference_id=${session?.user?.id ?? ""}`}
                className="block w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all"
                style={{
                  background: plan.destaque ? "var(--gold)" : "var(--surface2)",
                  color: plan.destaque ? "#000" : "var(--text)",
                  border: plan.destaque ? "none" : `1px solid ${plan.color}`,
                }}>
                Assinar {plan.name}
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
