"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, Input as Inp, Select as Sel } from "@/components/ui";
import {
  getExecucoes, createExecucao, updateExecucao, deleteExecucao, statusExecucao,
  fmtBRL, MESES, NEXT_STATUS,
  type Execucao, type Status, type TipoExecucao,
} from "@/lib/financeiro";
import { MetricCard, StatusBtn, sortByMesDesc, getCurrentMes } from "./_shared";

const PCT_PADRAO_KEY = "legallis_pct_honorarios_execucao_padrao";
const PCT_PADRAO_FALLBACK = 35;

export function getPctExecucaoPadrao(): number {
  if (typeof window === "undefined") return PCT_PADRAO_FALLBACK;
  const v = parseFloat(localStorage.getItem(PCT_PADRAO_KEY) || "");
  return Number.isFinite(v) ? v : PCT_PADRAO_FALLBACK;
}

export function ExecucoesView({ reload, filtroMes }: { reload: () => void; filtroMes?: string }) {
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [novo, setNovo] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [pctPadrao, setPctPadrao] = useState(PCT_PADRAO_FALLBACK);

  useEffect(() => { setPctPadrao(getPctExecucaoPadrao()); }, []);

  const salvarPctPadrao = (v: number) => {
    const pct = Number.isFinite(v) ? v : PCT_PADRAO_FALLBACK;
    setPctPadrao(pct);
    localStorage.setItem(PCT_PADRAO_KEY, String(pct));
  };

  const load = useCallback(async () => { setExecucoes(await getExecucoes()); }, []);
  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (e: Execucao) => {
    await statusExecucao(e.id, NEXT_STATUS[e.status] || "pago");
    load(); reload();
  };
  const del = async (id: string) => { await deleteExecucao(id); load(); reload(); };

  const sorted = filtroMes
    ? sortByMesDesc(execucoes.filter(e => e.mes === filtroMes))
    : sortByMesDesc(execucoes);
  const total = execucoes.reduce((s, e) => s + e.honorarios, 0);
  const recebido = execucoes.filter(e => e.status !== "pendente").reduce((s, e) => s + e.honorarios, 0);
  const pendente = execucoes.filter(e => e.status === "pendente").reduce((s, e) => s + e.honorarios, 0);

  return (
    <div className="space-y-4">
      <div className="text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 flex-wrap" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", color: "var(--text2)" }}>
        <span>📐 Honorários padrão (processo completo):</span>
        <input type="number" step="0.5" min="0" max="100" value={pctPadrao}
          onChange={e => salvarPctPadrao(parseFloat(e.target.value))}
          className="w-16 px-2 py-0.5 rounded outline-none text-center font-semibold"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--gold)" }} />
        <span style={{ color: "var(--gold)", fontWeight: 600 }}>% do valor percebido</span>
        <span style={{ color: "var(--text3)" }}>+ sucumbência · ajustável em cada execução</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <MetricCard label="Total" value={total} color="var(--gold)" />
        <MetricCard label="Recebido" value={recebido} color="#22c55e" />
        <MetricCard label="Pendente" value={pendente} color="#ef4444" />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm" style={{ color:"var(--text3)" }}>
          {sorted.length} execuções{filtroMes ? <span style={{ color: "var(--gold)" }}> · {filtroMes}</span> : ""}
        </span>
        <button onClick={() => setNovo(true)} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background:"var(--gold)", color:"#000" }}>+ Nova</button>
      </div>
      {novo && <ExecucaoForm initial={{ pct_honorarios: pctPadrao }} onSave={async f => { await createExecucao(f); setNovo(false); load(); reload(); }} onCancel={() => setNovo(false)} />}
      {execucoes.length === 0 && !novo ? (
        <p className="py-8 text-center text-sm" style={{ color:"var(--text3)" }}>Nenhuma execução cadastrada.</p>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  {["Mês","Data","Cliente","Réu","Processo","Percebido","%","Sucumbência","Honorários","Status",""].map(h => (
                    <th key={h} className="pb-2 text-left pr-3 text-xs uppercase tracking-wider" style={{ color:"var(--text3)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(e => editId === e.id
                  ? <tr key={e.id}><td colSpan={11} className="py-2"><ExecucaoForm initial={e}
                      onSave={async f => { await updateExecucao(e.id, f); setEditId(null); load(); reload(); }}
                      onCancel={() => setEditId(null)} /></td></tr>
                  : (
                    <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="py-2 pr-3 text-xs font-semibold whitespace-nowrap" style={{ color:"var(--gold)" }}>{e.mes}</td>
                      <td className="py-2 pr-3 text-xs" style={{ color:"var(--text3)" }}>{e.data_pagamento}</td>
                      <td className="py-2 pr-3 font-medium max-w-36 truncate" style={{ color:"var(--text)" }}>{e.cliente}</td>
                      <td className="py-2 pr-3 text-xs" style={{ color:"var(--text3)" }}>{e.reu}</td>
                      <td className="py-2 pr-3 text-xs font-mono max-w-32 truncate" style={{ color:"var(--text3)" }}>{e.processo}</td>
                      <td className="py-2 pr-3 tabular-nums text-xs" style={{ color:"var(--text2)" }}>{fmtBRL(e.valor_percebido)}</td>
                      <td className="py-2 pr-3 tabular-nums text-xs" style={{ color:"var(--text3)" }}>
                        {e.tipo_execucao === "honorarios_somente" ? "—" : `${(e.pct_honorarios ?? PCT_PADRAO_FALLBACK).toLocaleString("pt-BR")}%`}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-xs" style={{ color:"var(--text2)" }}>{fmtBRL(e.sucumbencia)}</td>
                      <td className="py-2 pr-3 tabular-nums font-semibold text-xs" style={{ color:"#22c55e" }}>{fmtBRL(e.honorarios)}</td>
                      <td className="py-2 pr-3"><StatusBtn status={e.status} onClick={() => toggleStatus(e)} /></td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button onClick={() => setEditId(e.id)} className="text-xs px-2 py-1 rounded" style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>✏️</button>
                          <button onClick={() => { if(confirm("Excluir?")) del(e.id); }} className="text-xs px-2 py-1 rounded" style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function ExecucaoForm({ initial, onSave, onCancel }: {
  initial?: Partial<Execucao>;
  onSave: (f: Omit<Execucao,"id"|"honorarios">) => Promise<void>;
  onCancel: () => void;
}) {
  const blank = {
    mes: getCurrentMes(), data_pagamento: "", cliente: "", reu: "", processo: "",
    tipo_execucao: "processo_completo" as TipoExecucao,
    valor_percebido: 0, pct_honorarios: 35, sucumbencia: 0, status: "pago" as Status,
  };
  const [form, setForm] = useState({ ...blank, ...(initial || {}) });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const isSomente = form.tipo_execucao === "honorarios_somente";
  const pct = form.pct_honorarios ?? 35;
  const honorariosCalc = isSomente
    ? form.valor_percebido + form.sucumbencia
    : form.valor_percebido * (pct / 100) + form.sucumbencia;
  const repasseCalc = isSomente ? 0 : form.valor_percebido * (1 - pct / 100);

  return (
    <Card>
      {/* Tipo de execução */}
      <div className="mb-4">
        <span className="text-xs uppercase tracking-wider mb-2 block" style={{ color:"var(--text3)" }}>Tipo de lançamento</span>
        <div className="flex gap-2">
          {([
            ["processo_completo", "⚖️ Processo completo", "Valor total recebido com % de honorário"],
            ["honorarios_somente", "💼 Somente honorário", "Só o valor dos honorários (sem repasse)"],
          ] as const).map(([val, label, desc]) => (
            <button key={val} type="button"
              onClick={() => set("tipo_execucao", val)}
              className="flex-1 px-3 py-2 rounded-lg text-left transition-all"
              style={{
                background: form.tipo_execucao === val ? "rgba(201,168,76,0.12)" : "var(--surface2)",
                border: `1px solid ${form.tipo_execucao === val ? "var(--gold)" : "var(--border)"}`,
                color: form.tipo_execucao === val ? "var(--gold)" : "var(--text2)",
              }}>
              <p className="text-xs font-semibold">{label}</p>
              <p className="text-xs mt-0.5 opacity-70">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Mês de recebimento</span>
          <Sel value={form.mes} onChange={e => set("mes",e.target.value)}>
            {MESES.map(m => <option key={m} value={m}>{m}</option>)}
          </Sel>
        </div>
        <div>
          <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Data do recebimento</span>
          <Inp type="date" value={form.data_pagamento} onChange={e => set("data_pagamento",e.target.value)} />
        </div>
        <div>
          <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Cliente *</span>
          <Inp value={form.cliente} onChange={e => set("cliente",e.target.value)} />
        </div>
        <div>
          <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Réu / Banco</span>
          <Inp value={form.reu} onChange={e => set("reu",e.target.value)} />
        </div>
        <div>
          <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Processo</span>
          <Inp value={form.processo} onChange={e => set("processo",e.target.value)} />
        </div>

        {isSomente ? (
          <div>
            <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Honorários recebidos (R$)</span>
            <Inp type="number" step="0.01" min="0" value={form.valor_percebido||""} onChange={e => set("valor_percebido", parseFloat(e.target.value)||0)} />
            <p className="text-xs mt-1" style={{ color:"var(--text3)" }}>Valor que entrou diretamente para o escritório</p>
          </div>
        ) : (
          <>
            <div>
              <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Valor total do processo (R$)</span>
              <Inp type="number" step="0.01" min="0" value={form.valor_percebido||""} onChange={e => set("valor_percebido", parseFloat(e.target.value)||0)} />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>% de honorário</span>
              <Inp type="number" step="0.5" min="0" max="100" value={form.pct_honorarios ?? 35}
                onChange={e => { const v = parseFloat(e.target.value); set("pct_honorarios", Number.isNaN(v) ? 35 : v); }} />
            </div>
          </>
        )}

        <div>
          <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Sucumbência (R$)</span>
          <Inp type="number" step="0.01" min="0" value={form.sucumbencia||""} onChange={e => set("sucumbencia", parseFloat(e.target.value)||0)} />
        </div>

        <div>
          <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Status</span>
          <Sel value={form.status} onChange={e => set("status",e.target.value as Status)}>
            <option value="pago">Pago / Recebido</option>
            <option value="pendente">Pendente</option>
            <option value="repasse">Repasse pendente</option>
          </Sel>
        </div>
      </div>

      {/* Preview do cálculo */}
      {form.valor_percebido > 0 && (
        <div className="mt-3 p-3 rounded-lg grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs"
          style={{ background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.2)" }}>
          <div>
            <p style={{ color:"var(--text3)" }}>Honorários do escritório</p>
            <p className="font-bold tabular-nums" style={{ color:"#22c55e" }}>{fmtBRL(Math.round(honorariosCalc * 100) / 100)}</p>
          </div>
          {!isSomente && repasseCalc > 0 && (
            <div>
              <p style={{ color:"var(--text3)" }}>Repasse ao cliente</p>
              <p className="font-bold tabular-nums" style={{ color:"#f59e0b" }}>{fmtBRL(Math.round(repasseCalc * 100) / 100)}</p>
            </div>
          )}
          {form.sucumbencia > 0 && (
            <div>
              <p style={{ color:"var(--text3)" }}>Sucumbência</p>
              <p className="font-bold tabular-nums" style={{ color:"#a78bfa" }}>{fmtBRL(form.sucumbencia)}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 mt-4">
        <button onClick={async () => { setSaving(true); try { await onSave(form); } finally { setSaving(false); } }}
          disabled={saving} className="px-5 py-2 rounded-lg font-semibold text-sm" style={{ background:"var(--gold)", color:"#000" }}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button onClick={onCancel} className="px-5 py-2 rounded-lg text-sm" style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>
          Cancelar
        </button>
      </div>
    </Card>
  );
}
