"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getDash, getAcordos, getExecucoes, getHonIniciais, getFixas, getVariaveis,
  getConfig, saveConfig,
  createAcordo, updateAcordo, deleteAcordo, statusAcordo,
  createExecucao, updateExecucao, deleteExecucao, statusExecucao,
  createHonInicial, updateHonInicial, deleteHonInicial, statusHonInicial,
  createFixa, updateFixa, deleteFixa, statusFixaMes,
  createVariavel, updateVariavel, deleteVariavel, statusVariavel,
  fmtBRL, MESES, COLS, COL_TO_MES, NEXT_STATUS, NEXT_STATUS2, statusBadge, statusLabel,
  type DashFinanceiro, type Acordo, type Execucao, type HonorarioInicial,
  type Fixa, type Variavel, type Status, type Socio, type ConfigEscritorio,
} from "@/lib/financeiro";

// ── design tokens ─────────────────────────────────────────────────────────────
const S = {
  card: "rounded-xl p-5",
  cardStyle: { background: "var(--surface)", border: "1px solid var(--border)" },
  input: "w-full px-3 py-2 rounded-lg text-sm outline-none",
  inputStyle: { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" },
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`${S.card} ${className}`} style={S.cardStyle}>{children}</div>;
}
function Inp({ ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={S.input} style={S.inputStyle} />;
}
function Sel({ children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={S.input} style={S.inputStyle}>{children}</select>
  );
}
function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-1"
      style={{ background: "var(--surface)", borderLeft: `4px solid ${color}`, border: "1px solid var(--border)" }}>
      <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text3)" }}>{label}</span>
      <span className="text-2xl font-bold tabular-nums" style={{ color }}>{fmtBRL(value)}</span>
    </div>
  );
}

