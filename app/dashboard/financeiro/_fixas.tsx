"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getAcordos, getExecucoes, getFixas, createFixa, updateFixa, deleteFixa, statusFixaMes,
  fmtBRL, MESES, COLS, COL_TO_MES,
  type Acordo, type Execucao, type Fixa,
} from "@/lib/financeiro";
import { getCurrentMes, getNextMes, getCurrentCol } from "./_shared";

// ── alertas de pendências ─────────────────────────────────────────────────────
export function AlertasPendentes() {
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

export function FixasView() {
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
