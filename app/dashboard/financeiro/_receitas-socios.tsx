"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import {
  getConfig, getAcordos, getExecucoes, getHonIniciais, getFixas, getVariaveis,
  fmtBRL, COLS,
  type ConfigEscritorio, type Acordo, type Execucao, type HonorarioInicial, type Fixa, type Variavel,
} from "@/lib/financeiro";
import { getColIndex } from "./_shared";

export function ReceitasSociosView() {
  const [config, setConfig] = useState<ConfigEscritorio>({ tipo: "individual", socios: [] });
  const [acordos, setAcordos] = useState<Acordo[]>([]);
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [honIniciais, setHonIniciais] = useState<HonorarioInicial[]>([]);
  const [fixas, setFixas] = useState<Fixa[]>([]);
  const [variaveis, setVariaveis] = useState<Variavel[]>([]);
  const [periodo, setPeriodo] = useState("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getConfig(), getAcordos(), getExecucoes(), getHonIniciais(), getFixas(), getVariaveis()])
      .then(([c, a, e, h, f, v]) => {
        setConfig(c); setAcordos(a); setExecucoes(e);
        setHonIniciais(h); setFixas(f); setVariaveis(v);
        setLoading(false);
      });
  }, []);

  const agora = new Date();

  function parseData(s: string): Date | null {
    if (!s) return null;
    const p = s.split("/");
    if (p.length === 3) return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // Converte "Jun/2026" → Date(2026, 5, 15)
  function parseMes(mes: string): Date | null {
    if (!mes) return null;
    const M = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    const parts = mes.split("/");
    if (parts.length !== 2) return null;
    const month = M.indexOf(parts[0]);
    if (month === -1) return null;
    return new Date(parseInt(parts[1]), month, 15);
  }

  // Usa data_pagamento quando preenchida; cai no campo mes como fallback
  function dentroDoFiltro(data: string, mes?: string): boolean {
    if (periodo === "todos") return true;
    const d = parseData(data) ?? parseMes(mes || "");
    if (!d) return false;
    if (periodo === "mes") return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
    if (periodo === "trimestre") {
      const t = Math.floor(agora.getMonth() / 3);
      return Math.floor(d.getMonth() / 3) === t && d.getFullYear() === agora.getFullYear();
    }
    if (periodo === "ano") return d.getFullYear() === agora.getFullYear();
    return true;
  }

  // COLS do período para despesas fixas/variáveis
  function colsDoPeriodo(): string[] {
    if (periodo === "todos") return COLS;
    const colIdx = getColIndex();
    if (periodo === "mes") return colIdx >= 0 && colIdx < COLS.length ? [COLS[colIdx]] : [];
    if (periodo === "trimestre") {
      const r: string[] = [];
      for (let i = Math.max(0, colIdx - 2); i <= Math.min(COLS.length - 1, colIdx); i++) r.push(COLS[i]);
      return r;
    }
    if (periodo === "ano") {
      const anoStart = agora.getFullYear() * 12 + 0 - (2025 * 12 + 9);
      const anoEnd = agora.getFullYear() * 12 + 11 - (2025 * 12 + 9);
      const r: string[] = [];
      for (let i = Math.max(0, anoStart); i <= Math.min(COLS.length - 1, anoEnd); i++) r.push(COLS[i]);
      return r;
    }
    return COLS;
  }

  // Despesas fixas no período
  function calcDespFixas(): number {
    const cols = colsDoPeriodo();
    return fixas.reduce((total, f) => {
      return total + cols.reduce((s, c) => s + (f.valor_fixo > 0 ? f.valor_fixo : (f.valores[c] || 0)), 0);
    }, 0);
  }

  // Despesas variáveis no período (soma das parcelas dos meses do período)
  function calcDespVariaveis(): number {
    const cols = colsDoPeriodo();
    return variaveis.reduce((total, v) => {
      return total + cols.reduce((s, c) => s + (v.meses[c] || 0), 0);
    }, 0);
  }

  const totalHonRecebido =
    acordos.filter(a => a.status === "pago" && dentroDoFiltro(a.data_pagamento, a.mes)).reduce((s, a) => s + a.honorarios, 0) +
    execucoes.filter(e => e.status === "pago" && dentroDoFiltro(e.data_pagamento, e.mes)).reduce((s, e) => s + e.honorarios, 0) +
    honIniciais.filter(h => h.status === "pago" && dentroDoFiltro(h.data_pagamento, h.mes)).reduce((s, h) => s + h.valor, 0);

  const totalPendente =
    acordos.filter(a => a.status !== "pago" && dentroDoFiltro(a.data_pagamento, a.mes)).reduce((s, a) => s + a.honorarios, 0) +
    execucoes.filter(e => e.status !== "pago" && dentroDoFiltro(e.data_pagamento, e.mes)).reduce((s, e) => s + e.honorarios, 0) +
    honIniciais.filter(h => h.status !== "pago" && dentroDoFiltro(h.data_pagamento, h.mes)).reduce((s, h) => s + h.valor, 0);

  const totalDespFixas = calcDespFixas();
  const totalDespVariaveis = calcDespVariaveis();
  const totalDespesas = totalDespFixas + totalDespVariaveis;
  const receitaLiquida = totalHonRecebido - totalDespesas;

  if (loading) return <div className="py-8 text-center" style={{ color: "var(--text3)" }}>Carregando...</div>;

  const filtroLabel = { todos: "todos os períodos", mes: "este mês", trimestre: "este trimestre", ano: "este ano" }[periodo] ?? "";

  if (config.tipo === "individual") {
    return (
      <div className="space-y-5 max-w-2xl">
        <Card>
          <p className="text-sm" style={{ color: "var(--text3)" }}>
            O escritório está configurado como individual. Ative o modo Sócios em ⚙️ Configuração para ver a distribuição.
          </p>
        </Card>
        <div className="flex items-center gap-3 flex-wrap">
          {[["todos","Todos os períodos"],["mes","Este mês"],["trimestre","Este trimestre"],["ano","Este ano"]].map(([v,l]) => (
            <button key={v} onClick={() => setPeriodo(v)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: periodo === v ? "var(--gold)" : "var(--surface2)", color: periodo === v ? "#000" : "var(--text2)", border: `1px solid ${periodo === v ? "var(--gold)" : "var(--border)"}` }}>
              {l}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Card><p className="text-xs mb-1" style={{ color: "var(--text3)" }}>Honorários recebidos</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: "#4ade80" }}>{fmtBRL(totalHonRecebido)}</p></Card>
          <Card><p className="text-xs mb-1" style={{ color: "var(--text3)" }}>Honorários pendentes</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: "#f87171" }}>{fmtBRL(totalPendente)}</p></Card>
          <Card><p className="text-xs mb-1" style={{ color: "var(--text3)" }}>Despesas ({filtroLabel})</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: "#f97316" }}>{fmtBRL(totalDespesas)}</p></Card>
          <Card><p className="text-xs mb-1" style={{ color: "var(--text3)" }}>Receita líquida</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: receitaLiquida >= 0 ? "var(--gold)" : "#f87171" }}>{fmtBRL(receitaLiquida)}</p></Card>
        </div>
      </div>
    );
  }

  const socios = config.socios.filter(s => s.nome && s.percentual > 0);

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        {[["todos","Todos os períodos"],["mes","Este mês"],["trimestre","Este trimestre"],["ano","Este ano"]].map(([v,l]) => (
          <button key={v} onClick={() => setPeriodo(v)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{ background: periodo === v ? "var(--gold)" : "var(--surface2)", color: periodo === v ? "#000" : "var(--text2)", border: `1px solid ${periodo === v ? "var(--gold)" : "var(--border)"}` }}>
            {l}
          </button>
        ))}
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card>
          <p className="text-xs mb-1" style={{ color: "var(--text3)" }}>Hon. recebidos</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: "#4ade80" }}>{fmtBRL(totalHonRecebido)}</p>
        </Card>
        <Card>
          <p className="text-xs mb-1" style={{ color: "var(--text3)" }}>Hon. pendentes</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: "#f87171" }}>{fmtBRL(totalPendente)}</p>
        </Card>
        <Card>
          <p className="text-xs mb-1" style={{ color: "var(--text3)" }}>Desp. fixas</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: "#f97316" }}>{fmtBRL(totalDespFixas)}</p>
        </Card>
        <Card>
          <p className="text-xs mb-1" style={{ color: "var(--text3)" }}>Desp. variáveis</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: "#a78bfa" }}>{fmtBRL(totalDespVariaveis)}</p>
        </Card>
        <Card>
          <p className="text-xs mb-1" style={{ color: "var(--text3)" }}>Receita líquida</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: receitaLiquida >= 0 ? "var(--gold)" : "#f87171" }}>
            {fmtBRL(receitaLiquida)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>hon. − despesas</p>
        </Card>
      </div>

      {/* Por sócio */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Participação por Sócio</h2>
        {socios.map(s => {
          const honRecebidoSocio = (totalHonRecebido * s.percentual) / 100;
          const honPendenteSocio = (totalPendente * s.percentual) / 100;
          const despSocio = (totalDespesas * s.percentual) / 100;
          const liquidoSocio = honRecebidoSocio - despSocio;
          return (
            <Card key={s.id}>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3 min-w-0 shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ background: "rgba(201,168,76,0.15)", color: "var(--gold)" }}>
                    {s.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{s.nome}</p>
                    <p className="text-xs" style={{ color: "var(--text3)" }}>{s.percentual}% de participação</p>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: "var(--text3)" }}>Hon. recebido</p>
                    <p className="font-semibold tabular-nums" style={{ color: "#4ade80" }}>{fmtBRL(honRecebidoSocio)}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: "var(--text3)" }}>Hon. pendente</p>
                    <p className="font-semibold tabular-nums" style={{ color: "#f87171" }}>{fmtBRL(honPendenteSocio)}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: "var(--text3)" }}>Despesas ({s.percentual}%)</p>
                    <p className="font-semibold tabular-nums" style={{ color: "#f97316" }}>{fmtBRL(despSocio)}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: "var(--text3)" }}>Líquido</p>
                    <p className="font-semibold tabular-nums" style={{ color: liquidoSocio >= 0 ? "var(--gold)" : "#f87171" }}>{fmtBRL(liquidoSocio)}</p>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Detalhamento */}
      <Card>
        <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text)" }}>Detalhamento ({filtroLabel})</h3>
        <div className="space-y-3">
          {/* Receitas */}
          <div>
            <p className="text-xs uppercase tracking-wider mb-2 font-semibold" style={{ color: "#4ade80" }}>Receitas</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Acordos", val: acordos.filter(a => a.status === "pago" && dentroDoFiltro(a.data_pagamento, a.mes)).reduce((s,a)=>s+a.honorarios,0) },
                { label: "Execuções", val: execucoes.filter(e => e.status === "pago" && dentroDoFiltro(e.data_pagamento, e.mes)).reduce((s,e)=>s+e.honorarios,0) },
                { label: "Hon. Iniciais", val: honIniciais.filter(h => h.status === "pago" && dentroDoFiltro(h.data_pagamento, h.mes)).reduce((s,h)=>s+h.valor,0) },
              ].map(item => (
                <div key={item.label} className="px-3 py-2 rounded-lg" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  <p className="text-xs mb-0.5" style={{ color: "var(--text3)" }}>{item.label}</p>
                  <p className="font-bold tabular-nums text-sm" style={{ color: "#4ade80" }}>{fmtBRL(item.val)}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Despesas */}
          <div>
            <p className="text-xs uppercase tracking-wider mb-2 font-semibold" style={{ color: "#f97316" }}>Despesas</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="px-3 py-2 rounded-lg" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <p className="text-xs mb-0.5" style={{ color: "var(--text3)" }}>Fixas ({colsDoPeriodo().length} mês(es))</p>
                <p className="font-bold tabular-nums text-sm" style={{ color: "#f97316" }}>{fmtBRL(totalDespFixas)}</p>
              </div>
              <div className="px-3 py-2 rounded-lg" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <p className="text-xs mb-0.5" style={{ color: "var(--text3)" }}>Variáveis (parcelas do período)</p>
                <p className="font-bold tabular-nums text-sm" style={{ color: "#a78bfa" }}>{fmtBRL(totalDespVariaveis)}</p>
              </div>
            </div>
          </div>
          {/* Resultado */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ background: receitaLiquida >= 0 ? "rgba(201,168,76,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${receitaLiquida >= 0 ? "rgba(201,168,76,0.3)" : "rgba(239,68,68,0.3)"}` }}>
            <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>Resultado líquido do período</span>
            <span className="font-bold text-lg tabular-nums" style={{ color: receitaLiquida >= 0 ? "var(--gold)" : "#f87171" }}>{fmtBRL(receitaLiquida)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
