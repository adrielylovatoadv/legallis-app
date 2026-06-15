"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { fetchAPI, fmtBRL, fmtPct, fmtFator } from "@/lib/api";
import { canExport } from "@/lib/plans";
import type { Plan } from "@/lib/plans";
import { exportarExcel, exportarPDF } from "@/lib/export-calc";
import type { ExportDoc } from "@/lib/export-calc";

// ── tipos ─────────────────────────────────────────────────────
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
interface HonorarioResult {
  valor_original: number; valor_corrigido: number; corr_factor: number;
  variacao_pct: number; meses_corr: number; indice_label: string;
  honorarios_pct: number; honorario_valor: number;
  periodo: string; numero_processo: string;
}
interface RevisionalResult {
  tipo: string; pv: number; n_parcelas: number;
  taxa_contratada_pct: number; taxa_referencia_pct: number;
  pmt_contratada: number; pmt_justa: number;
  excesso_mensal: number; total_excesso: number;
  parcelas: { parcela: number; data_vencimento: string; pmt_contratada: number; pmt_justa: number; excesso: number }[];
  total_parcelas: number;
}

// ── componentes base ───────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text3)" }}>{children}</span>;
}
function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={`w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors ${className}`}
      style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
      onFocus={e => (e.target.style.borderColor = "var(--gold)")}
      onBlur={e => (e.target.style.borderColor = "var(--border)")} />
  );
}
function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props}
      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
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
function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid var(--border)" }}>
      <span style={{ color: highlight ? "var(--text)" : "var(--text2)", fontWeight: highlight ? 600 : 400 }}>{label}</span>
      <span className="tabular-nums font-medium" style={{ color: highlight ? "var(--gold)" : "var(--text)" }}>{value}</span>
    </div>
  );
}

// ── Botões de exportação ──────────────────────────────────────────────────────
function BotoesExport({ doc, nome }: { doc: ExportDoc; nome: string }) {
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const handlePDF = async () => {
    setExporting("pdf");
    try { await exportarPDF(doc, nome); } finally { setExporting(null); }
  };
  const handleExcel = async () => {
    setExporting("excel");
    try { await exportarExcel(doc, nome); } finally { setExporting(null); }
  };

  return (
    <div className="flex gap-2 justify-end mt-4">
      <button onClick={handleExcel} disabled={!!exporting}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-opacity"
        style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)", opacity: exporting ? 0.6 : 1 }}>
        {exporting === "excel" ? "⏳" : "📊"} Excel
      </button>
      <button onClick={handlePDF} disabled={!!exporting}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-opacity"
        style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", opacity: exporting ? 0.6 : 1 }}>
        {exporting === "pdf" ? "⏳" : "📄"} PDF
      </button>
    </div>
  );
}

// ── ordem correta: Petição Inicial ANTES de Cumprimento de Sentença ──
const MODOS = [
  { value: "inicial", label: "Petição Inicial" },
  { value: "execucao", label: "Cumprimento de Sentença" },
  { value: "honorario", label: "Execução de Honorário" },
  { value: "revisional_veiculo", label: "Revisional de Veículo" },
  { value: "revisional_emprestimo", label: "Revisional de Contratos Bancários" },
];

// ── tipos de irregularidade para Revisional de Contratos ──
const IRREGULARIDADES = [
  { key: "juros_abusivos", label: "Juros abusivos" },
  { key: "tarifas_indevidas", label: "Tarifas indevidas" },
  { key: "venda_casada", label: "Venda casada" },
  { key: "seguros_embutidos", label: "Seguros embutidos" },
];

// ── tipos de seguro para Revisional de Veículo e Contratos ──
const TIPOS_SEGURO = [
  "Seguro prestamista",
  "Seguro proteção financeira",
  "Seguro desemprego",
  "Seguro acidentes pessoais",
  "Seguro de vida",
  "Outros seguros",
];

let _id = 1;

interface UserProfile { name?: string; oab?: Array<{ state: string; number: string }>; company?: { name?: string } }

