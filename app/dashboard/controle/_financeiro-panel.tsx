"use client";

// Painel financeiro reutilizável — mostra e permite lançar Honorários/Acordos/
// Execuções/Timesheet vinculados a um processo (por Processo.id) ou, quando não
// há um Processo.id real (ex.: registros de Finalizados), pelo número do processo.

import { useEffect, useState, useCallback } from "react";
import {
  getProcessoFinanceiro, getFinanceiroPorNumero,
  createAcordo, createExecucao, createHonInicial, createTimesheet,
  fmtBRL, statusBadge, statusLabel, type ProcessoFinanceiro,
} from "@/lib/financeiro";

export interface AlvoFinanceiro {
  processoId?: string;
  numeroProcesso?: string;
  cliente: string;
  reu?: string;
  objeto?: string;
  responsavel?: string;
}

function Sel({ children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className="px-3 py-2 rounded-lg text-sm outline-none"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
      {children}
    </select>
  );
}

type TipoLancamento = "honorario_inicial" | "acordo" | "execucao" | "timesheet";

function LancamentoForm({ alvo, onSaved, onCancel }: {
  alvo: AlvoFinanceiro; onSaved: () => void; onCancel: () => void;
}) {
  const [tipo, setTipo] = useState<TipoLancamento>("honorario_inicial");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    valor: "", valor_percebido: "", sucumbencia: "", minutos: "",
    data_pagamento: "", data: "", mes: "", descricao: "", observacao: "",
    responsavel: alvo.responsavel || "", status: "pendente", faturavel: true,
  });
  const set = (k: string, v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      const base = { processoId: alvo.processoId, processo: alvo.numeroProcesso || "", cliente: alvo.cliente };
      if (tipo === "honorario_inicial") {
        await createHonInicial({ ...base, valor: Number(form.valor) || 0, data_pagamento: form.data_pagamento, observacao: form.observacao, status: form.status as "pago"|"pendente"|"repasse", mes: form.mes });
      } else if (tipo === "acordo") {
        await createAcordo({ ...base, reu: alvo.reu || "", objeto: alvo.objeto || "", valor_acordo: Number(form.valor) || 0, data_pagamento: form.data_pagamento, mes: form.mes, status: form.status as "pago"|"pendente"|"repasse" });
      } else if (tipo === "execucao") {
        await createExecucao({ ...base, reu: alvo.reu || "", valor_percebido: Number(form.valor_percebido) || 0, sucumbencia: Number(form.sucumbencia) || 0, data_pagamento: form.data_pagamento, mes: form.mes, status: form.status as "pago"|"pendente"|"repasse" });
      } else {
        await createTimesheet({ ...base, data: form.data, minutos: Number(form.minutos) || 0, descricao: form.descricao, responsavel: form.responsavel, faturavel: !!form.faturavel, status: form.status as "pago"|"pendente"|"repasse" });
      }
      onSaved();
    } finally { setSaving(false); }
  };

  const inpS = "w-full px-2 py-1.5 rounded text-xs outline-none";
  const inpStyle = { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" };

  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: "var(--surface2)", border: "1px dashed var(--border)" }}>
      <Sel value={tipo} onChange={e => setTipo(e.target.value as TipoLancamento)} style={{ fontSize: 12, padding: "4px 8px" }}>
        <option value="honorario_inicial">Honorário Inicial</option>
        <option value="acordo">Acordo</option>
        <option value="execucao">Execução</option>
        <option value="timesheet">Timesheet (horas)</option>
      </Sel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tipo === "execucao" ? (
          <>
            <input placeholder="Valor percebido" type="number" value={form.valor_percebido} onChange={e => set("valor_percebido", e.target.value)} className={inpS} style={inpStyle} />
            <input placeholder="Sucumbência" type="number" value={form.sucumbencia} onChange={e => set("sucumbencia", e.target.value)} className={inpS} style={inpStyle} />
          </>
        ) : tipo === "timesheet" ? (
          <>
            <input placeholder="Minutos" type="number" value={form.minutos} onChange={e => set("minutos", e.target.value)} className={inpS} style={inpStyle} />
            <input placeholder="Descrição" value={form.descricao} onChange={e => set("descricao", e.target.value)} className={inpS} style={inpStyle} />
            <input placeholder="Responsável" value={form.responsavel} onChange={e => set("responsavel", e.target.value)} className={inpS} style={inpStyle} />
          </>
        ) : (
          <input placeholder="Valor (R$)" type="number" value={form.valor} onChange={e => set("valor", e.target.value)} className={inpS} style={inpStyle} />
        )}
        {tipo === "timesheet" ? (
          <input placeholder="Data" type="date" value={form.data} onChange={e => set("data", e.target.value)} className={inpS} style={inpStyle} />
        ) : (
          <input placeholder="Data pagamento" type="date" value={form.data_pagamento} onChange={e => set("data_pagamento", e.target.value)} className={inpS} style={inpStyle} />
        )}
        {tipo !== "timesheet" && (
          <input placeholder="Mês (ex: Jul/2026)" value={form.mes} onChange={e => set("mes", e.target.value)} className={inpS} style={inpStyle} />
        )}
        <Sel value={form.status} onChange={e => set("status", e.target.value)} style={{ fontSize: 12, padding: "4px 8px" }}>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="repasse">Repasse</option>
        </Sel>
        {tipo === "honorario_inicial" && (
          <input placeholder="Observação" value={form.observacao} onChange={e => set("observacao", e.target.value)} className={inpS} style={inpStyle} />
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving} className="text-xs px-3 py-1.5 rounded font-semibold" style={{ background: "var(--gold)", color: "#000" }}>
          {saving ? "Salvando..." : "Adicionar"}
        </button>
        <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded" style={{ background: "var(--surface)", color: "var(--text3)", border: "1px solid var(--border)" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function FinanceiroPanel({ alvo }: { alvo: AlvoFinanceiro }) {
  const [dados, setDados] = useState<ProcessoFinanceiro | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingNovo, setAddingNovo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDados(alvo.processoId ? await getProcessoFinanceiro(alvo.processoId) : await getFinanceiroPorNumero(alvo.numeroProcesso || ""));
    } finally { setLoading(false); }
  }, [alvo.processoId, alvo.numeroProcesso]);

  useEffect(() => { load(); }, [load]);

  if (loading || !dados) return <p className="text-xs py-2" style={{ color: "var(--text3)" }}>Carregando financeiro...</p>;

  const totalHonorarios = dados.acordos.reduce((s, a) => s + (a.honorarios || 0), 0)
    + dados.execucoes.reduce((s, e) => s + (e.honorarios || 0), 0)
    + dados.honorarios_iniciais.reduce((s, h) => s + (h.valor || 0), 0);
  const totalMinutos = dados.timesheets.reduce((s, t) => s + (t.minutos || 0), 0);

  const linhas = [
    ...dados.honorarios_iniciais.map(h => ({ id: h.id, label: "Honorário Inicial", valor: h.valor, status: h.status })),
    ...dados.acordos.map(a => ({ id: a.id, label: "Acordo", valor: a.honorarios, status: a.status })),
    ...dados.execucoes.map(e => ({ id: e.id, label: "Execução", valor: e.honorarios, status: e.status })),
  ];

  return (
    <div className="space-y-3 py-2">
      <div className="flex flex-wrap gap-4 text-xs" style={{ color: "var(--text2)" }}>
        <span>💰 Honorários lançados: <strong style={{ color: "var(--gold)" }}>{fmtBRL(totalHonorarios)}</strong></span>
        <span>⏱ Horas lançadas: <strong style={{ color: "var(--text)" }}>{(totalMinutos / 60).toFixed(1)}h</strong></span>
      </div>

      {linhas.length > 0 && (
        <div className="space-y-1">
          {linhas.map(l => (
            <div key={l.id} className="flex items-center justify-between text-xs px-2 py-1 rounded" style={{ background: "var(--surface2)" }}>
              <span style={{ color: "var(--text2)" }}>{l.label}</span>
              <span className="flex items-center gap-2">
                <span style={{ color: "var(--text)" }}>{fmtBRL(l.valor || 0)}</span>
                <span className={`px-1.5 py-0.5 rounded-full ${statusBadge(l.status)}`}>{statusLabel(l.status)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {dados.timesheets.length > 0 && (
        <div className="space-y-1">
          {dados.timesheets.map(t => (
            <div key={t.id} className="flex items-center justify-between text-xs px-2 py-1 rounded" style={{ background: "var(--surface2)" }}>
              <span style={{ color: "var(--text2)" }}>⏱ {t.descricao || "Timesheet"} — {t.responsavel}</span>
              <span style={{ color: "var(--text)" }}>{(t.minutos / 60).toFixed(1)}h</span>
            </div>
          ))}
        </div>
      )}

      {addingNovo ? (
        <LancamentoForm alvo={alvo} onSaved={() => { setAddingNovo(false); load(); }} onCancel={() => setAddingNovo(false)} />
      ) : (
        <button onClick={() => setAddingNovo(true)} className="text-xs px-3 py-1.5 rounded font-medium"
          style={{ background: "rgba(201,168,76,0.12)", color: "var(--gold)", border: "1px solid rgba(201,168,76,0.3)" }}>
          + Lançar honorário / despesa / horas
        </button>
      )}
    </div>
  );
}
