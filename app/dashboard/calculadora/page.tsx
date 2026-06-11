"use client";

import { useState, useCallback } from "react";
import { fetchAPI, fmtBRL, fmtPct, fmtFator } from "@/lib/api";

// ── tipos ────────────────────────────────────────────────────────────────────
interface Lancamento { id: number; data: string; valor: string; }
interface ResultRow {
  data_cobranca: string; valor_original: number; fator_correcao: number;
  debito_corrigido: number; juros_pct: number; juros_valor: number; total: number;
}
interface Summary {
  subtotal_principal: number; subtotal_juros: number; subtotal_base: number;
  honorarios_pct?: number; honorarios_valor?: number;
  multa_523?: boolean; multa_valor?: number;
  aplicar_dobro?: boolean; subtotal_material?: number;
  dano_moral?: number; total_geral: number;
}

// ── componentes base ──────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text3)" }}>{children}</span>;
}
function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
      onFocus={e => (e.target.style.borderColor = "var(--gold)")}
      onBlur={e => (e.target.style.borderColor = "var(--border)")}
    />
  );
}
function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
    >
      {children}
    </select>
  );
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-5 ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1.5 rounded-lg mb-4 text-sm font-semibold"
      style={{ background: "rgba(201,168,76,0.08)", borderLeft: "3px solid var(--gold)", color: "var(--gold)" }}>
      {children}
    </div>
  );
}

// ── página ────────────────────────────────────────────────────────────────────
let _id = 1;

