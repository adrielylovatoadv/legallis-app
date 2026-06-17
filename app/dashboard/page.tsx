"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

const CARDS = [
  { icon: "⚖️", title: "Controle Processual", desc: "Processos · Prazos · Audiências · Acordos", href: "/dashboard/controle", color: "#C9A84C" },
  { icon: "💼", title: "Financeiro", desc: "Honorários · Acordos · Repasses · Fluxo de caixa", href: "/dashboard/financeiro", color: "#C9A84C" },
  { icon: "🧮", title: "Calculadora Jurídica", desc: "TJMG · TJSP · Correção monetária · Juros", href: "/dashboard/calculadora", color: "#C9A84C" },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const sexo = session?.user?.sexo;
  const firstName = session?.user?.name?.split(" ")[0] ?? "";
  const saudacao = sexo === "feminino" ? "Bem-vinda" : sexo === "masculino" ? "Bem-vindo" : "Bem-vindo(a)";
  const titulo = sexo === "feminino" ? `Dra. ${firstName}` : sexo === "masculino" ? `Dr. ${firstName}` : firstName;

  return (
    <div className="p-8">
      <div
        className="rounded-xl px-8 py-6 mb-8"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "4px solid var(--gold)" }}
      >
        <p className="text-xs tracking-widest uppercase mb-1" style={{ color: "var(--text3)" }}>{saudacao}</p>
        <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>{titulo || "..."}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>Selecione um módulo para começar</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl p-6 flex flex-col gap-3 transition-all hover:scale-[1.02] hover:border-[#C9A84C]/40"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderTop: "3px solid var(--gold)",
            }}
          >
            <span className="text-3xl">{card.icon}</span>
            <div>
              <h2 className="font-serif font-semibold text-base" style={{ color: "var(--text)" }}>{card.title}</h2>
              <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 text-center text-xs tracking-widest uppercase" style={{ color: "var(--text3)" }}>
        LEGALLIS · GESTÃO JURÍDICA & FINANCEIRA
      </div>
    </div>
  );
}
