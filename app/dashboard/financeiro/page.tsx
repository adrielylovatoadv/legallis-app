"use client";

import { useEffect, useState, useCallback } from "react";
import { getDash, type DashFinanceiro } from "@/lib/financeiro";
import { getCurrentMes } from "./_shared";
import { DashView } from "./_dashboard";
import { AcordosView } from "./_acordos";
import { ExecucoesView } from "./_execucoes";
import { HonIniciaisView } from "./_honorarios-iniciais";
import { AlertasPendentes, FixasView } from "./_fixas";
import { VariaveisView } from "./_variaveis";
import { ConfiguracaoView } from "./_configuracao";
import { ReceitasSociosView } from "./_receitas-socios";

// ── abas ──────────────────────────────────────────────────────────────────────
const ABAS = ["📊 Dashboard","🤝 Acordos","⚖️ Execuções","💼 Hon. Iniciais","🏢 Desp. Fixas","🛒 Desp. Variáveis","⚙️ Configuração","💰 Receitas Sócios"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function FinanceiroPage() {
  const [aba, setAba] = useState(0);
  const [dash, setDash] = useState<DashFinanceiro | null>(null);

  const mesAtualLabel = getCurrentMes();

  const loadDash = useCallback(async () => { setDash(await getDash()); }, []);
  useEffect(() => { loadDash(); }, [loadDash]);

  const tabStyle = (i: number) => ({
    background: aba === i ? "var(--gold)" : "var(--surface2)",
    color: aba === i ? "#000" : "var(--text2)",
    border: "1px solid var(--border)",
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold" style={{ color:"var(--text)" }}>Financeiro Escritório</h1>
          <p className="text-sm mt-0.5" style={{ color:"var(--text3)" }}>
            Competência: <span className="font-semibold" style={{ color: "var(--gold)" }}>{mesAtualLabel}</span>
          </p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 flex-wrap">
        {ABAS.map((label, i) => (
          <button key={i} onClick={() => setAba(i)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            style={tabStyle(i)}>
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {aba === 0 && (dash
        ? <div className="space-y-5"><DashView data={dash} /><AlertasPendentes /></div>
        : <div className="py-8 text-center" style={{ color:"var(--text3)" }}>Carregando...</div>)}
      {aba === 1 && <AcordosView reload={loadDash} />}
      {aba === 2 && <ExecucoesView reload={loadDash} />}
      {aba === 3 && <HonIniciaisView reload={loadDash} />}
      {aba === 4 && <FixasView />}
      {aba === 5 && <VariaveisView />}
      {aba === 6 && <ConfiguracaoView />}
      {aba === 7 && <ReceitasSociosView />}
    </div>
  );
}
