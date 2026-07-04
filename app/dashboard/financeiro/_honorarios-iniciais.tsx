"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, Input as Inp, Select as Sel } from "@/components/ui";
import {
  getHonIniciais, createHonInicial, updateHonInicial, deleteHonInicial, statusHonInicial,
  fmtBRL, MESES, NEXT_STATUS2,
  type HonorarioInicial, type Status,
} from "@/lib/financeiro";
import { MetricCard, StatusBtn, getCurrentMes } from "./_shared";

export function HonIniciaisView({ reload }: { reload: () => void }) {
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
  const blank = { mes: getCurrentMes(), cliente:"", processo:"", valor:0, data_pagamento:"", observacao:"", status:"pago" as Status };
  const [form, setForm] = useState({ ...blank, ...(initial||{}) });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | number) => setForm(p => ({ ...p, [k]: v }));
  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Mês de recebimento</span>
          <Sel value={form.mes || MESES[0]} onChange={e => set("mes",e.target.value)}>
            {MESES.map(m => <option key={m} value={m}>{m}</option>)}
          </Sel>
        </div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Cliente *</span><Inp value={form.cliente} onChange={e => set("cliente",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Processo</span><Inp value={form.processo} onChange={e => set("processo",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Valor (R$)</span>
          <Inp type="number" step="0.01" min="0" value={form.valor||""} onChange={e => set("valor", parseFloat(e.target.value)||0)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Data pagamento</span>
          <Inp type="date" value={form.data_pagamento} onChange={e => set("data_pagamento",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Observação</span><Inp value={form.observacao} onChange={e => set("observacao",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Status</span>
          <Sel value={form.status} onChange={e => set("status",e.target.value as Status)}>
            <option value="pago">Pago / Recebido</option><option value="pendente">Pendente</option>
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
