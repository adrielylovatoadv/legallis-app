"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, Input as Inp, Select as Sel } from "@/components/ui";
import {
  getVariaveis, createVariavel, updateVariavel, deleteVariavel, statusVariavel,
  fmtBRL, COLS, COL_TO_MES, NEXT_STATUS2,
  type Variavel, type Status,
} from "@/lib/financeiro";
import { StatusBtn, getCurrentCol, getColIndex, getBillingColIndex } from "./_shared";

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

// Converte "DD/MM/AAAA" para o índice em COLS (mesma base de getColIndex)
// Fatura fecha no dia 11: compra a partir desse dia entra na fatura do mês seguinte
function colIndexFromData(dataStr: string): number | null {
  if (!dataStr) return null;
  const p = dataStr.split("/");
  if (p.length !== 3) return null;
  const dia = parseInt(p[0]);
  let mes = parseInt(p[1]) - 1;
  let ano = parseInt(p[2]);
  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null;
  if (dia >= 11) { mes += 1; if (mes > 11) { mes = 0; ano += 1; } }
  return ano * 12 + mes - (2025 * 12 + 9);
}

// Distribui o valor total em parcelas mensais a partir do mês da compra (ou do mês atual)
function distribuirMesesVariavel(valor: number, parcelasStr: string, dataCompra: string): Record<string, number> {
  const n = parseInt(parcelasStr) || 1;
  const parcela = n > 0 ? Math.round((valor / n) * 100) / 100 : valor;
  let startIdx = colIndexFromData(dataCompra);
  if (startIdx === null || startIdx < 0 || startIdx >= COLS.length) startIdx = getBillingColIndex();
  startIdx = Math.max(0, Math.min(COLS.length - 1, startIdx));
  const meses: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const idx = startIdx + i;
    if (idx >= 0 && idx < COLS.length) meses[COLS[idx]] = parcela;
  }
  return meses;
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
export function VariaveisView() {
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
  const venceEsteMes = ativas.filter(v => (v.meses[mesAtual] || 0) > 0);
  const venceProxMes = nextCol ? ativas.filter(v => (v.meses[nextCol] || 0) > 0) : [];
  const totalVenceEsteMes = venceEsteMes.reduce((s, v) => s + (v.meses[mesAtual] || 0), 0);
  const totalVenceProxMes = nextCol ? venceProxMes.reduce((s, v) => s + (v.meses[nextCol] || 0), 0) : 0;

  const renderCard = (v: Variavel) => {
    if (editId === v.id) {
      return <VariavelForm key={v.id} initial={v} onSave={async f => { await updateVariavel(v.id, f); setEditId(null); load(); }} onCancel={() => setEditId(null)} />;
    }
    const parcelaMes = varParcelaMes(v);
    const valorMesAtual = v.meses[mesAtual] || 0;
    const prog = varProgress(v, mesAtual);
    return (
      <div key={v.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: "var(--surface)" }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm" style={{ color:"var(--text)" }}>{v.descricao}</p>
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

      {/* Resumo de pendências: este mês e próximo mês */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl p-4" style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color:"var(--text3)" }}>
              📅 Vencendo este mês {mesAtual ? `(${COL_TO_MES[mesAtual] || mesAtual})` : ""}
            </span>
            <span className="font-semibold tabular-nums text-sm" style={{ color:"#22c55e" }}>{fmtBRL(totalVenceEsteMes)}</span>
          </div>
          {venceEsteMes.length === 0 ? (
            <p className="text-xs" style={{ color:"var(--text3)" }}>Nenhuma pendência este mês.</p>
          ) : (
            <div className="space-y-1.5">
              {venceEsteMes.map(v => (
                <div key={v.id} className="flex items-center justify-between text-xs">
                  <span style={{ color:"var(--text2)" }}>{v.descricao}</span>
                  <span className="tabular-nums font-medium" style={{ color:"var(--gold)" }}>{fmtBRL(v.meses[mesAtual] || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl p-4" style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color:"var(--text3)" }}>
              ⏭️ Próximo mês {nextCol ? `(${COL_TO_MES[nextCol] || nextCol})` : ""}
            </span>
            <span className="font-semibold tabular-nums text-sm" style={{ color:"#f59e0b" }}>{fmtBRL(totalVenceProxMes)}</span>
          </div>
          {venceProxMes.length === 0 ? (
            <p className="text-xs" style={{ color:"var(--text3)" }}>Nenhuma pendência no próximo mês.</p>
          ) : (
            <div className="space-y-1.5">
              {venceProxMes.map(v => (
                <div key={v.id} className="flex items-center justify-between text-xs">
                  <span style={{ color:"var(--text2)" }}>{v.descricao}</span>
                  <span className="tabular-nums font-medium" style={{ color:"var(--gold)" }}>{fmtBRL((nextCol && v.meses[nextCol]) || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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

  const n = parseInt(form.parcelas) || 1;
  const startIdx = (() => {
    const i = colIndexFromData(form.data_compra);
    return (i !== null && i >= 0) ? i : getBillingColIndex();
  })();
  const parcelasForaDoPeriodo = Math.max(0, startIdx + n - COLS.length);

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Descrição *</span><Inp value={form.descricao} onChange={e => set("descricao",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Valor Total (R$)</span>
          <Inp type="number" step="0.01" min="0" value={form.valor||""} onChange={e => set("valor",parseFloat(e.target.value)||0)} /></div>
        <div>
          <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Parcelas</span>
          <Inp value={form.parcelas} onChange={e => set("parcelas",e.target.value)} placeholder="ex: 3x" />
          {parcelasForaDoPeriodo > 0 && (
            <p className="text-xs mt-1" style={{ color:"#f97316" }}>
              ⚠ {parcelasForaDoPeriodo} parcela{parcelasForaDoPeriodo > 1?"s":""} ultrapassam Dez/2027 e não serão registradas.
            </p>
          )}
        </div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Responsável</span>
          <Inp value={form.quem} onChange={e => set("quem",e.target.value)} placeholder="ex: dividido, sócio 1" /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Onde</span><Inp value={form.onde} onChange={e => set("onde",e.target.value)} /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Data compra</span><Inp value={form.data_compra} onChange={e => set("data_compra",e.target.value)} placeholder="DD/MM/AAAA" /></div>
        <div><span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>Status</span>
          <Sel value={form.status} onChange={e => set("status",e.target.value as Status)}>
            <option value="pendente">Pendente</option><option value="pago">Pago</option>
          </Sel></div>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={async () => {
          setSaving(true);
          try {
            const meses = distribuirMesesVariavel(form.valor, form.parcelas, form.data_compra);
            await onSave({ ...form, meses });
          } finally { setSaving(false); }
        }}
          disabled={saving} className="px-5 py-2 rounded-lg font-semibold text-sm" style={{ background:"var(--gold)", color:"#000" }}>{saving?"Salvando...":"Salvar"}</button>
        <button onClick={onCancel} className="px-5 py-2 rounded-lg text-sm" style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>Cancelar</button>
      </div>
    </Card>
  );
}