// ── Componente Formação Rápida ─────────────────────────────────
function FormacaoRapida({ onGerar }: {
  onGerar: (lancamentos: { data: string; valor: string }[]) => void;
}) {
  const [qtd, setQtd] = useState("12");
  const [dataInicial, setDataInicial] = useState("");
  const [valor, setValor] = useState("");
  const [periodicidade, setPeriodicidade] = useState("mensal");
  const [aberto, setAberto] = useState(false);

  const gerar = () => {
    const n = Math.min(parseInt(qtd) || 1, 480);
    if (!valor) return;
    const lancamentos: { data: string; valor: string }[] = [];

    let dataBase = dataInicial ? new Date(dataInicial + "T12:00:00") : null;

    for (let i = 0; i < n; i++) {
      let dataStr = "";
      if (dataBase) {
        const d = new Date(dataBase);
        if (periodicidade === "diario") d.setDate(d.getDate() + i);
        else if (periodicidade === "semanal") d.setDate(d.getDate() + i * 7);
        else if (periodicidade === "mensal") d.setMonth(d.getMonth() + i);
        else if (periodicidade === "anual") d.setFullYear(d.getFullYear() + i);
        dataStr = d.toISOString().split("T")[0];
      }
      lancamentos.push({ data: dataStr, valor });
    }
    onGerar(lancamentos);
    setAberto(false);
  };

  return (
    <div>
      <button onClick={() => setAberto(!aberto)}
        className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg"
        style={{ color: "var(--gold)", border: "1px dashed var(--gold)", background: "rgba(201,168,76,0.05)" }}>
        ⚡ Formação Rápida de Lançamentos
      </button>
      {aberto && (
        <div className="mt-3 p-4 rounded-xl space-y-3" style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--gold)" }}>Formação Rápida de Lançamentos</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-xs mb-1 block" style={{ color: "var(--text3)" }}>Quantidade (máx. 480)</span>
              <input type="number" value={qtd} onChange={e => setQtd(e.target.value)} min="1" max="480"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
            <div>
              <span className="text-xs mb-1 block" style={{ color: "var(--text3)" }}>Data inicial (opcional)</span>
              <input type="date" value={dataInicial} onChange={e => setDataInicial(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
            <div>
              <span className="text-xs mb-1 block" style={{ color: "var(--text3)" }}>Valor padrão (R$)</span>
              <input type="text" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
            <div>
              <span className="text-xs mb-1 block" style={{ color: "var(--text3)" }}>Periodicidade</span>
              <select value={periodicidade} onChange={e => setPeriodicidade(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                <option value="diario">Diário</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={gerar}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "var(--gold)", color: "#000" }}>
              Gerar {qtd || "0"} lançamentos
            </button>
            <button onClick={() => setAberto(false)}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border)" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente Seguros Embutidos ───────────────────────────────
function SegurosEmbutidos({ valores, onChange }: {
  valores: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const total = TIPOS_SEGURO.reduce((s, t) => {
    const v = parseFloat((valores[t] || "0").replace(/\./g, "").replace(",", ".")) || 0;
    return s + v;
  }, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#f59e0b" }}>🛡️ Seguros Embutidos</span>
        {total > 0 && <span className="text-xs font-semibold" style={{ color: "#f87171" }}>Total: {fmtBRL(total)}</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {TIPOS_SEGURO.map(tipo => (
          <div key={tipo}>
            <span className="text-xs mb-1 block" style={{ color: "var(--text3)" }}>{tipo} (R$)</span>
            <input
              type="text"
              value={valores[tipo] || ""}
              onChange={e => onChange({ ...valores, [tipo]: e.target.value })}
              placeholder="0,00"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
          </div>
        ))}
      </div>
      {total > 0 && (
        <div className="px-3 py-2 rounded-lg text-xs"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
          ⚠️ Total de seguros embutidos potencialmente restituíveis: <strong>{fmtBRL(total)}</strong>
        </div>
      )}
    </div>
  );
}

export default function CalculadoraPage() {
  const { data: session } = useSession();
  const plan = (session?.user.plan ?? "basic") as Plan;
  const today = new Date().toISOString().split("T")[0];
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetch(`/api/usuarios/${session.user.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setUserProfile(d))
        .catch(() => {});
    }
  }, [session?.user?.id]);

  const advogadoInfo = userProfile ? {
    nome: userProfile.name,
    oab: userProfile.oab?.[0]?.number,
    estado: userProfile.oab?.[0]?.state,
    escritorio: userProfile.company?.name,
  } : undefined;

  // ── modos principais ──
  const [tribunal, setTribunal] = useState("TJMG");
  const [modo, setModo] = useState("inicial");
  const [dataCalculo, setDataCalculo] = useState(today);
  const [honorariosPct, setHonorariosPct] = useState("20");
  const [multa523, setMulta523] = useState(false);
  const [aplicarDobro, setAplicarDobro] = useState(false);
  const [danoMoral, setDanoMoral] = useState("");
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([{ id: _id++, data: "", valor: "" }]);

  // ── modo honorário ──
  const [honValor, setHonValor] = useState("");
  const [honDataOrigem, setHonDataOrigem] = useState("");
  const [honDataCalc, setHonDataCalc] = useState(today);
  const [honTribunal, setHonTribunal] = useState("TJMG");
  const [honPct, setHonPct] = useState("20");
  const [honProcesso, setHonProcesso] = useState("");

  // ── modo revisional ──
  const [revPV, setRevPV] = useState("");
  const [revPMT, setRevPMT] = useState("");
  const [revN, setRevN] = useState("");
  const [revDataContrat, setRevDataContrat] = useState("");
  const [revDataCalc, setRevDataCalc] = useState(today);
  const [revTaxaBacen, setRevTaxaBacen] = useState("");
  const [segurosVeiculo, setSegurosVeiculo] = useState<Record<string, string>>({});
  const [segurosContrato, setSegurosContrato] = useState<Record<string, string>>({});
  const [irregularidades, setIrregularidades] = useState<Record<string, boolean>>({});

  // ── estado ──
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [honResult, setHonResult] = useState<HonorarioResult | null>(null);
  const [revResult, setRevResult] = useState<RevisionalResult | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [processoInfo, setProcessoInfo] = useState({ numero: "", parte: "", advogado: "" });

  const parseBRL = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
  const totalSeguros = (seg: Record<string, string>) =>
    Object.values(seg).reduce((s, v) => s + parseBRL(v), 0);

  const addLancamento = () => setLancamentos(p => [...p, { id: _id++, data: "", valor: "" }]);
  const removeLancamento = (id: number) => setLancamentos(p => p.filter(l => l.id !== id));
  const updateLancamento = (id: number, f: "data" | "valor", v: string) =>
    setLancamentos(p => p.map(l => l.id === id ? { ...l, [f]: v } : l));

  const gerarLancamentos = (novos: { data: string; valor: string }[]) => {
    setLancamentos(novos.map(n => ({ id: _id++, ...n })));
  };

  const isRevisional = modo === "revisional_veiculo" || modo === "revisional_emprestimo";

  const calcular = useCallback(async () => {
    setError(""); setRows([]); setSummary(null); setHonResult(null); setRevResult(null);
    setLoading(true);
    try {
      if (modo === "honorario") {
        const r = await fetchAPI("/calculadora/honorario", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            valor_causa: parseBRL(honValor), data_origem: honDataOrigem,
            data_calculo: honDataCalc, tribunal: honTribunal,
            honorarios_pct: parseFloat(honPct) || 20, numero_processo: honProcesso,
          }),
        });
        setHonResult(r);
      } else if (isRevisional) {
        const seguros = modo === "revisional_veiculo" ? segurosVeiculo : segurosContrato;
        const r = await fetchAPI("/calculadora/revisional", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: modo === "revisional_veiculo" ? "veiculo" : "emprestimo",
            pv: parseBRL(revPV), pmt_contratada: parseBRL(revPMT),
            n_parcelas: parseInt(revN) || 0,
            data_contratacao: revDataContrat, data_calculo: revDataCalc,
            taxa_bacen: revTaxaBacen ? parseFloat(revTaxaBacen) : null,
            total_seguros: totalSeguros(seguros),
          }),
        });
        setRevResult(r);
      } else {
        const validos = lancamentos.filter(l => l.data && l.valor);
        if (!validos.length) { setError("Adicione pelo menos um lançamento."); setLoading(false); return; }
        const r = await fetchAPI("/calculadora/calcular", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lancamentos: validos.map(l => ({ data_cobranca: l.data, valor: parseBRL(l.valor) })),
            data_calculo: dataCalculo, tribunal,
            honorarios_pct: parseFloat(honorariosPct) || 20,
            multa_523: multa523, modo,
            aplicar_dobro: aplicarDobro, dano_moral: parseBRL(danoMoral),
          }),
        });
        setRows(r.rows); setSummary(r.summary);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro no cálculo");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, lancamentos, dataCalculo, tribunal, honorariosPct, multa523, aplicarDobro, danoMoral,
    honValor, honDataOrigem, honDataCalc, honTribunal, honPct, honProcesso,
    revPV, revPMT, revN, revDataContrat, revDataCalc, revTaxaBacen, isRevisional,
    segurosVeiculo, segurosContrato]);

  const atualizarIndices = async () => {
    setAtualizando(true);
    try { await fetchAPI("/calculadora/indices/atualizar", { method: "POST" }); }
    catch { /* ignore */ }
    setTimeout(() => setAtualizando(false), 2000);
  };

  const exportarPDF = () => {
    if (!canExport(plan, "pdf")) { alert("Seu plano não inclui exportação em PDF."); return; }
    window.print();
  };

  const clearResults = () => { setRows([]); setSummary(null); setHonResult(null); setRevResult(null); setError(""); };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>Calculadora Jurídica</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text3)" }}>Correção monetária e juros — TJMG / TJSP</p>
        </div>
        <div className="flex gap-2">
          {(rows.length > 0 || honResult || revResult) && (
            <button onClick={exportarPDF}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "var(--gold)", color: "#000" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF
            </button>
          )}
          <button onClick={atualizarIndices} disabled={atualizando}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}>
            <svg className={`w-4 h-4 ${atualizando ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {atualizando ? "Atualizando..." : "Atualizar índices"}
          </button>
        </div>
      </div>

      {/* Seletor de modo */}
      <div className="flex flex-wrap gap-2">
        {MODOS.map(m => (
          <button key={m.value} onClick={() => { setModo(m.value); clearResults(); }}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: modo === m.value ? "rgba(201,168,76,0.15)" : "var(--surface2)",
              color: modo === m.value ? "var(--gold)" : "var(--text3)",
              border: `1px solid ${modo === m.value ? "var(--gold)" : "var(--border)"}`,
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Modo Petição Inicial / Cumprimento de Sentença ─── */}
      {(modo === "execucao" || modo === "inicial") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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
                  <Label>Data-base do cálculo</Label>
                  <Input type="date" value={dataCalculo} onChange={e => setDataCalculo(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Nº do processo</Label>
                  <Input type="text" value={processoInfo.numero} onChange={e => setProcessoInfo(p => ({ ...p, numero: e.target.value }))}
                    placeholder="0000000-00.0000.0.00.0000" className="mt-1" />
                </div>
                <div>
                  <Label>Parte / Cliente</Label>
                  <Input type="text" value={processoInfo.parte} onChange={e => setProcessoInfo(p => ({ ...p, parte: e.target.value }))}
                    placeholder="Nome da parte" className="mt-1" />
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
                        style={{ accentColor: "var(--gold)" }} />
                      <span className="text-sm" style={{ color: "var(--text2)" }}>Multa art. 523 §1º CPC (10%)</span>
                    </label>
                  </>
                )}
                {modo === "inicial" && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={aplicarDobro} onChange={e => setAplicarDobro(e.target.checked)}
                        style={{ accentColor: "var(--gold)" }} />
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

          <div className="lg:col-span-2 space-y-5">
            <Card>
              <SectionTitle>Lançamentos</SectionTitle>
              <div className="grid grid-cols-12 gap-2 mb-2 px-1">
                <span className="col-span-5 text-xs uppercase tracking-wider" style={{ color: "var(--text3)" }}>Data da cobrança</span>
                <span className="col-span-5 text-xs uppercase tracking-wider" style={{ color: "var(--text3)" }}>Valor (R$)</span>
                <span className="col-span-2" />
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {lancamentos.map(l => (
                  <div key={l.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Input type="date" value={l.data} onChange={e => updateLancamento(l.id, "data", e.target.value)} />
                    </div>
                    <div className="col-span-5">
                      <Input type="text" value={l.valor} onChange={e => updateLancamento(l.id, "valor", e.target.value)} placeholder="0,00" />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      {lancamentos.length > 1 && (
                        <button onClick={() => removeLancamento(l.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10"
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
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={addLancamento}
                  className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg"
                  style={{ color: "var(--gold)", border: "1px dashed var(--gold)", background: "rgba(201,168,76,0.05)" }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Adicionar lançamento
                </button>
                <FormacaoRapida onGerar={gerarLancamentos} />
              </div>
            </Card>
            {error && (
              <div className="px-4 py-3 rounded-lg text-sm"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
                {error}
              </div>
            )}
            <button onClick={calcular} disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
              style={{ background: loading ? "var(--surface2)" : "var(--gold)", color: loading ? "var(--text3)" : "#000" }}>
              {loading ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Calculando...</> : "Calcular"}
            </button>
          </div>
        </div>
      )}

      {/* ── Modo Honorário ──────────────────────────────────────── */}
      {modo === "honorario" && (
        <Card>
          <SectionTitle>Execução de Honorário</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div><Label>Valor da Causa (R$)</Label>
                <Input type="text" value={honValor} onChange={e => setHonValor(e.target.value)} placeholder="0,00" className="mt-1" /></div>
              <div><Label>Data de origem</Label>
                <Input type="date" value={honDataOrigem} onChange={e => setHonDataOrigem(e.target.value)} className="mt-1" /></div>
              <div><Label>Data do cálculo</Label>
                <Input type="date" value={honDataCalc} onChange={e => setHonDataCalc(e.target.value)} className="mt-1" /></div>
            </div>
            <div className="space-y-4">
              <div><Label>Tribunal</Label>
                <Select value={honTribunal} onChange={e => setHonTribunal(e.target.value)} className="mt-1">
                  <option value="TJMG">TJMG (INPC/IPCAe)</option>
                  <option value="TJSP">TJSP (Tabela Prática)</option>
                </Select></div>
              <div><Label>Percentual de honorário (%)</Label>
                <Input type="number" value={honPct} onChange={e => setHonPct(e.target.value)} min="0" max="100" step="0.5" className="mt-1" /></div>
              <div><Label>Número do processo</Label>
                <Input type="text" value={honProcesso} onChange={e => setHonProcesso(e.target.value)}
                  placeholder="0000000-00.0000.0.00.0000" className="mt-1" /></div>
            </div>
          </div>
          {error && <div className="mt-4 px-4 py-3 rounded-lg text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>{error}</div>}
          <button onClick={calcular} disabled={loading}
            className="mt-4 w-full py-3 rounded-xl font-semibold text-base"
            style={{ background: loading ? "var(--surface2)" : "var(--gold)", color: loading ? "var(--text3)" : "#000" }}>
            {loading ? "Calculando..." : "Calcular honorário"}
          </button>
        </Card>
      )}

      {/* ── Revisional de Veículo ─────────────────────────────── */}
      {modo === "revisional_veiculo" && (
        <Card>
          <SectionTitle>Revisional de Veículo</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div><Label>Valor financiado — PV (R$)</Label>
                <Input type="text" value={revPV} onChange={e => setRevPV(e.target.value)} placeholder="0,00" className="mt-1" /></div>
              <div><Label>Parcela contratada (R$)</Label>
                <Input type="text" value={revPMT} onChange={e => setRevPMT(e.target.value)} placeholder="0,00" className="mt-1" /></div>
              <div><Label>Número de parcelas</Label>
                <Input type="number" value={revN} onChange={e => setRevN(e.target.value)} min="1" className="mt-1" /></div>
            </div>
            <div className="space-y-4">
              <div><Label>Data da contratação</Label>
                <Input type="date" value={revDataContrat} onChange={e => setRevDataContrat(e.target.value)} className="mt-1" /></div>
              <div><Label>Data do cálculo</Label>
                <Input type="date" value={revDataCalc} onChange={e => setRevDataCalc(e.target.value)} className="mt-1" /></div>
              <div><Label>Taxa BACEN de referência (% a.m.) — opcional</Label>
                <Input type="number" value={revTaxaBacen} onChange={e => setRevTaxaBacen(e.target.value)}
                  placeholder="Taxa média de mercado" step="0.01" className="mt-1" /></div>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <SegurosEmbutidos valores={segurosVeiculo} onChange={setSegurosVeiculo} />
          </div>
          {error && <div className="mt-4 px-4 py-3 rounded-lg text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>{error}</div>}
          <button onClick={calcular} disabled={loading}
            className="mt-4 w-full py-3 rounded-xl font-semibold text-base"
            style={{ background: loading ? "var(--surface2)" : "var(--gold)", color: loading ? "var(--text3)" : "#000" }}>
            {loading ? "Calculando..." : "Calcular revisional"}
          </button>
        </Card>
      )}

      {/* ── Revisional de Contratos Bancários ────────────────── */}
      {modo === "revisional_emprestimo" && (
        <Card>
          <SectionTitle>Revisional de Contratos Bancários</SectionTitle>
          <div className="mb-4">
            <p className="text-xs mb-2" style={{ color: "var(--text3)" }}>Selecione as irregularidades identificadas no contrato:</p>
            <div className="flex flex-wrap gap-2">
              {IRREGULARIDADES.map(irr => (
                <label key={irr.key} className="flex items-center gap-1.5 cursor-pointer text-sm px-3 py-1.5 rounded-lg"
                  style={{ background: irregularidades[irr.key] ? "rgba(201,168,76,0.12)" : "var(--surface2)", border: `1px solid ${irregularidades[irr.key] ? "var(--gold)" : "var(--border)"}`, color: irregularidades[irr.key] ? "var(--gold)" : "var(--text2)" }}>
                  <input type="checkbox" checked={!!irregularidades[irr.key]}
                    onChange={e => setIrregularidades(p => ({ ...p, [irr.key]: e.target.checked }))}
                    className="hidden" />
                  {irregularidades[irr.key] ? "✓" : "○"} {irr.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div><Label>Valor financiado — PV (R$)</Label>
                <Input type="text" value={revPV} onChange={e => setRevPV(e.target.value)} placeholder="0,00" className="mt-1" /></div>
              <div><Label>Parcela contratada (R$)</Label>
                <Input type="text" value={revPMT} onChange={e => setRevPMT(e.target.value)} placeholder="0,00" className="mt-1" /></div>
              <div><Label>Número de parcelas</Label>
                <Input type="number" value={revN} onChange={e => setRevN(e.target.value)} min="1" className="mt-1" /></div>
            </div>
            <div className="space-y-4">
              <div><Label>Data da contratação</Label>
                <Input type="date" value={revDataContrat} onChange={e => setRevDataContrat(e.target.value)} className="mt-1" /></div>
              <div><Label>Data do cálculo</Label>
                <Input type="date" value={revDataCalc} onChange={e => setRevDataCalc(e.target.value)} className="mt-1" /></div>
              <div><Label>Taxa BACEN de referência (% a.m.) — opcional</Label>
                <Input type="number" value={revTaxaBacen} onChange={e => setRevTaxaBacen(e.target.value)}
                  placeholder="Taxa média de mercado" step="0.01" className="mt-1" /></div>
            </div>
          </div>
          {irregularidades.seguros_embutidos && (
            <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
              <SegurosEmbutidos valores={segurosContrato} onChange={setSegurosContrato} />
            </div>
          )}
          {error && <div className="mt-4 px-4 py-3 rounded-lg text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>{error}</div>}
          <button onClick={calcular} disabled={loading}
            className="mt-4 w-full py-3 rounded-xl font-semibold text-base"
            style={{ background: loading ? "var(--surface2)" : "var(--gold)", color: loading ? "var(--text3)" : "#000" }}>
            {loading ? "Calculando..." : "Calcular revisional"}
          </button>
        </Card>
      )}

      {/* ── Resultados Execução / Inicial ──────────────────────── */}
      {rows.length > 0 && summary && (
        <div className="space-y-5">
          <div className="hidden print:block mb-6 pb-4 border-b border-gray-300">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-bold">LEGALLIS — Demonstrativo de Débito</p>
                {userProfile?.company?.name && <p className="text-sm">{userProfile.company.name}</p>}
                {userProfile?.oab && userProfile.oab.length > 0 && (
                  <p className="text-sm">OAB: {userProfile.oab.map(o => `${o.state} ${o.number}`).join(" | ")}</p>
                )}
              </div>
              <div className="text-right text-sm">
                <p>Emitido por: {session?.user?.name ?? ""}</p>
                <p>Data: {new Date().toLocaleDateString("pt-BR")}</p>
                <p>Tribunal: {tribunal}</p>
              </div>
            </div>
          </div>
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
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
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
            <SectionTitle>Resumo</SectionTitle>
            <div className="space-y-1 text-sm max-w-md">
              <SummaryRow label="Débito corrigido (principal)" value={fmtBRL(summary.subtotal_principal)} />
              <SummaryRow label="Juros moratórios" value={fmtBRL(summary.subtotal_juros)} />
              <SummaryRow label="Subtotal" value={fmtBRL(summary.subtotal_base)} />
              {modo === "execucao" && summary.honorarios_valor !== undefined && (
                <SummaryRow label={`Honorários (${summary.honorarios_pct}%)`} value={fmtBRL(summary.honorarios_valor)} />
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
              <div className="pt-2 mt-1 flex items-center justify-between rounded-lg px-3 py-2.5"
                style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)" }}>
                <span className="font-semibold" style={{ color: "var(--gold)" }}>
                  {modo === "inicial" ? "Valor da causa" : "Total geral"}
                </span>
                <span className="font-bold text-lg tabular-nums" style={{ color: "var(--gold)" }}>
                  {fmtBRL(summary.total_geral)}
                </span>
              </div>
            </div>
            <BotoesExport nome={`calculo-${modo}-${new Date().toISOString().slice(0,10)}`} doc={{
              titulo: modo === "inicial" ? "Petição Inicial — Demonstrativo de Débito" : "Cumprimento de Sentença — Demonstrativo de Débito",
              subtitulo: `Gerado em ${new Date().toLocaleString("pt-BR")}`,
              advogado: advogadoInfo,
              processo: processoInfo.numero || undefined,
              secoes: [
                {
                  nome: "Demonstrativo de Débito",
                  tipo: "tabela",
                  colunas: ["Data", "Valor Original", "Fator", "Débito Corrigido", "Juros %", "Valor Juros", "Total"],
                  dados: rows.map(r => ({
                    "Data": r.data_cobranca,
                    "Valor Original": fmtBRL(r.valor_original),
                    "Fator": r.fator_correcao.toFixed(6),
                    "Débito Corrigido": fmtBRL(r.debito_corrigido),
                    "Juros %": fmtPct(r.juros_pct),
                    "Valor Juros": fmtBRL(r.juros_valor),
                    "Total": fmtBRL(r.total),
                  })),
                },
                {
                  nome: "Resumo",
                  tipo: "resumo",
                  linhas: [
                    { label: "Débito corrigido (principal)", valor: fmtBRL(summary.subtotal_principal) },
                    { label: "Juros moratórios", valor: fmtBRL(summary.subtotal_juros) },
                    { label: "Subtotal", valor: fmtBRL(summary.subtotal_base) },
                    ...(modo === "execucao" && summary.honorarios_valor !== undefined ? [{ label: `Honorários (${summary.honorarios_pct}%)`, valor: fmtBRL(summary.honorarios_valor) }] : []),
                    ...(modo === "execucao" && summary.multa_523 && summary.multa_valor !== undefined ? [{ label: "Multa art. 523 §1º CPC (10%)", valor: fmtBRL(summary.multa_valor) }] : []),
                    ...(modo === "inicial" && summary.aplicar_dobro && summary.subtotal_material !== undefined ? [{ label: "Repetição em dobro (CDC art. 42)", valor: fmtBRL(summary.subtotal_material) }] : []),
                    ...(modo === "inicial" && summary.dano_moral ? [{ label: "Dano moral", valor: fmtBRL(summary.dano_moral) }] : []),
                    { label: modo === "inicial" ? "Valor da causa" : "Total geral", valor: fmtBRL(summary.total_geral) },
                  ],
                },
              ],
            }} />
          </Card>
        </div>
      )}

      {/* ── Resultado Honorário ──────────────────────────────────── */}
      {honResult && (
        <Card>
          <SectionTitle>Resultado — Execução de Honorário</SectionTitle>
          {honResult.numero_processo && (
            <p className="text-sm mb-3" style={{ color: "var(--text3)" }}>Processo: <strong style={{ color: "var(--text2)" }}>{honResult.numero_processo}</strong></p>
          )}
          <div className="space-y-1 text-sm max-w-md">
            <SummaryRow label="Valor da causa (original)" value={fmtBRL(honResult.valor_original)} />
            <SummaryRow label="Índice de correção" value={honResult.indice_label} />
            <SummaryRow label="Período" value={`${honResult.meses_corr} mês(es) — ${honResult.periodo}`} />
            <SummaryRow label="Fator acumulado" value={`${honResult.corr_factor.toFixed(6)} (+${honResult.variacao_pct.toFixed(4)}%)`} />
            <SummaryRow label="Valor corrigido" value={fmtBRL(honResult.valor_corrigido)} highlight />
            <SummaryRow label={`Percentual de honorário (${honResult.honorarios_pct}%)`} value={fmtBRL(honResult.honorario_valor)} />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg px-3 py-2.5"
            style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)" }}>
            <span className="font-semibold" style={{ color: "var(--gold)" }}>Honorário devido</span>
            <span className="font-bold text-lg tabular-nums" style={{ color: "var(--gold)" }}>{fmtBRL(honResult.honorario_valor)}</span>
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text3)" }}>
            Correção: {honResult.indice_label} — sem juros de mora.
          </p>
          <BotoesExport nome={`honorario-${new Date().toISOString().slice(0,10)}`} doc={{
            titulo: "Execução de Honorário",
            subtitulo: honResult.numero_processo ? `Processo: ${honResult.numero_processo}` : undefined,
            advogado: advogadoInfo,
            processo: honResult.numero_processo || undefined,
            secoes: [{
              nome: "Resultado",
              tipo: "resumo",
              linhas: [
                { label: "Valor da causa (original)", valor: fmtBRL(honResult.valor_original) },
                { label: "Índice de correção", valor: honResult.indice_label },
                { label: "Período", valor: `${honResult.meses_corr} mês(es) — ${honResult.periodo}` },
                { label: "Fator acumulado", valor: honResult.corr_factor.toFixed(6) },
                { label: "Valor corrigido", valor: fmtBRL(honResult.valor_corrigido) },
                { label: `Honorário (${honResult.honorarios_pct}%)`, valor: fmtBRL(honResult.honorario_valor) },
              ],
            }],
          }} />
        </Card>
      )}

      {/* ── Resultado Revisional ─────────────────────────────────── */}
      {revResult && (
        <div className="space-y-5">
          <Card>
            <SectionTitle>Resultado — {revResult.tipo === "veiculo" ? "Revisional de Veículo" : "Revisional de Contratos Bancários"}</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1 text-sm">
                <SummaryRow label="Valor financiado (PV)" value={fmtBRL(revResult.pv)} />
                <SummaryRow label="Número de parcelas" value={String(revResult.n_parcelas)} />
                <SummaryRow label="Taxa contratada implícita" value={`${revResult.taxa_contratada_pct.toFixed(4)}% a.m.`} />
                <SummaryRow label="Taxa de referência" value={`${revResult.taxa_referencia_pct.toFixed(4)}% a.m.`} />
                <SummaryRow label="Parcela contratada" value={fmtBRL(revResult.pmt_contratada)} />
                <SummaryRow label="Parcela justa" value={fmtBRL(revResult.pmt_justa)} highlight />
                <SummaryRow label="Excesso mensal" value={fmtBRL(revResult.excesso_mensal)} />
                {revResult.tipo === "veiculo" && totalSeguros(segurosVeiculo) > 0 && (
                  <SummaryRow label="Seguros embutidos (restituíveis)" value={fmtBRL(totalSeguros(segurosVeiculo))} />
                )}
                {revResult.tipo === "emprestimo" && totalSeguros(segurosContrato) > 0 && (
                  <SummaryRow label="Seguros embutidos (restituíveis)" value={fmtBRL(totalSeguros(segurosContrato))} />
                )}
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl p-6"
                style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text3)" }}>Total de excesso cobrado</p>
                <p className="font-bold text-3xl tabular-nums" style={{ color: "var(--gold)" }}>{fmtBRL(revResult.total_excesso)}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>{revResult.total_parcelas} parcela(s)</p>
              </div>
            </div>
          </Card>
          {revResult.parcelas.length > 0 && (
            <Card>
              <SectionTitle>Planilha de parcelas (primeiras 12)</SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Parcela", "Vencimento", "Pmt Contratada", "Pmt Justa", "Excesso"].map(h => (
                        <th key={h} className="pb-2 text-left pr-4 font-medium uppercase tracking-wider" style={{ color: "var(--text3)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {revResult.parcelas.map(p => (
                      <tr key={p.parcela} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="py-1.5 pr-4 tabular-nums" style={{ color: "var(--text2)" }}>{p.parcela}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{p.data_vencimento}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{fmtBRL(p.pmt_contratada)}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{fmtBRL(p.pmt_justa)}</td>
                        <td className="py-1.5 font-semibold tabular-nums" style={{ color: p.excesso > 0 ? "#f87171" : "var(--text3)" }}>{fmtBRL(p.excesso)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <BotoesExport nome={`revisional-${revResult.tipo}-${new Date().toISOString().slice(0,10)}`} doc={{
                titulo: revResult.tipo === "veiculo" ? "Revisional de Veículo" : "Revisional de Contratos Bancários",
                advogado: advogadoInfo,
                secoes: [
                  {
                    nome: "Resumo",
                    tipo: "resumo",
                    linhas: [
                      { label: "Valor financiado (PV)", valor: fmtBRL(revResult.pv) },
                      { label: "Número de parcelas", valor: String(revResult.n_parcelas) },
                      { label: "Taxa contratada implícita", valor: `${revResult.taxa_contratada_pct.toFixed(4)}% a.m.` },
                      { label: "Taxa de referência", valor: `${revResult.taxa_referencia_pct.toFixed(4)}% a.m.` },
                      { label: "Parcela contratada", valor: fmtBRL(revResult.pmt_contratada) },
                      { label: "Parcela justa", valor: fmtBRL(revResult.pmt_justa) },
                      { label: "Excesso mensal", valor: fmtBRL(revResult.excesso_mensal) },
                      { label: "Total de excesso cobrado", valor: fmtBRL(revResult.total_excesso) },
                    ],
                  },
                  {
                    nome: "Planilha de Parcelas",
                    tipo: "tabela",
                    colunas: ["Parcela", "Vencimento", "Pmt Contratada", "Pmt Justa", "Excesso"],
                    dados: revResult.parcelas.map(p => ({
                      "Parcela": p.parcela,
                      "Vencimento": p.data_vencimento,
                      "Pmt Contratada": fmtBRL(p.pmt_contratada),
                      "Pmt Justa": fmtBRL(p.pmt_justa),
                      "Excesso": fmtBRL(p.excesso),
                    })),
                  },
                ],
              }} />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