// ── botão de status cíclico ───────────────────────────────────────────────────
function StatusBtn({ status, onClick, receita = true }: {
  status: string; onClick: () => void; receita?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${statusBadge(status)}`}>
      {statusLabel(status)}
    </button>
  );
}

// ── abas ──────────────────────────────────────────────────────────────────────
const ABAS = ["📊 Dashboard","🤝 Acordos","⚖️ Execuções","💼 Hon. Iniciais","🏢 Desp. Fixas","🛒 Desp. Variáveis","⚙️ Configuração","💰 Receitas Sócios"] as const;

// ── helpers de formulário ─────────────────────────────────────────────────────
function parseBRL(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function DashView({ data }: { data: DashFinanceiro }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Honorários Recebidos" value={data.total_recebido} color="#22c55e" />
        <MetricCard label="Pendente de Recebimento" value={data.total_pendente} color="#ef4444" />
        <MetricCard label="Desp. Fixas" value={data.total_fixas} color="#f97316" />
        <MetricCard label="Desp. Variáveis" value={data.total_variaveis} color="#a78bfa" />
        <MetricCard label="Saldo Líquido" value={data.saldo} color={data.saldo >= 0 ? "#C9A84C" : "#ef4444"} />
      </div>

      {data.resumo_mes.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-4 text-sm uppercase tracking-wider" style={{ color: "var(--text3)" }}>Resumo por mês</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Mês","Honorários","Desp. Fixas","Desp. Variáveis","Saldo"].map(h => (
                    <th key={h} className="pb-2 text-left pr-4 text-xs uppercase tracking-wider" style={{ color: "var(--text3)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.resumo_mes.map(r => (
                  <tr key={r.mes} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2 pr-4 font-medium" style={{ color: "var(--text)" }}>{r.mes}</td>
                    <td className="py-2 pr-4 tabular-nums" style={{ color: "#22c55e" }}>{fmtBRL(r.honorarios)}</td>
                    <td className="py-2 pr-4 tabular-nums" style={{ color: "#f97316" }}>{fmtBRL(r.fixas)}</td>
                    <td className="py-2 pr-4 tabular-nums" style={{ color: "#a78bfa" }}>{fmtBRL(r.variaveis)}</td>
                    <td className="py-2 tabular-nums font-semibold" style={{ color: r.saldo >= 0 ? "#C9A84C" : "#ef4444" }}>
                      {r.saldo >= 0 ? "🟢" : "🔴"} {fmtBRL(r.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data.pendentes.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-4" style={{ color: "#ef4444" }}>⚠️ Pendentes de Recebimento</h2>
          <div className="space-y-2">
            {data.pendentes.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg"
                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <div>
                  <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{p.cliente}</span>
                  {p.mes && <span className="ml-2 text-xs" style={{ color: "var(--text3)" }}>{p.mes}</span>}
                  {p.observacao && <span className="ml-2 text-xs" style={{ color: "var(--text3)" }}>{p.observacao}</span>}
                </div>
                <span className="tabular-nums font-semibold text-sm" style={{ color: "#ef4444" }}>{fmtBRL(p.valor)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── helpers de ordenação por mês ─────────────────────────────────────────────
const MESES_IDX = Object.fromEntries(MESES.map((m, i) => [m, i]));
function sortByMesDesc<T extends { mes: string; data_pagamento?: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const mi = (MESES_IDX[b.mes] ?? -1) - (MESES_IDX[a.mes] ?? -1);
    if (mi !== 0) return mi;
    return (b.data_pagamento || "").localeCompare(a.data_pagamento || "");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACORDOS
// ─────────────────────────────────────────────────────────────────────────────
function AcordosView({ reload, filtroMes }: { reload: () => void; filtroMes?: string }) {
  const [acordos, setAcordos] = useState<Acordo[]>([]);
  const [novo, setNovo] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => { setAcordos(await getAcordos()); }, []);
  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (a: Acordo) => {
    await statusAcordo(a.id, NEXT_STATUS[a.status] || "pago");
    load(); reload();
  };
  const del = async (id: string) => { await deleteAcordo(id); load(); reload(); };

  const sorted = filtroMes
    ? sortByMesDesc(acordos.filter(a => a.mes === filtroMes))
    : sortByMesDesc(acordos);
  const total = acordos.reduce((s, a) => s + a.honorarios, 0);
  const recebido = acordos.filter(a => a.status !== "pendente").reduce((s, a) => s + a.honorarios, 0);
  const pendente = acordos.filter(a => a.status === "pendente").reduce((s, a) => s + a.honorarios, 0);
  const repasse = acordos.filter(a => a.status === "repasse").reduce((s, a) => s + (a.valor_acordo - a.honorarios), 0);

  return (
    <div className="space-y-4">
      <div className="text-xs px-4 py-2.5 rounded-lg" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", color: "var(--text2)" }}>
        📐 Honorários = 10% do valor + 35% do restante (= 41,5% do acordo)
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total" value={total} color="var(--gold)" />
        <MetricCard label="Recebido" value={recebido} color="#22c55e" />
        <MetricCard label="Pendente" value={pendente} color="#ef4444" />
        <MetricCard label="A Repassar ao Cliente" value={repasse} color="#f59e0b" />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm" style={{ color: "var(--text3)" }}>
          {sorted.length} acordos{filtroMes ? <span style={{ color: "var(--gold)" }}> · {filtroMes}</span> : ""}
        </span>
        <button onClick={() => setNovo(true)} className="px-3 py-1.5 rounded-lg text-sm font-semibold"
          style={{ background: "var(--gold)", color: "#000" }}>+ Novo</button>
      </div>
      {novo && <AcordoForm onSave={async f => { await createAcordo(f); setNovo(false); load(); reload(); }} onCancel={() => setNovo(false)} />}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                {["Mês","Data","Cliente","Réu","Processo","Valor Acordo","Honorários","Status",""].map(h => (
                  <th key={h} className="pb-2 text-left pr-3 text-xs uppercase tracking-wider" style={{ color: "var(--text3)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(a => editId === a.id
                ? <tr key={a.id}><td colSpan={9} className="py-2"><AcordoForm initial={a}
                    onSave={async f => { await updateAcordo(a.id, f); setEditId(null); load(); reload(); }}
                    onCancel={() => setEditId(null)} /></td></tr>
                : (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2 pr-3 text-xs whitespace-nowrap font-semibold" style={{ color: "var(--gold)" }}>{a.mes}</td>
                    <td className="py-2 pr-3 text-xs" style={{ color: "var(--text3)" }}>{a.data_pagamento}</td>
                    <td className="py-2 pr-3 font-medium max-w-36 truncate" style={{ color: "var(--text)" }}>{a.cliente}</td>
                    <td className="py-2 pr-3 text-xs" style={{ color: "var(--text3)" }}>{a.reu}</td>
                    <td className="py-2 pr-3 text-xs font-mono max-w-36 truncate" style={{ color: "var(--text3)" }}>{a.processo}</td>
                    <td className="py-2 pr-3 tabular-nums text-xs" style={{ color: "var(--text2)" }}>{fmtBRL(a.valor_acordo)}</td>
                    <td className="py-2 pr-3 tabular-nums font-semibold text-xs" style={{ color: "#22c55e" }}>{fmtBRL(a.honorarios)}</td>
                    <td className="py-2 pr-3"><StatusBtn status={a.status} onClick={() => toggleStatus(a)} /></td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        <button onClick={() => setEditId(a.id)} className="text-xs px-2 py-1 rounded" style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>✏️</button>
                        <button onClick={() => { if(confirm("Excluir?")) del(a.id); }} className="text-xs px-2 py-1 rounded" style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AcordoForm({ initial, onSave, onCancel }: {
  initial?: Partial<Acordo>;
  onSave: (f: Omit<Acordo,"id"|"honorarios">) => Promise<void>;
  onCancel: () => void;
}) {
  const blank = { mes: MESES[0], data_pagamento:"", cliente:"", reu:"", objeto:"", processo:"", valor_acordo:0, status:"pendente" as Status };
  const [form, setForm] = useState({ ...blank, ...(initial || {}) });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Mês</span>
          <Sel value={form.mes} onChange={e => set("mes",e.target.value)}>
            {MESES.map(m => <option key={m} value={m}>{m}</option>)}
          </Sel>
        </div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Data pagamento</span>
          <Inp value={form.data_pagamento} onChange={e => set("data_pagamento",e.target.value)} placeholder="DD/MM/AAAA" /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Cliente *</span>
          <Inp value={form.cliente} onChange={e => set("cliente",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Réu</span>
          <Inp value={form.reu} onChange={e => set("reu",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Objeto</span>
          <Inp value={form.objeto} onChange={e => set("objeto",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Nº Processo</span>
          <Inp value={form.processo} onChange={e => set("processo",e.target.value)} /></div>
        <div>
          <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Valor do Acordo (R$)</span>
          <Inp value={form.valor_acordo || ""} type="number" step="0.01" min="0"
            onChange={e => set("valor_acordo", parseFloat(e.target.value) || 0)} />
          {form.valor_acordo > 0 && (
            <p className="text-xs mt-1 font-medium" style={{ color: "#22c55e" }}>
              Honorários: {fmtBRL(form.valor_acordo * 0.415)}
            </p>
          )}
        </div>
        <div>
          <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Status</span>
          <Sel value={form.status} onChange={e => set("status",e.target.value as Status)}>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="repasse">Repasse pendente</option>
          </Sel>
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={submit} disabled={saving} className="px-5 py-2 rounded-lg font-semibold text-sm" style={{ background:"var(--gold)", color:"#000" }}>{saving?"Salvando...":"Salvar"}</button>
        <button onClick={onCancel} className="px-5 py-2 rounded-lg text-sm" style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>Cancelar</button>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUÇÕES
// ─────────────────────────────────────────────────────────────────────────────
function ExecucoesView({ reload, filtroMes }: { reload: () => void; filtroMes?: string }) {
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [novo, setNovo] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

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
      <div className="text-xs px-4 py-2.5 rounded-lg" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", color: "var(--text2)" }}>
        📐 Honorários = 35% do valor percebido + honorários de sucumbência
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
      {novo && <ExecucaoForm onSave={async f => { await createExecucao(f); setNovo(false); load(); reload(); }} onCancel={() => setNovo(false)} />}
      {execucoes.length === 0 && !novo ? (
        <p className="py-8 text-center text-sm" style={{ color:"var(--text3)" }}>Nenhuma execução cadastrada.</p>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  {["Mês","Data","Cliente","Réu","Processo","Percebido","Sucumbência","Honorários","Status",""].map(h => (
                    <th key={h} className="pb-2 text-left pr-3 text-xs uppercase tracking-wider" style={{ color:"var(--text3)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(e => editId === e.id
                  ? <tr key={e.id}><td colSpan={10} className="py-2"><ExecucaoForm initial={e}
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
  const blank = { mes:MESES[0], data_pagamento:"", cliente:"", reu:"", processo:"", valor_percebido:0, sucumbencia:0, status:"pendente" as Status };
  const [form, setForm] = useState({ ...blank, ...(initial||{}) });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Mês</span>
          <Sel value={form.mes} onChange={e => set("mes",e.target.value)}>{MESES.map(m => <option key={m} value={m}>{m}</option>)}</Sel></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Cliente *</span><Inp value={form.cliente} onChange={e => set("cliente",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Réu</span><Inp value={form.reu} onChange={e => set("reu",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Processo</span><Inp value={form.processo} onChange={e => set("processo",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Valor percebido (R$)</span>
          <Inp type="number" step="0.01" min="0" value={form.valor_percebido||""} onChange={e => set("valor_percebido", parseFloat(e.target.value)||0)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Sucumbência (R$)</span>
          <Inp type="number" step="0.01" min="0" value={form.sucumbencia||""} onChange={e => set("sucumbencia", parseFloat(e.target.value)||0)} />
          <p className="text-xs mt-1 font-medium" style={{ color:"#22c55e" }}>Hon.: {fmtBRL(form.valor_percebido*0.35 + form.sucumbencia)}</p></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Status</span>
          <Sel value={form.status} onChange={e => set("status",e.target.value as Status)}>
            <option value="pendente">Pendente</option><option value="pago">Pago</option><option value="repasse">Repasse pendente</option>
          </Sel></div>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={async () => { setSaving(true); try { await onSave(form); } finally { setSaving(false); } }}
          disabled={saving} className="px-5 py-2 rounded-lg font-semibold text-sm" style={{ background:"var(--gold)", color:"#000" }}>{saving?"Salvando...":"Salvar"}</button>
        <button onClick={onCancel} className="px-5 py-2 rounded-lg text-sm" style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>Cancelar</button>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HONORÁRIOS INICIAIS
// ─────────────────────────────────────────────────────────────────────────────
function HonIniciaisView({ reload }: { reload: () => void }) {
  const [list, setList] = useState<HonorarioInicial[]>([]);
  const [novo, setNovo] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => { setList(await getHonIniciais()); }, []);
  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (h: HonorarioInicial) => {
    await statusHonInicial(h.id, NEXT_STATUS2[h.status] || "pago");
    load(); reload();
  };

  const recebido = list.filter(h => h.status === "pago").reduce((s, h) => s + h.valor, 0);
  const pendente = list.filter(h => h.status === "pendente").reduce((s, h) => s + h.valor, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <MetricCard label="Total" value={recebido + pendente} color="var(--gold)" />
        <MetricCard label="Recebido" value={recebido} color="#22c55e" />
        <MetricCard label="Pendente" value={pendente} color="#ef4444" />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm" style={{ color:"var(--text3)" }}>{list.length} registros</span>
        <button onClick={() => setNovo(true)} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background:"var(--gold)", color:"#000" }}>+ Novo</button>
      </div>
      {novo && <HonInicialForm onSave={async f => { await createHonInicial(f); setNovo(false); load(); reload(); }} onCancel={() => setNovo(false)} />}
      {list.length === 0 && !novo ? (
        <p className="py-8 text-center text-sm" style={{ color:"var(--text3)" }}>Nenhum honorário inicial cadastrado.</p>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  {["Cliente","Processo","Observação","Data Pag.","Valor","Status",""].map(h => (
                    <th key={h} className="pb-2 text-left pr-3 text-xs uppercase tracking-wider" style={{ color:"var(--text3)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map(h => editId === h.id
                  ? <tr key={h.id}><td colSpan={7} className="py-2">
                      <HonInicialForm initial={h} onSave={async f => { await updateHonInicial(h.id, f); setEditId(null); load(); reload(); }} onCancel={() => setEditId(null)} />
                    </td></tr>
                  : (
                    <tr key={h.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="py-2 pr-3 font-medium max-w-40 truncate" style={{ color:"var(--text)" }}>{h.cliente}</td>
                      <td className="py-2 pr-3 text-xs font-mono max-w-36 truncate" style={{ color:"var(--text3)" }}>{h.processo}</td>
                      <td className="py-2 pr-3 text-xs max-w-36 truncate" style={{ color:"var(--text3)" }}>{h.observacao}</td>
                      <td className="py-2 pr-3 text-xs" style={{ color:"var(--text3)" }}>{h.data_pagamento}</td>
                      <td className="py-2 pr-3 tabular-nums font-semibold text-xs" style={{ color:"#22c55e" }}>{fmtBRL(h.valor)}</td>
                      <td className="py-2 pr-3"><StatusBtn status={h.status} onClick={() => toggleStatus(h)} receita={false} /></td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button onClick={() => setEditId(h.id)} className="text-xs px-2 py-1 rounded" style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>✏️</button>
                          <button onClick={() => { if(confirm("Excluir?")) deleteHonInicial(h.id).then(() => { load(); reload(); }); }}
                            className="text-xs px-2 py-1 rounded" style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>🗑</button>
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

function HonInicialForm({ initial, onSave, onCancel }: {
  initial?: Partial<HonorarioInicial>; onSave: (f: Omit<HonorarioInicial,"id">) => Promise<void>; onCancel: () => void;
}) {
  const blank = { cliente:"", processo:"", valor:0, data_pagamento:"", observacao:"", status:"pendente" as Status };
  const [form, setForm] = useState({ ...blank, ...(initial||{}) });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | number) => setForm(p => ({ ...p, [k]: v }));
  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Cliente *</span><Inp value={form.cliente} onChange={e => set("cliente",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Processo</span><Inp value={form.processo} onChange={e => set("processo",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Valor (R$)</span>
          <Inp type="number" step="0.01" min="0" value={form.valor||""} onChange={e => set("valor", parseFloat(e.target.value)||0)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Data pagamento</span><Inp value={form.data_pagamento} onChange={e => set("data_pagamento",e.target.value)} placeholder="DD/MM/AAAA" /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Observação</span><Inp value={form.observacao} onChange={e => set("observacao",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Status</span>
          <Sel value={form.status} onChange={e => set("status",e.target.value as Status)}>
            <option value="pendente">Pendente</option><option value="pago">Pago</option>
          </Sel></div>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={async () => { setSaving(true); try { await onSave(form); } finally { setSaving(false); } }}
          disabled={saving} className="px-5 py-2 rounded-lg font-semibold text-sm" style={{ background:"var(--gold)", color:"#000" }}>{saving?"Salvando...":"Salvar"}</button>
        <button onClick={onCancel} className="px-5 py-2 rounded-lg text-sm" style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>Cancelar</button>
      </div>
    </Card>
  );
}

// ── detectar mês atual no array COLS ─────────────────────────────────────────
function getCurrentCol(): string {
  const now = new Date();
  const MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return MONTH_SHORT[now.getMonth()];
}

function getColIndex(): number {
  const now = new Date();
  return now.getFullYear() * 12 + now.getMonth() - (2025 * 12 + 9);
}

function getCurrentMes(): string {
  const now = new Date();
  const M = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${M[now.getMonth()]}/${now.getFullYear()}`;
}

function getNextMes(): string {
  const d = new Date(); d.setMonth(d.getMonth() + 1);
  const M = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${M[d.getMonth()]}/${d.getFullYear()}`;
}

// ── alertas de pendências ─────────────────────────────────────────────────────
function AlertasPendentes() {
  const [acordos, setAcordos] = useState<Acordo[]>([]);
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [loaded, setLoaded] = useState(false);
  const curMes = getCurrentMes();
  const nextMes = getNextMes();

  useEffect(() => {
    Promise.all([getAcordos(), getExecucoes()]).then(([a, e]) => {
      setAcordos(a); setExecucoes(e); setLoaded(true);
    });
  }, []);

  if (!loaded) return null;

  const curIdx = MESES.indexOf(curMes);
  const atrasados = [
    ...acordos.filter(a => a.status === "pendente" && MESES.indexOf(a.mes) < curIdx && MESES.indexOf(a.mes) >= 0)
      .map(a => ({ tipo: "Acordo", cliente: a.cliente, mes: a.mes, valor: a.honorarios })),
    ...execucoes.filter(e => e.status === "pendente" && MESES.indexOf(e.mes) < curIdx && MESES.indexOf(e.mes) >= 0)
      .map(e => ({ tipo: "Execução", cliente: e.cliente, mes: e.mes, valor: e.honorarios })),
  ];
  const proximos = [
    ...acordos.filter(a => a.status === "pendente" && a.mes === nextMes)
      .map(a => ({ tipo: "Acordo", cliente: a.cliente, mes: a.mes, valor: a.honorarios })),
    ...execucoes.filter(e => e.status === "pendente" && e.mes === nextMes)
      .map(e => ({ tipo: "Execução", cliente: e.cliente, mes: e.mes, valor: e.honorarios })),
  ];

  if (atrasados.length === 0 && proximos.length === 0) return null;

  return (
    <div className="space-y-2">
      {atrasados.length > 0 && (
        <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "#f87171" }}>⚠️ Honorários em Atraso ({atrasados.length})</p>
          <div className="flex flex-wrap gap-2">
            {atrasados.map((a, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                {a.tipo} · {a.cliente} · {a.mes} · {fmtBRL(a.valor)}
              </span>
            ))}
          </div>
        </div>
      )}
      {proximos.length > 0 && (
        <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.25)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "#facc15" }}>📅 Vencimentos em {nextMes} ({proximos.length})</p>
          <div className="flex flex-wrap gap-2">
            {proximos.map((p, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(234,179,8,0.12)", color: "#facc15", border: "1px solid rgba(234,179,8,0.3)" }}>
                {p.tipo} · {p.cliente} · {fmtBRL(p.valor)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DESPESAS FIXAS
// ─────────────────────────────────────────────────────────────────────────────
interface FixaFormData { categoria: string; quem: string; valor: string; valor_fixo: string; }

function FixaFormInline({ form, setForm, onSave, onCancel }: {
  form: FixaFormData;
  setForm: React.Dispatch<React.SetStateAction<FixaFormData>>;
  onSave: () => void;
  onCancel: () => void;
}) {
  const temValorFixo = !!form.valor_fixo && parseFloat(form.valor_fixo) > 0;
  return (
    <div className="flex flex-wrap gap-2 items-end px-4 py-3 rounded-xl" style={{ background:"var(--surface)", border:"1px solid var(--gold)" }}>
      <div className="flex-1 min-w-32">
        <p className="text-xs mb-1" style={{ color:"var(--text3)" }}>Categoria</p>
        <input className="w-full px-3 py-1.5 rounded-lg text-sm" style={{ background:"var(--surface2)", color:"var(--text)", border:"1px solid var(--border)" }}
          value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ex: Aluguel" />
      </div>
      <div className="w-28">
        <p className="text-xs mb-1" style={{ color:"var(--text3)" }}>Quem paga</p>
        <input className="w-full px-3 py-1.5 rounded-lg text-sm" style={{ background:"var(--surface2)", color:"var(--text)", border:"1px solid var(--border)" }}
          value={form.quem} onChange={e => setForm(f => ({ ...f, quem: e.target.value }))} placeholder="dividido" />
      </div>
      <div className="w-36">
        <p className="text-xs mb-1 flex items-center gap-1" style={{ color:"var(--gold)" }}>🔒 Valor fixo mensal</p>
        <input type="number" className="w-full px-3 py-1.5 rounded-lg text-sm" style={{ background:"var(--surface2)", color:"var(--text)", border:"1px solid var(--gold)" }}
          value={form.valor_fixo} onChange={e => setForm(f => ({ ...f, valor_fixo: e.target.value }))} placeholder="ex: 1600" />
        <p className="text-xs mt-0.5" style={{ color:"var(--text3)" }}>repete todo mês</p>
      </div>
      {!temValorFixo && (
        <div className="w-28">
          <p className="text-xs mb-1" style={{ color:"var(--text3)" }}>Valor este mês</p>
          <input type="number" className="w-full px-3 py-1.5 rounded-lg text-sm" style={{ background:"var(--surface2)", color:"var(--text)", border:"1px solid var(--border)" }}
            value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onSave} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background:"var(--gold)", color:"#000" }}>Salvar</button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm" style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>Cancelar</button>
      </div>
    </div>
  );
}

function FixasView() {
  const [fixas, setFixas] = useState<Fixa[]>([]);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [editCat, setEditCat] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FixaFormData>({ categoria: "", quem: "", valor: "", valor_fixo: "" });
  const [novo, setNovo] = useState(false);
  const mesAtual = getCurrentCol();

  const load = useCallback(() => { getFixas().then(setFixas); }, []);
  useEffect(() => { load(); }, [load]);

  const totalMes = fixas.reduce((s, f) => s + (f.valor_fixo > 0 ? f.valor_fixo : (f.valores[mesAtual] || 0)), 0);

  const toggleExpand = (cat: string) => setExpandidos(e => ({ ...e, [cat]: !e[cat] }));

  const startEdit = (f: Fixa) => {
    setEditCat(f.categoria);
    setEditForm({ categoria: f.categoria, quem: f.quem || "", valor: String(f.valores[mesAtual] || ""), valor_fixo: f.valor_fixo ? String(f.valor_fixo) : "" });
    setNovo(false);
  };

  const saveEdit = async () => {
    if (!editCat) return;
    const f = fixas.find(x => x.categoria === editCat)!;
    const vf = parseFloat(editForm.valor_fixo) || 0;
    const novoValor = vf > 0 ? vf : (parseFloat(editForm.valor) || 0);
    const novosValores = vf > 0 ? f.valores : { ...f.valores, [mesAtual]: novoValor };
    await updateFixa(editCat, {
      nova_categoria: editForm.categoria !== editCat ? editForm.categoria : undefined,
      quem: editForm.quem,
      valores: novosValores,
      valor_fixo: vf,
    });
    setEditCat(null);
    load();
  };

  const handleDelete = async (cat: string) => {
    if (!confirm(`Excluir "${cat}"?`)) return;
    await deleteFixa(cat);
    load();
  };

  const handleConcluir = async (cat: string) => {
    await statusFixaMes(cat, mesAtual, "pago");
    load();
  };

  const handleDesfazerPago = async (cat: string) => {
    await statusFixaMes(cat, mesAtual, "pendente");
    load();
  };

  const saveNova = async () => {
    const vf = parseFloat(editForm.valor_fixo) || 0;
    const valor = vf > 0 ? vf : (parseFloat(editForm.valor) || 0);
    await createFixa({ categoria: editForm.categoria, quem: editForm.quem, valores: vf > 0 ? {} : { [mesAtual]: valor }, valor_fixo: vf });
    setNovo(false);
    setEditForm({ categoria: "", quem: "", valor: "", valor_fixo: "" });
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span style={{ color:"var(--text3)" }} className="text-sm">Mês atual: <span className="font-semibold" style={{ color:"var(--gold)" }}>{fmtBRL(totalMes)}</span></span>
        <button onClick={() => { setNovo(true); setEditCat(null); setEditForm({ categoria:"", quem:"", valor:"", valor_fixo:"" }); }}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background:"var(--gold)", color:"#000" }}>+ Nova</button>
      </div>

      {novo && <FixaFormInline form={editForm} setForm={setEditForm} onSave={saveNova} onCancel={() => setNovo(false)} />}

      <div className="space-y-2">
        {fixas.map(f => {
          const valMes = f.valores[mesAtual] || 0;
          const expanded = expandidos[f.categoria];
          const mesesComValor = COLS.filter(c => (f.valores[c] || 0) > 0);
          const pago = (f.status || {})[mesAtual] === "pago";
          const fixo = f.valor_fixo > 0;
          const valExibido = fixo ? f.valor_fixo : valMes;

          if (editCat === f.categoria) {
            return <FixaFormInline key={f.categoria} form={editForm} setForm={setEditForm} onSave={saveEdit} onCancel={() => setEditCat(null)} />;
          }

          return (
            <div key={f.categoria} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 px-4 py-3 flex-wrap" style={{ background: "var(--surface)" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm" style={{ color:"var(--text)" }}>{f.categoria}</span>
                    {fixo && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background:"rgba(212,175,55,0.15)", color:"var(--gold)", border:"1px solid rgba(212,175,55,0.3)" }}>🔒 fixo</span>}
                  </div>
                  {f.quem && <span className="text-xs" style={{ color:"var(--text3)" }}>{f.quem}</span>}
                </div>
                <div className="text-right shrink-0">
                  <p className="tabular-nums font-semibold text-sm" style={{ color: pago ? "#22c55e" : valExibido > 0 ? "var(--text2)" : "var(--text3)" }}>
                    {valExibido > 0 ? fmtBRL(valExibido) : "—"}
                  </p>
                  {fixo && !pago && <p className="text-xs" style={{ color:"var(--text3)" }}>todo mês</p>}
                </div>
                {/* Toggle pago — sempre visível */}
                {pago ? (
                  <button onClick={() => handleDesfazerPago(f.categoria)}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-medium shrink-0"
                    style={{ background:"rgba(34,197,94,0.12)", color:"#4ade80", border:"1px solid rgba(34,197,94,0.4)" }}>
                    ✓ Pago
                  </button>
                ) : (
                  <button onClick={() => handleConcluir(f.categoria)}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-medium shrink-0"
                    style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>
                    ○ Pagar
                  </button>
                )}
                {/* Ações separadas por divider visual */}
                <div className="w-px h-5 shrink-0" style={{ background:"var(--border)" }} />
                <button onClick={() => toggleExpand(f.categoria)}
                  className="text-xs px-2 py-1.5 rounded-lg shrink-0"
                  style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>
                  {expanded ? "▲" : "▼"}
                </button>
                <button onClick={() => startEdit(f)}
                  className="text-xs px-2 py-1.5 rounded-lg shrink-0"
                  style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>✏️</button>
                <button onClick={() => handleDelete(f.categoria)}
                  className="text-xs px-2 py-1.5 rounded-lg shrink-0"
                  style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>🗑</button>
              </div>

              {expanded && (
                <div className="px-4 pb-3 pt-2" style={{ background: "var(--surface2)", borderTop: "1px solid var(--border)" }}>
                  <div className="flex flex-wrap gap-2">
                    {mesesComValor.map(c => {
                      const isPago = (f.status || {})[c] === "pago";
                      return (
                        <div key={c} className="px-3 py-1.5 rounded-lg text-xs" style={{ background:"var(--surface)", border:`1px solid ${isPago ? "rgba(34,197,94,0.3)" : "var(--border)"}` }}>
                          <span style={{ color:"var(--text3)" }}>{COL_TO_MES[c] || c}: </span>
                          <span className="font-semibold tabular-nums" style={{ color: isPago ? "#4ade80" : c === mesAtual ? "var(--gold)" : "var(--text2)" }}>
                            {fmtBRL(f.valores[c])}{isPago ? " ✓" : ""}
                          </span>
                        </div>
                      );
                    })}
                    {mesesComValor.length === 0 && <span className="text-xs" style={{ color:"var(--text3)" }}>Nenhum valor lançado.</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ── helpers para variáveis ────────────────────────────────────────────────────
function varParcelaMes(v: Variavel): number {
  const n = parseInt(v.parcelas) || 1;
  return n > 0 ? Math.round((v.valor / n) * 100) / 100 : v.valor;
}

function varProgress(v: Variavel, mesAtual: string): { pago: number; total: number } {
  const total = parseInt(v.parcelas) || 1;
  const mesAtualIdx = COLS.indexOf(mesAtual);
  const pago = COLS.filter((c, i) => i <= mesAtualIdx && (v.meses[c] || 0) > 0).length;
  return { pago, total };
}

function varDateRange(v: Variavel): string {
  const mesesKeys = Object.keys(v.meses || {}).filter(k => (v.meses[k] || 0) > 0);
  if (mesesKeys.length === 0) return v.data_compra || "";
  const idxs = mesesKeys.map(k => COLS.indexOf(k)).filter(i => i >= 0);
  if (idxs.length === 0) return v.data_compra || "";
  const minI = Math.min(...idxs);
  const maxI = Math.max(...idxs);
  const start = COL_TO_MES[COLS[minI]] || COLS[minI];
  const end = COL_TO_MES[COLS[maxI]] || COLS[maxI];
  return start === end ? start : `${start} → ${end}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DESPESAS VARIÁVEIS
// ─────────────────────────────────────────────────────────────────────────────
function VariaveisView() {
  const [variaveis, setVariaveis] = useState<Variavel[]>([]);
  const [novo, setNovo] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const mesAtual = getCurrentCol();

  const load = useCallback(async () => { setVariaveis(await getVariaveis()); }, []);
  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (v: Variavel) => {
    await statusVariavel(v.id, NEXT_STATUS2[v.status] || "pago");
    load();
  };
  const del = async (id: string) => { await deleteVariavel(id); load(); };
  const toggleExpand = (id: string) => setExpandidos(e => ({ ...e, [id]: !e[id] }));

  const ativas = variaveis.filter(v => v.status === "pendente");
  const pagas = variaveis.filter(v => v.status === "pago");
  const totalAtivas = ativas.reduce((s, v) => s + v.valor, 0);
  const totalMesAtivo = ativas.reduce((s, v) => s + (v.meses[mesAtual] || 0), 0);

  const colIdx = getColIndex();
  const nextCol = colIdx + 1 < COLS.length ? COLS[colIdx + 1] : null;

  const renderCard = (v: Variavel) => {
    if (editId === v.id) {
      return <VariavelForm key={v.id} initial={v} onSave={async f => { await updateVariavel(v.id, f); setEditId(null); load(); }} onCancel={() => setEditId(null)} />;
    }
    const parcelaMes = varParcelaMes(v);
    const valorMesAtual = v.meses[mesAtual] || 0;
    const prog = varProgress(v, mesAtual);
    const hasCurrentMonth = valorMesAtual > 0;
    const hasNextMonth = nextCol && (v.meses[nextCol] || 0) > 0;
    return (
      <div key={v.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: "var(--surface)" }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm" style={{ color:"var(--text)" }}>{v.descricao}</p>
              {hasCurrentMonth && <span title="Parcela neste mês" className="text-xs">🔵</span>}
              {hasNextMonth && <span title="Parcela no próximo mês" className="text-xs">🟠</span>}
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums"
                style={{ background: prog.pago >= prog.total ? "rgba(34,197,94,0.12)" : "rgba(var(--gold-rgb,212,175,55),0.12)", color: prog.pago >= prog.total ? "#4ade80" : "var(--gold)", border: `1px solid ${prog.pago >= prog.total ? "rgba(34,197,94,0.3)" : "rgba(212,175,55,0.3)"}` }}>
                {prog.pago}/{prog.total}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color:"var(--text3)" }}>
              {v.quem}{v.onde ? ` · ${v.onde}` : ""}
              {v.data_compra ? ` · compra: ${v.data_compra}` : ""}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="tabular-nums font-semibold text-sm" style={{ color:"var(--gold)" }}>{fmtBRL(v.valor)}</p>
            <p className="text-xs tabular-nums" style={{ color: valorMesAtual > 0 ? "#22c55e" : "var(--text3)" }}>
              {valorMesAtual > 0 ? `${fmtBRL(valorMesAtual)}/mês` : `${fmtBRL(parcelaMes)}/parc.`}
            </p>
          </div>
          <StatusBtn status={v.status} onClick={() => toggleStatus(v)} receita={false} />
          <button onClick={() => toggleExpand(v.id)}
            className="text-xs px-2 py-1 rounded" style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>
            {expandidos[v.id] ? "▲" : "▼"}
          </button>
          <button onClick={() => setEditId(v.id)} className="text-xs px-2 py-1 rounded" style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>✏️</button>
          <button onClick={() => { if(confirm("Excluir?")) del(v.id); }} className="text-xs px-2 py-1 rounded" style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>🗑</button>
        </div>
        {expandidos[v.id] && (
          <div className="px-4 pb-3 pt-2" style={{ background: "var(--surface2)", borderTop: "1px solid var(--border)" }}>
            <div className="flex flex-wrap gap-2">
              {COLS.filter(c => (v.meses[c] || 0) > 0).map(c => (
                <div key={c} className="px-3 py-1.5 rounded-lg text-xs" style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
                  <span style={{ color:"var(--text3)" }}>{COL_TO_MES[c] || c}: </span>
                  <span className="font-semibold tabular-nums" style={{ color: c === mesAtual ? "var(--gold)" : "var(--text2)" }}>
                    {fmtBRL(v.meses[c])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMini = (v: Variavel) => {
    if (editId === v.id) {
      return <VariavelForm key={v.id} initial={v} onSave={async f => { await updateVariavel(v.id, f); setEditId(null); load(); }} onCancel={() => setEditId(null)} />;
    }
    const range = varDateRange(v);
    const parcelaMes = varParcelaMes(v);
    const prog = varProgress(v, mesAtual);
    return (
      <div key={v.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", opacity: 0.75 }}>
        <div className="flex items-center gap-3 px-4 py-2" style={{ background: "var(--surface)" }}>
          <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
            <span className="font-medium text-sm" style={{ color:"var(--text2)" }}>{v.descricao}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums" style={{ background:"rgba(34,197,94,0.1)", color:"#4ade80", border:"1px solid rgba(34,197,94,0.2)" }}>{prog.pago}/{prog.total}</span>
            {range && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>{range}</span>}
            <span className="text-xs tabular-nums" style={{ color:"var(--text3)" }}>{fmtBRL(parcelaMes)}/parc. · {fmtBRL(v.valor)} total</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background:"rgba(34,197,94,0.1)", color:"#4ade80", border:"1px solid rgba(34,197,94,0.2)" }}>pago</span>
          <button onClick={() => toggleExpand(v.id)}
            className="text-xs px-2 py-1 rounded" style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>
            {expandidos[v.id] ? "▲" : "▼"}
          </button>
          <button onClick={() => setEditId(v.id)} className="text-xs px-2 py-1 rounded" style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>✏️</button>
          <button onClick={() => { if(confirm("Excluir?")) del(v.id); }} className="text-xs px-2 py-1 rounded" style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>🗑</button>
        </div>
        {expandidos[v.id] && (
          <div className="px-4 pb-3 pt-2" style={{ background: "var(--surface2)", borderTop: "1px solid var(--border)" }}>
            <div className="flex flex-wrap gap-2">
              {COLS.filter(c => (v.meses[c] || 0) > 0).map(c => (
                <div key={c} className="px-3 py-1.5 rounded-lg text-xs" style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
                  <span style={{ color:"var(--text3)" }}>{COL_TO_MES[c] || c}: </span>
                  <span className="font-semibold tabular-nums" style={{ color:"var(--text2)" }}>{fmtBRL(v.meses[c])}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-4 text-sm flex-wrap">
          <span style={{ color:"var(--text3)" }}>Ativas: <span className="font-semibold" style={{ color:"var(--gold)" }}>{fmtBRL(totalAtivas)}</span></span>
          <span style={{ color:"var(--text3)" }}>Este mês: <span className="font-semibold" style={{ color:"#22c55e" }}>{fmtBRL(totalMesAtivo)}</span></span>
        </div>
        <button onClick={() => setNovo(true)} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background:"var(--gold)", color:"#000" }}>+ Nova</button>
      </div>

      {novo && <VariavelForm onSave={async f => { await createVariavel(f); setNovo(false); load(); }} onCancel={() => setNovo(false)} />}

      {/* Ativas */}
      {ativas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider font-semibold px-1" style={{ color:"var(--text3)" }}>● Ativas ({ativas.length})</p>
          {ativas.map(renderCard)}
        </div>
      )}

      {/* Pagas minimizadas */}
      {pagas.length > 0 && (
        <div className="space-y-2 mt-4">
          <p className="text-xs uppercase tracking-wider font-semibold px-1" style={{ color:"var(--text3)" }}>✓ Pagas ({pagas.length})</p>
          {pagas.map(renderMini)}
        </div>
      )}

      {variaveis.length === 0 && !novo && (
        <p className="py-8 text-center text-sm" style={{ color:"var(--text3)" }}>Nenhuma despesa variável cadastrada.</p>
      )}
    </div>
  );
}

function VariavelForm({ initial, onSave, onCancel }: {
  initial?: Partial<Variavel>; onSave: (f: Omit<Variavel,"id">) => Promise<void>; onCancel: () => void;
}) {
  const blank = { descricao:"", valor:0, parcelas:"1x", quem:"dividido", onde:"", status:"pendente" as Status, data_compra:"", meses:{} };
  const [form, setForm] = useState({ ...blank, ...(initial||{}) });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | number) => setForm(p => ({ ...p, [k]: v }));
  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Descrição *</span><Inp value={form.descricao} onChange={e => set("descricao",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Valor Total (R$)</span>
          <Inp type="number" step="0.01" min="0" value={form.valor||""} onChange={e => set("valor",parseFloat(e.target.value)||0)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Parcelas</span><Inp value={form.parcelas} onChange={e => set("parcelas",e.target.value)} placeholder="ex: 3x" /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Responsável</span>
          <Sel value={form.quem} onChange={e => set("quem",e.target.value)}>
            <option value="dividido">Dividido</option><option value="Adriely">Adriely</option><option value="Eduarda">Eduarda</option>
          </Sel></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Onde</span><Inp value={form.onde} onChange={e => set("onde",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Data compra</span><Inp value={form.data_compra} onChange={e => set("data_compra",e.target.value)} placeholder="DD/MM/AAAA" /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Status</span>
          <Sel value={form.status} onChange={e => set("status",e.target.value as Status)}>
            <option value="pendente">Pendente</option><option value="pago">Pago</option>
          </Sel></div>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={async () => { setSaving(true); try { await onSave(form); } finally { setSaving(false); } }}
          disabled={saving} className="px-5 py-2 rounded-lg font-semibold text-sm" style={{ background:"var(--gold)", color:"#000" }}>{saving?"Salvando...":"Salvar"}</button>
        <button onClick={onCancel} className="px-5 py-2 rounded-lg text-sm" style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>Cancelar</button>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEITAS E PARTICIPAÇÃO DOS SÓCIOS
// ─────────────────────────────────────────────────────────────────────────────
function ReceitasSociosView() {
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

  // Corrigido: data no formato DD/MM/AAAA; datas inválidas são EXCLUÍDAS em filtros (não inclusas)
  function parseData(s: string): Date | null {
    if (!s) return null;
    const p = s.split("/");
    if (p.length === 3) return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function dentroDoFiltro(data: string): boolean {
    if (periodo === "todos") return true;
    const d = parseData(data);
    if (!d) return false; // corrigido: data inválida = excluir do filtro
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
    acordos.filter(a => a.status === "pago" && dentroDoFiltro(a.data_pagamento)).reduce((s, a) => s + a.honorarios, 0) +
    execucoes.filter(e => e.status === "pago" && dentroDoFiltro(e.data_pagamento)).reduce((s, e) => s + e.honorarios, 0) +
    honIniciais.filter(h => h.status === "pago" && dentroDoFiltro(h.data_pagamento)).reduce((s, h) => s + h.valor, 0);

  const totalPendente =
    acordos.filter(a => a.status !== "pago" && dentroDoFiltro(a.data_pagamento)).reduce((s, a) => s + a.honorarios, 0) +
    execucoes.filter(e => e.status !== "pago" && dentroDoFiltro(e.data_pagamento)).reduce((s, e) => s + e.honorarios, 0) +
    honIniciais.filter(h => h.status !== "pago" && dentroDoFiltro(h.data_pagamento)).reduce((s, h) => s + h.valor, 0);

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
                { label: "Acordos", val: acordos.filter(a => a.status === "pago" && dentroDoFiltro(a.data_pagamento)).reduce((s,a)=>s+a.honorarios,0) },
                { label: "Execuções", val: execucoes.filter(e => e.status === "pago" && dentroDoFiltro(e.data_pagamento)).reduce((s,e)=>s+e.honorarios,0) },
                { label: "Hon. Iniciais", val: honIniciais.filter(h => h.status === "pago" && dentroDoFiltro(h.data_pagamento)).reduce((s,h)=>s+h.valor,0) },
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

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DO ESCRITÓRIO
// ─────────────────────────────────────────────────────────────────────────────
function ConfiguracaoView() {
  const [config, setConfig] = useState<ConfigEscritorio>({ tipo: "individual", socios: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok"|"err"; text: string } | null>(null);

  useEffect(() => { getConfig().then(c => { setConfig(c); setLoading(false); }); }, []);

  const addSocio = () => {
    const id = Math.random().toString(36).slice(2, 8);
    setConfig(c => ({ ...c, socios: [...c.socios, { id, nome: "", percentual: 0 }] }));
  };

  const removeSocio = (id: string) => setConfig(c => ({ ...c, socios: c.socios.filter(s => s.id !== id) }));

  const updateSocio = (id: string, field: keyof Socio, value: string | number) =>
    setConfig(c => ({ ...c, socios: c.socios.map(s => s.id === id ? { ...s, [field]: value } : s) }));

  const totalPct = config.socios.reduce((s, so) => s + (so.percentual || 0), 0);

  const save = async () => {
    setSaving(true);
    try {
      await saveConfig(config);
      setMsg({ type: "ok", text: "Configuração salva com sucesso." });
    } catch {
      setMsg({ type: "err", text: "Erro ao salvar." });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="py-8 text-center" style={{ color: "var(--text3)" }}>Carregando...</div>;

  const inpStyle = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" };

  return (
    <div className="space-y-6 max-w-2xl">
      {msg && (
        <div className="px-4 py-2.5 rounded-lg text-sm"
          style={{ background: msg.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.type === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, color: msg.type === "ok" ? "#4ade80" : "#f87171" }}>
          {msg.text}
        </div>
      )}

      <Card>
        <h2 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Tipo de Escritório</h2>
        <div className="flex gap-3">
          {([["individual","Escritório Individual"],["socios","Escritório com Sócios"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => setConfig(c => ({ ...c, tipo: val }))}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all"
              style={{ background: config.tipo === val ? "rgba(201,168,76,0.15)" : "var(--surface2)", border: `2px solid ${config.tipo === val ? "var(--gold)" : "var(--border)"}`, color: config.tipo === val ? "var(--gold)" : "var(--text2)" }}>
              {val === "individual" ? "👤" : "👥"} {label}
            </button>
          ))}
        </div>
      </Card>

      {config.tipo === "socios" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>Sócias / Sócios</h2>
            <button onClick={addSocio} className="px-3 py-1.5 rounded-lg text-sm font-semibold"
              style={{ background: "var(--gold)", color: "#000" }}>+ Adicionar</button>
          </div>

          {config.socios.length === 0 && (
            <p className="text-sm py-4 text-center" style={{ color: "var(--text3)" }}>Nenhum sócio cadastrado.</p>
          )}

          <div className="space-y-3">
            {config.socios.map(s => (
              <div key={s.id} className="flex gap-3 items-center">
                <input value={s.nome} onChange={e => updateSocio(s.id, "nome", e.target.value)}
                  placeholder="Nome do sócio" className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={inpStyle} />
                <div className="flex items-center gap-1.5 shrink-0">
                  <input type="number" value={s.percentual} onChange={e => updateSocio(s.id, "percentual", parseFloat(e.target.value) || 0)}
                    min="0" max="100" step="0.5" placeholder="%" className="w-20 px-3 py-2 rounded-lg text-sm outline-none" style={inpStyle} />
                  <span className="text-sm" style={{ color: "var(--text3)" }}>%</span>
                </div>
                <button onClick={() => removeSocio(s.id)} className="p-2 rounded-lg hover:bg-red-500/10" style={{ color: "#f87171" }}>🗑</button>
              </div>
            ))}
          </div>

          {config.socios.length > 0 && (
            <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm" style={{ color: "var(--text3)" }}>Total de participação:</span>
              <span className="font-semibold text-sm" style={{ color: totalPct === 100 ? "#4ade80" : "#f87171" }}>
                {totalPct.toFixed(1)}% {totalPct !== 100 && "(deve ser 100%)"}
              </span>
            </div>
          )}
        </Card>
      )}

      {config.tipo === "socios" && config.socios.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-3" style={{ color: "var(--text)" }}>📊 Demonstrativo de distribuição</h2>
          <p className="text-xs mb-4" style={{ color: "var(--text3)" }}>
            Com base na configuração atual, os honorários serão distribuídos da seguinte forma:
          </p>
          <div className="space-y-2">
            {config.socios.filter(s => s.nome).map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-lg"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <span className="flex-1 text-sm font-medium" style={{ color: "var(--text)" }}>{s.nome}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 rounded-full" style={{ width: `${s.percentual * 1.5}px`, maxWidth: "120px", background: "var(--gold)", minWidth: "4px" }} />
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--gold)" }}>{s.percentual}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <button onClick={save} disabled={saving}
        className="px-6 py-2.5 rounded-xl font-semibold text-sm"
        style={{ background: saving ? "var(--surface2)" : "var(--gold)", color: saving ? "var(--text3)" : "#000" }}>
        {saving ? "Salvando..." : "Salvar configuração"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function FinanceiroPage() {
  const [aba, setAba] = useState(0);
  const [dash, setDash] = useState<DashFinanceiro | null>(null);
  const [filtroMes, setFiltroMes] = useState<string>("todos");

  const mesAtualLabel = getCurrentMes();
  const mesProximoLabel = getNextMes();

  const loadDash = useCallback(async () => { setDash(await getDash()); }, []);
  useEffect(() => { loadDash(); }, [loadDash]);

  const tabStyle = (i: number) => ({
    background: aba === i ? "var(--gold)" : "var(--surface2)",
    color: aba === i ? "#000" : "var(--text2)",
    border: "1px solid var(--border)",
  });

  const filtroAtivo = filtroMes === "todos" ? undefined
    : filtroMes === "atual" ? mesAtualLabel
    : mesProximoLabel;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold" style={{ color:"var(--text)" }}>Financeiro Escritório</h1>
          <p className="text-sm mt-0.5" style={{ color:"var(--text3)" }}>
            Sócias: Adriely & Eduarda &nbsp;·&nbsp;
            <span className="font-semibold" style={{ color: "var(--gold)" }}>{mesAtualLabel}</span>
          </p>
        </div>
        {/* Filtro por competência */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs" style={{ color: "var(--text3)" }}>Competência:</span>
          {[
            { key: "todos", label: "Todos" },
            { key: "atual", label: `🔵 ${mesAtualLabel}` },
            { key: "proximo", label: `🟠 ${mesProximoLabel}` },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltroMes(f.key)}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: filtroMes === f.key ? "var(--gold)" : "var(--surface2)",
                color: filtroMes === f.key ? "#000" : "var(--text2)",
                border: `1px solid ${filtroMes === f.key ? "var(--gold)" : "var(--border)"}`,
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alertas */}
      <AlertasPendentes />

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
      {aba === 0 && (dash ? <DashView data={dash} /> : <div className="py-8 text-center" style={{ color:"var(--text3)" }}>Carregando...</div>)}
      {aba === 1 && <AcordosView reload={loadDash} filtroMes={filtroAtivo} />}
      {aba === 2 && <ExecucoesView reload={loadDash} filtroMes={filtroAtivo} />}
      {aba === 3 && <HonIniciaisView reload={loadDash} />}
      {aba === 4 && <FixasView />}
      {aba === 5 && <VariaveisView />}
      {aba === 6 && <ConfiguracaoView />}
      {aba === 7 && <ReceitasSociosView />}
    </div>
  );
}
