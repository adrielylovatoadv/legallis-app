"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getDash, getAcordos, getExecucoes, getHonIniciais, getFixas, getVariaveis,
  createAcordo, updateAcordo, deleteAcordo, statusAcordo,
  createExecucao, updateExecucao, deleteExecucao, statusExecucao,
  createHonInicial, updateHonInicial, deleteHonInicial, statusHonInicial,
  updateFixa, createVariavel, updateVariavel, deleteVariavel, statusVariavel,
  fmtBRL, MESES, COLS, COL_TO_MES, NEXT_STATUS, NEXT_STATUS2, statusBadge, statusLabel,
  type DashFinanceiro, type Acordo, type Execucao, type HonorarioInicial,
  type Fixa, type Variavel, type Status,
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
const ABAS = ["📊 Dashboard","🤝 Acordos","⚖️ Execuções","💼 Hon. Iniciais","🏢 Desp. Fixas","🛒 Desp. Variáveis"] as const;

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

// ─────────────────────────────────────────────────────────────────────────────
// ACORDOS
// ─────────────────────────────────────────────────────────────────────────────
function AcordosView({ reload }: { reload: () => void }) {
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
        <span className="text-sm" style={{ color: "var(--text3)" }}>{acordos.length} acordos</span>
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
              {acordos.map(a => editId === a.id
                ? <tr key={a.id}><td colSpan={9} className="py-2"><AcordoForm initial={a}
                    onSave={async f => { await updateAcordo(a.id, f); setEditId(null); load(); reload(); }}
                    onCancel={() => setEditId(null)} /></td></tr>
                : (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2 pr-3 text-xs whitespace-nowrap" style={{ color: "var(--text2)" }}>{a.mes}</td>
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
function ExecucoesView({ reload }: { reload: () => void }) {
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

  return (
    <div className="space-y-4">
      <div className="text-xs px-4 py-2.5 rounded-lg" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", color: "var(--text2)" }}>
        📐 Honorários = 35% do valor percebido + honorários de sucumbência
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm" style={{ color:"var(--text3)" }}>{execucoes.length} execuções</span>
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
                  {["Mês","Cliente","Réu","Processo","Percebido","Sucumbência","Honorários","Status",""].map(h => (
                    <th key={h} className="pb-2 text-left pr-3 text-xs uppercase tracking-wider" style={{ color:"var(--text3)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {execucoes.map(e => editId === e.id
                  ? <tr key={e.id}><td colSpan={9} className="py-2"><ExecucaoForm initial={e}
                      onSave={async f => { await updateExecucao(e.id, f); setEditId(null); load(); reload(); }}
                      onCancel={() => setEditId(null)} /></td></tr>
                  : (
                    <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="py-2 pr-3 text-xs" style={{ color:"var(--text2)" }}>{e.mes}</td>
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm" style={{ color:"var(--text3)" }}>
          Total recebido: <span className="font-semibold text-green-400">{fmtBRL(list.filter(h=>h.status==="pago").reduce((s,h)=>s+h.valor,0))}</span>
          {" · "} Pendente: <span className="font-semibold text-red-400">{fmtBRL(list.filter(h=>h.status==="pendente").reduce((s,h)=>s+h.valor,0))}</span>
        </span>
        <button onClick={() => setNovo(true)} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background:"var(--gold)", color:"#000" }}>+ Novo</button>
      </div>
      {novo && <HonInicialForm onSave={async f => { await createHonInicial(f); setNovo(false); load(); reload(); }} onCancel={() => setNovo(false)} />}
      <div className="space-y-2">
        {list.map(h => editId === h.id
          ? <HonInicialForm key={h.id} initial={h} onSave={async f => { await updateHonInicial(h.id, f); setEditId(null); load(); reload(); }} onCancel={() => setEditId(null)} />
          : (
            <div key={h.id} className="flex items-center gap-3 px-4 py-3 rounded-lg"
              style={{ background:"var(--surface2)", border:"1px solid var(--border)" }}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm" style={{ color:"var(--text)" }}>{h.cliente}</p>
                <p className="text-xs mt-0.5" style={{ color:"var(--text3)" }}>{[h.observacao, h.processo].filter(Boolean).join(" · ")}</p>
              </div>
              <span className="tabular-nums text-sm font-semibold" style={{ color:"var(--gold)" }}>{fmtBRL(h.valor)}</span>
              <StatusBtn status={h.status} onClick={() => toggleStatus(h)} receita={false} />
              <button onClick={() => setEditId(h.id)} className="text-xs px-2 py-1 rounded" style={{ background:"var(--surface)", color:"var(--text2)", border:"1px solid var(--border)" }}>✏️</button>
              <button onClick={() => { if(confirm("Excluir?")) deleteHonInicial(h.id).then(() => { load(); reload(); }); }}
                className="text-xs px-2 py-1 rounded" style={{ background:"var(--surface)", color:"var(--text3)", border:"1px solid var(--border)" }}>🗑</button>
            </div>
          )
        )}
      </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// DESPESAS FIXAS
// ─────────────────────────────────────────────────────────────────────────────
function FixasView() {
  const [fixas, setFixas] = useState<Fixa[]>([]);
  useEffect(() => { getFixas().then(setFixas); }, []);

  const total = fixas.reduce((s, f) => s + f.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold" style={{ color:"var(--text)" }}>Total: <span style={{ color:"var(--gold)" }}>{fmtBRL(total)}</span></span>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th className="pb-2 text-left pr-4" style={{ color:"var(--text3)" }}>Categoria</th>
                <th className="pb-2 text-left pr-4" style={{ color:"var(--text3)" }}>Resp.</th>
                {COLS.map(c => <th key={c} className="pb-2 pr-2 text-right text-xs" style={{ color:"var(--text3)" }}>{COL_TO_MES[c]?.slice(0,3)}</th>)}
                <th className="pb-2 text-right" style={{ color:"var(--gold)" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {fixas.map(f => (
                <tr key={f.categoria} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2 pr-4 font-medium" style={{ color:"var(--text)" }}>{f.categoria}</td>
                  <td className="py-2 pr-4 text-xs" style={{ color:"var(--text2)" }}>{f.quem}</td>
                  {COLS.map(c => (
                    <td key={c} className="py-2 pr-2 text-right tabular-nums"
                      style={{ color: (f.valores[c]||0) > 0 ? "var(--text2)" : "var(--text3)" }}>
                      {(f.valores[c]||0) > 0 ? fmtBRL(f.valores[c]).replace("R$","").trim() : "—"}
                    </td>
                  ))}
                  <td className="py-2 text-right tabular-nums font-semibold" style={{ color:"var(--gold)" }}>
                    {fmtBRL(f.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DESPESAS VARIÁVEIS
// ─────────────────────────────────────────────────────────────────────────────
function VariaveisView() {
  const [variaveis, setVariaveis] = useState<Variavel[]>([]);
  const [novo, setNovo] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => { setVariaveis(await getVariaveis()); }, []);
  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (v: Variavel) => {
    await statusVariavel(v.id, NEXT_STATUS2[v.status] || "pago");
    load();
  };
  const del = async (id: string) => { await deleteVariavel(id); load(); };

  const total = variaveis.reduce((s, v) => s + v.valor, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold" style={{ color:"var(--text)" }}>Total: <span style={{ color:"var(--gold)" }}>{fmtBRL(total)}</span></span>
        <button onClick={() => setNovo(true)} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background:"var(--gold)", color:"#000" }}>+ Nova</button>
      </div>
      {novo && <VariavelForm onSave={async f => { await createVariavel(f); setNovo(false); load(); }} onCancel={() => setNovo(false)} />}
      <div className="space-y-2">
        {variaveis.map(v => editId === v.id
          ? <VariavelForm key={v.id} initial={v} onSave={async f => { await updateVariavel(v.id, f); setEditId(null); load(); }} onCancel={() => setEditId(null)} />
          : (
            <div key={v.id} className="flex items-center gap-3 px-4 py-3 rounded-lg"
              style={{ background:"var(--surface2)", border:"1px solid var(--border)" }}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm" style={{ color:"var(--text)" }}>{v.descricao}</p>
                <p className="text-xs mt-0.5" style={{ color:"var(--text3)" }}>
                  {[v.parcelas, v.quem, v.onde, v.data_compra].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="tabular-nums text-sm font-semibold" style={{ color:"var(--gold)" }}>{fmtBRL(v.valor)}</span>
              <StatusBtn status={v.status} onClick={() => toggleStatus(v)} receita={false} />
              <button onClick={() => setEditId(v.id)} className="text-xs px-2 py-1 rounded" style={{ background:"var(--surface)", color:"var(--text2)", border:"1px solid var(--border)" }}>✏️</button>
              <button onClick={() => { if(confirm("Excluir?")) del(v.id); }} className="text-xs px-2 py-1 rounded" style={{ background:"var(--surface)", color:"var(--text3)", border:"1px solid var(--border)" }}>🗑</button>
            </div>
          )
        )}
      </div>
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
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function FinanceiroPage() {
  const [aba, setAba] = useState(0);
  const [dash, setDash] = useState<DashFinanceiro | null>(null);

  const loadDash = useCallback(async () => { setDash(await getDash()); }, []);
  useEffect(() => { loadDash(); }, [loadDash]);

  const tabStyle = (i: number) => ({
    background: aba === i ? "var(--gold)" : "var(--surface2)",
    color: aba === i ? "#000" : "var(--text2)",
    border: "1px solid var(--border)",
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-semibold" style={{ color:"var(--text)" }}>Financeiro Escritório</h1>
        <p className="text-sm mt-0.5" style={{ color:"var(--text3)" }}>Sócias: Adriely & Eduarda</p>
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
      {aba === 0 && (dash ? <DashView data={dash} /> : <div className="py-8 text-center" style={{ color:"var(--text3)" }}>Carregando...</div>)}
      {aba === 1 && <AcordosView reload={loadDash} />}
      {aba === 2 && <ExecucoesView reload={loadDash} />}
      {aba === 3 && <HonIniciaisView reload={loadDash} />}
      {aba === 4 && <FixasView />}
      {aba === 5 && <VariaveisView />}
    </div>
  );
}