export default function CalculadoraPage() {
  const today = new Date().toISOString().split("T")[0];

  const [tribunal, setTribunal] = useState("TJMG");
  const [modo, setModo] = useState("execucao");
  const [dataCalculo, setDataCalculo] = useState(today);
  const [honorariosPct, setHonorariosPct] = useState("20");
  const [multa523, setMulta523] = useState(false);
  const [aplicarDobro, setAplicarDobro] = useState(false);
  const [danoMoral, setDanoMoral] = useState("");
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([
    { id: _id++, data: "", valor: "" },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const addLancamento = () =>
    setLancamentos(prev => [...prev, { id: _id++, data: "", valor: "" }]);

  const removeLancamento = (id: number) =>
    setLancamentos(prev => prev.filter(l => l.id !== id));

  const updateLancamento = (id: number, field: "data" | "valor", value: string) =>
    setLancamentos(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));

  const parseBRL = (s: string) => {
    const clean = s.replace(/\./g, "").replace(",", ".");
    return parseFloat(clean) || 0;
  };

  const calcular = useCallback(async () => {
    setError("");
    const validos = lancamentos.filter(l => l.data && l.valor);
    if (!validos.length) { setError("Adicione pelo menos um lançamento."); return; }
    if (!dataCalculo) { setError("Informe a data do cálculo."); return; }

    setLoading(true);
    try {
      const result = await fetchAPI("/calculadora/calcular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lancamentos: validos.map(l => ({
            data_cobranca: l.data,
            valor: parseBRL(l.valor),
          })),
          data_calculo: dataCalculo,
          tribunal,
          honorarios_pct: parseFloat(honorariosPct) || 20,
          multa_523: multa523,
          modo,
          aplicar_dobro: aplicarDobro,
          dano_moral: parseBRL(danoMoral),
        }),
      });
      setRows(result.rows);
      setSummary(result.summary);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro no cálculo");
    } finally {
      setLoading(false);
    }
  }, [lancamentos, dataCalculo, tribunal, honorariosPct, multa523, modo, aplicarDobro, danoMoral]);

  const atualizarIndices = async () => {
    setAtualizando(true);
    try {
      await fetchAPI("/calculadora/indices/atualizar", { method: "POST" });
      setError("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setTimeout(() => setAtualizando(false), 2000);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>
            Calculadora Jurídica
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text3)" }}>
            Correção monetária e juros — TJMG / TJSP
          </p>
        </div>
        <button
          onClick={atualizarIndices}
          disabled={atualizando}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}
        >
          <svg className={`w-4 h-4 ${atualizando ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {atualizando ? "Atualizando..." : "Atualizar índices"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Configurações ── */}
        <div className="lg:col-span-1 space-y-5">
          <Card>
            <SectionTitle>Configurações</SectionTitle>
            <div className="space-y-4">
              <div>
                <Label>Tribunal</Label>
                <Select value={tribunal} onChange={e => setTribunal(e.target.value)} className="mt-1">
                  <option value="TJMG">TJMG — Tribunal de Justiça de MG</option>
                  <option value="TJSP">TJSP — Tribunal de Justiça de SP</option>
                </Select>
              </div>
              <div>
                <Label>Modo de cálculo</Label>
                <Select value={modo} onChange={e => setModo(e.target.value)} className="mt-1">
                  <option value="execucao">Cumprimento de sentença</option>
                  <option value="inicial">Petição inicial</option>
                </Select>
              </div>
              <div>
                <Label>Data-base do cálculo</Label>
                <Input type="date" value={dataCalculo} onChange={e => setDataCalculo(e.target.value)} className="mt-1" />
              </div>

              {modo === "execucao" && (
                <>
                  <div>
                    <Label>Honorários advocatícios (%)</Label>
                    <Input type="number" value={honorariosPct} onChange={e => setHonorariosPct(e.target.value)}
                      min="0" max="100" step="0.5" className="mt-1" />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={multa523} onChange={e => setMulta523(e.target.checked)}
                      className="rounded accent-[#C9A84C]" />
                    <span className="text-sm" style={{ color: "var(--text2)" }}>Multa art. 523 §1º CPC (10%)</span>
                  </label>
                </>
              )}

              {modo === "inicial" && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={aplicarDobro} onChange={e => setAplicarDobro(e.target.checked)}
                      className="accent-[#C9A84C]" />
                    <span className="text-sm" style={{ color: "var(--text2)" }}>Repetição em dobro (CDC art. 42)</span>
                  </label>
                  <div>
                    <Label>Dano moral (R$)</Label>
                    <Input type="text" value={danoMoral} onChange={e => setDanoMoral(e.target.value)}
                      placeholder="0,00" className="mt-1" />
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>

        {/* ── Lançamentos ── */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <SectionTitle>Lançamentos</SectionTitle>

            {/* Cabeçalho */}
            <div className="grid grid-cols-12 gap-2 mb-2 px-1">
              <span className="col-span-5 text-xs uppercase tracking-wider" style={{ color: "var(--text3)" }}>Data da cobrança</span>
              <span className="col-span-5 text-xs uppercase tracking-wider" style={{ color: "var(--text3)" }}>Valor (R$)</span>
              <span className="col-span-2" />
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {lancamentos.map((l, i) => (
                <div key={l.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Input type="date" value={l.data} onChange={e => updateLancamento(l.id, "data", e.target.value)} />
                  </div>
                  <div className="col-span-5">
                    <Input type="text" value={l.valor} onChange={e => updateLancamento(l.id, "valor", e.target.value)}
                      placeholder="0,00" />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    {lancamentos.length > 1 && (
                      <button onClick={() => removeLancamento(l.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10"
                        style={{ color: "var(--text3)" }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={addLancamento}
              className="mt-3 flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "var(--gold)", border: "1px dashed var(--gold)", background: "rgba(201,168,76,0.05)" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Adicionar lançamento
            </button>
          </Card>

          {error && (
            <div className="px-4 py-3 rounded-lg text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
              {error}
            </div>
          )}

          <button onClick={calcular} disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-base transition-colors flex items-center justify-center gap-2"
            style={{ background: loading ? "var(--surface2)" : "var(--gold)", color: loading ? "var(--text3)" : "#000" }}>
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Calculando...
              </>
            ) : "Calcular"}
          </button>
        </div>
      </div>

      {/* ── Resultados ── */}
      {rows.length > 0 && summary && (
        <div className="space-y-5">
          <Card>
            <SectionTitle>Demonstrativo de débito</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Data", "Valor Original", "Fator", "Débito Corrigido", "Juros %", "Valor Juros", "Total"].map(h => (
                      <th key={h} className="pb-2 pt-1 text-left font-medium text-xs pr-4" style={{ color: "var(--text3)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                      <td className="py-2 pr-4 tabular-nums" style={{ color: "var(--text2)" }}>{r.data_cobranca}</td>
                      <td className="py-2 pr-4 tabular-nums">{fmtBRL(r.valor_original)}</td>
                      <td className="py-2 pr-4 tabular-nums text-xs">{fmtFator(r.fator_correcao)}</td>
                      <td className="py-2 pr-4 tabular-nums">{fmtBRL(r.debito_corrigido)}</td>
                      <td className="py-2 pr-4 tabular-nums text-xs">{fmtPct(r.juros_pct)}</td>
                      <td className="py-2 pr-4 tabular-nums">{fmtBRL(r.juros_valor)}</td>
                      <td className="py-2 font-semibold tabular-nums" style={{ color: "var(--gold)" }}>{fmtBRL(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <SectionTitle>Resumo do cálculo</SectionTitle>
            <div className="space-y-2 text-sm max-w-md">
              <SummaryRow label="Débito corrigido (principal)" value={fmtBRL(summary.subtotal_principal)} />
              <SummaryRow label="Juros moratórios" value={fmtBRL(summary.subtotal_juros)} />
              <SummaryRow label="Subtotal" value={fmtBRL(summary.subtotal_base)} />

              {modo === "execucao" && summary.honorarios_valor !== undefined && (
                <SummaryRow label={`Honorários advocatícios (${summary.honorarios_pct}%)`} value={fmtBRL(summary.honorarios_valor)} />
              )}
              {modo === "execucao" && summary.multa_523 && summary.multa_valor !== undefined && (
                <SummaryRow label="Multa art. 523 §1º CPC (10%)" value={fmtBRL(summary.multa_valor)} />
              )}
              {modo === "inicial" && summary.aplicar_dobro && summary.subtotal_material !== undefined && (
                <SummaryRow label="Repetição em dobro (CDC art. 42)" value={fmtBRL(summary.subtotal_material)} />
              )}
              {modo === "inicial" && summary.dano_moral !== undefined && summary.dano_moral > 0 && (
                <SummaryRow label="Dano moral" value={fmtBRL(summary.dano_moral)} />
              )}

              <div className="pt-2 mt-2 flex items-center justify-between rounded-lg px-3 py-2.5"
                style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)" }}>
                <span className="font-semibold" style={{ color: "var(--gold)" }}>
                  {modo === "inicial" ? "Valor da causa" : "Total geral"}
                </span>
                <span className="font-bold text-lg tabular-nums" style={{ color: "var(--gold)" }}>
                  {fmtBRL(summary.total_geral)}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid var(--border)" }}>
      <span style={{ color: "var(--text2)" }}>{label}</span>
      <span className="tabular-nums font-medium" style={{ color: "var(--text)" }}>{value}</span>
    </div>
  );
}
