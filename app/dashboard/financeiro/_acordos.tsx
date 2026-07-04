"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, Input as Inp, Select as Sel } from "@/components/ui";
import {
  getAcordos, createAcordo, updateAcordo, deleteAcordo, statusAcordo,
  fmtBRL, MESES, NEXT_STATUS,
  type Acordo, type Status,
} from "@/lib/financeiro";
import { MetricCard, StatusBtn, sortByMesDesc, getCurrentMes } from "./_shared";

export function AcordosView({ reload, filtroMes }: { reload: () => void; filtroMes?: string }) {
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
  const blank = { mes: getCurrentMes(), data_pagamento:"", cliente:"", reu:"", objeto:"", processo:"", valor_acordo:0, status:"pendente" as Status };
  const [form, setForm] = useState({ ...blank, ...(initial || {}) });
  const [saving, setSaving] = useState(false);
  const [erroValor, setErroValor] = useState(false);
  const set = (k: string, v: string | number) => {
    setForm(p => ({ ...p, [k]: v }));
    if (k === "valor_acordo") setErroValor(false);
  };

  const submit = async () => {
    if (!(form.valor_acordo > 0)) { setErroValor(true); return; }
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <Card>
      <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.2)", color:"var(--text2)" }}>
        📐 Honorários = 10% do valor + 35% do restante <span style={{ color:"var(--gold)", fontWeight:600 }}>= 41,5% do acordo</span>
        {form.valor_acordo > 0 && (
          <span className="ml-3 font-semibold" style={{ color:"#22c55e" }}>
            → {fmtBRL(form.valor_acordo * 0.415)}
          </span>
        )}
      </div>
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
            onChange={e => set("valor_acordo", parseFloat(e.target.value) || 0)}
            style={erroValor ? { background:"rgba(239,68,68,0.08)", border:"1px solid #ef4444", color:"var(--text)" } : undefined} />
          {erroValor && <p className="text-xs mt-1" style={{ color:"#f87171" }}>Informe o valor do acordo (não pode ser R$ 0,00)</p>}
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
        <span className="text-xs self-center" style={{ color:"var(--text3)" }}>Ctrl+Enter para salvar</span>
      </div>
    </Card>
  );
}
