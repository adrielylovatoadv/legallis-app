"use client";

import { useEffect, useState, useCallback } from "react";
import {
  updateProcesso, ANDAMENTOS_PROCESSO, RESPONSAVEIS,
  type Processo,
} from "@/lib/controle";

interface FinalizadoSemHonor {
  cliente: string; reu: string; processo: string; objeto: string;
  data_fin: string; motivo: string;
}

interface FinalizadoAcordo {
  mes: string; data_pagamento: string; cliente: string; reu: string;
  objeto: string; valor_acordo: number; honorarios: number; status: string;
  processo: string; repasse_cliente: number;
}

interface FinalizadoExecucao {
  mes: string; data_pagamento: string; cliente: string; reu: string;
  processo: string; objeto: string; valor_execucao: number;
  honorarios: number; repasse_cliente: number; status: string; observacoes?: string;
}

function fmtDate(s: string) {
  if (!s || s.length < 10) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function fmtVal(n: number) {
  if (!n) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function ModalEditar({ p, onClose, onSaved }: {
  p: Processo; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...p });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Processo, v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    try { await updateProcesso(p.id, form); onSaved(); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold" style={{ color: "var(--text)" }}>Editar processo</h2>
          <button onClick={onClose} style={{ color: "var(--text3)" }}>✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(["autor","reu","objeto","numero_processo"] as const).map(k => (
            <div key={k}>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>
                {k === "autor" ? "Autor" : k === "reu" ? "Réu" : k === "objeto" ? "Objeto" : "Nº Processo"}
              </label>
              <input value={(form[k] as string) || ""} onChange={e => set(k, e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
          ))}
          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Data</label>
            <input type="date" value={form.data || ""} onChange={e => set("data", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Andamento</label>
            <select value={form.andamento} onChange={e => set("andamento", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
              <option value="">Selecionar</option>
              {ANDAMENTOS_PROCESSO.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Responsável</label>
            <select value={form.responsavel} onChange={e => set("responsavel", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
              {RESPONSAVEIS.map(r => <option key={r} value={r}>{r || "—"}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Observações</label>
          <textarea rows={2} value={form.observacoes || ""} onChange={e => set("observacoes", e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!form.atencao} onChange={e => set("atencao", e.target.checked)} className="accent-red-500" />
            <span className="text-sm" style={{ color: "var(--text2)" }}>🚨 Atenção</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!form.finalizado} onChange={e => set("finalizado", e.target.checked)} />
            <span className="text-sm" style={{ color: "var(--text2)" }}>Finalizado</span>
          </label>
        </div>
        <button onClick={save} disabled={saving}
          className="w-full py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: "var(--gold)", color: "#000" }}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

type Aba = "sem_honor" | "acordos" | "execucao";

export function FinalizadosTab() {
  const [semHonor, setSemHonor] = useState<FinalizadoSemHonor[]>([]);
  const [acordos, setAcordos] = useState<FinalizadoAcordo[]>([]);
  const [execucao, setExecucao] = useState<FinalizadoExecucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>("sem_honor");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Processo | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/controle/finalizados");
      if (res.ok) {
        const d = await res.json();
        setSemHonor(d.sem_honor || []);
        setAcordos(d.acordos || []);
        setExecucao(d.execucao || []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtrar = <T extends { cliente: string; reu: string; objeto: string }>(list: T[]) => {
    if (!busca) return list;
    const b = busca.toLowerCase();
    return list.filter(i =>
      i.cliente.toLowerCase().includes(b) ||
      i.reu.toLowerCase().includes(b) ||
      i.objeto.toLowerCase().includes(b)
    );
  };

  const semHonorFilt = filtrar(semHonor);
  const acordosFilt = filtrar(acordos);
  const execucaoFilt = filtrar(execucao);

  const totalHonorarios = acordos.reduce((s, a) => s + (a.honorarios || 0), 0);
  const totalAcordos = acordos.reduce((s, a) => s + (a.valor_acordo || 0), 0);
  const acordosPendentes = acordos.filter(a => (a.status || "").toUpperCase() === "PENDENTE").length;
  const totalExecucao = execucao.reduce((s, e) => s + (e.valor_execucao || 0), 0);
  const totalHonExecucao = execucao.reduce((s, e) => s + (e.honorarios || 0), 0);
  const execucaoPendentes = execucao.filter(e => (e.status || "").toUpperCase() !== "PAGO").length;

  const tabStyle = (t: Aba) => ({
    background: aba === t ? "var(--gold)" : "var(--surface2)",
    color: aba === t ? "#000" : "var(--text2)",
    border: "1px solid var(--border)",
  });

  return (
    <div className="space-y-5">
      {editando && (
        <ModalEditar p={editando} onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); load(); }} />
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl p-4 flex flex-col gap-1"
          style={{ background: "var(--surface)", borderLeft: "4px solid #6b7280", border: "1px solid var(--border)" }}>
          <span className="text-2xl font-bold tabular-nums" style={{ color: "#9ca3af" }}>{semHonor.length}</span>
          <span className="text-xs" style={{ color: "var(--text3)" }}>Sem honorário</span>
        </div>
        <div className="rounded-xl p-4 flex flex-col gap-1"
          style={{ background: "var(--surface)", borderLeft: "4px solid #C9A84C", border: "1px solid var(--border)" }}>
          <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--gold)" }}>{acordos.length}</span>
          <span className="text-xs" style={{ color: "var(--text3)" }}>Com acordo</span>
        </div>
        <div className="rounded-xl p-4 flex flex-col gap-1"
          style={{ background: "var(--surface)", borderLeft: "4px solid #60a5fa", border: "1px solid var(--border)" }}>
          <span className="text-2xl font-bold tabular-nums" style={{ color: "#60a5fa" }}>{execucao.length}</span>
          <span className="text-xs" style={{ color: "var(--text3)" }}>Execução</span>
        </div>
        <div className="rounded-xl p-4 flex flex-col gap-1"
          style={{ background: "var(--surface)", borderLeft: "4px solid #f97316", border: "1px solid var(--border)" }}>
          <span className="text-sm font-bold tabular-nums" style={{ color: "#f97316" }}>
            {fmtVal(totalHonorarios + totalHonExecucao)}
          </span>
          <span className="text-xs" style={{ color: "var(--text3)" }}>Total honorários</span>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setAba("sem_honor")} className="px-4 py-1.5 rounded-lg text-sm font-medium"
          style={tabStyle("sem_honor")}>
          Sem Honorário ({semHonor.length})
        </button>
        <button onClick={() => setAba("acordos")} className="px-4 py-1.5 rounded-lg text-sm font-medium"
          style={tabStyle("acordos")}>
          Com Acordo ({acordos.length}){acordosPendentes > 0 ? ` · ${acordosPendentes} pend.` : ""}
        </button>
        <button onClick={() => setAba("execucao")} className="px-4 py-1.5 rounded-lg text-sm font-medium"
          style={tabStyle("execucao")}>
          ⚖️ Execução ({execucao.length}){execucaoPendentes > 0 ? ` · ${execucaoPendentes} pend.` : ""}
        </button>
      </div>

      {/* Busca */}
      <input value={busca} onChange={e => setBusca(e.target.value)}
        placeholder="🔍 Buscar..."
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--gold)", borderTopColor: "transparent" }} />
        </div>
      ) : aba === "sem_honor" ? (
        <div className="space-y-2">
          {semHonorFilt.length === 0
            ? <p className="py-8 text-center text-sm" style={{ color: "var(--text3)" }}>Nenhum registro encontrado.</p>
            : semHonorFilt.map((i, idx) => (
              <div key={idx} className="rounded-lg px-4 py-3"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm" style={{ color: "var(--text)" }}>{i.cliente}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
                      {i.reu && <span>{i.reu}</span>}
                      {i.objeto && <span className="ml-2">· {i.objeto}</span>}
                    </p>
                    {i.processo && (
                      <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--text3)" }}>{i.processo}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {i.data_fin && (
                      <span className="text-xs" style={{ color: "var(--text3)" }}>{fmtDate(i.data_fin)}</span>
                    )}
                    {i.motivo && (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(107,114,128,0.15)", color: "var(--text3)" }}>
                        {i.motivo}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      ) : aba === "acordos" ? (
        <div className="space-y-2">
          {acordosFilt.length === 0
            ? <p className="py-8 text-center text-sm" style={{ color: "var(--text3)" }}>Nenhum acordo encontrado.</p>
            : acordosFilt.map((a, idx) => (
              <div key={idx} className="rounded-lg px-4 py-3"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm" style={{ color: "var(--text)" }}>{a.cliente}</p>
                      {a.reu && <span className="text-xs" style={{ color: "var(--text3)" }}>× {a.reu}</span>}
                    </div>
                    {a.objeto && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{a.objeto}</p>
                    )}
                    {a.processo && (
                      <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--text3)" }}>{a.processo}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {a.valor_acordo > 0 && (
                        <span className="text-sm font-semibold" style={{ color: "#22c55e" }}>
                          {fmtVal(a.valor_acordo)}
                        </span>
                      )}
                      {a.honorarios > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded"
                          style={{ background: "rgba(201,168,76,0.12)", color: "var(--gold)" }}>
                          Hon. {fmtVal(a.honorarios)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {a.data_pagamento && (
                        <span className="text-xs" style={{ color: "var(--text3)" }}>{a.data_pagamento}</span>
                      )}
                      {a.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          a.status.toUpperCase() === "PAGO"
                            ? "bg-green-500/15 text-green-400"
                            : "bg-yellow-500/15 text-yellow-400"
                        }`}>
                          {a.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          }
          {/* Totais acordos */}
          {acordosFilt.length > 0 && (
            <div className="rounded-xl p-4 mt-4 grid grid-cols-3 gap-4"
              style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)" }}>
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--text3)" }}>Total acordos</p>
                <p className="font-bold" style={{ color: "var(--gold)" }}>
                  {fmtVal(acordosFilt.reduce((s, a) => s + (a.valor_acordo || 0), 0))}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--text3)" }}>Honorários</p>
                <p className="font-bold" style={{ color: "var(--gold)" }}>
                  {fmtVal(acordosFilt.reduce((s, a) => s + (a.honorarios || 0), 0))}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--text3)" }}>Repasse clientes</p>
                <p className="font-bold" style={{ color: "var(--gold)" }}>
                  {fmtVal(acordosFilt.reduce((s, a) => s + (a.repasse_cliente || 0), 0))}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {execucaoFilt.length === 0
            ? <p className="py-8 text-center text-sm" style={{ color: "var(--text3)" }}>Nenhuma execução encontrada.</p>
            : execucaoFilt.map((e, idx) => (
              <div key={idx} className="rounded-lg px-4 py-3"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm" style={{ color: "var(--text)" }}>{e.cliente}</p>
                      {e.reu && <span className="text-xs" style={{ color: "var(--text3)" }}>× {e.reu}</span>}
                    </div>
                    {e.objeto && <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{e.objeto}</p>}
                    {e.processo && <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--text3)" }}>{e.processo}</p>}
                    {e.observacoes && <p className="text-xs mt-0.5 italic" style={{ color: "var(--text3)" }}>{e.observacoes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {e.valor_execucao > 0 && (
                        <span className="text-sm font-semibold" style={{ color: "#60a5fa" }}>
                          {fmtVal(e.valor_execucao)}
                        </span>
                      )}
                      {e.honorarios > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded"
                          style={{ background: "rgba(201,168,76,0.12)", color: "var(--gold)" }}>
                          Hon. {fmtVal(e.honorarios)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {e.data_pagamento && (
                        <span className="text-xs" style={{ color: "var(--text3)" }}>{e.data_pagamento}</span>
                      )}
                      {e.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          e.status.toUpperCase() === "PAGO"
                            ? "bg-green-500/15 text-green-400"
                            : "bg-yellow-500/15 text-yellow-400"
                        }`}>
                          {e.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          }
          {/* Totais execução */}
          {execucaoFilt.length > 0 && (
            <div className="rounded-xl p-4 mt-4 grid grid-cols-3 gap-4"
              style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)" }}>
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--text3)" }}>Total execução</p>
                <p className="font-bold" style={{ color: "#60a5fa" }}>
                  {fmtVal(execucaoFilt.reduce((s, e) => s + (e.valor_execucao || 0), 0))}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--text3)" }}>Honorários</p>
                <p className="font-bold" style={{ color: "var(--gold)" }}>
                  {fmtVal(execucaoFilt.reduce((s, e) => s + (e.honorarios || 0), 0))}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--text3)" }}>Repasse clientes</p>
                <p className="font-bold" style={{ color: "var(--gold)" }}>
                  {fmtVal(execucaoFilt.reduce((s, e) => s + (e.repasse_cliente || 0), 0))}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
