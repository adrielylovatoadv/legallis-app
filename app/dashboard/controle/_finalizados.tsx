"use client";

import { useEffect, useState, useCallback } from "react";
import { normText } from "@/lib/controle";
import { ConfirmModal } from "@/components/ConfirmModal";
import { DateField } from "@/components/ui/DateField";
import { FinanceiroPanel } from "./_financeiro-panel";

interface Finalizado {
  id?: string;
  cliente: string;
  reu: string;
  processo: string;
  objeto: string;
  data_fin: string;
  motivo: string;
  _migrado?: boolean;
}

const MOTIVOS = ["Acordo", "Desistência", "Improcedência", "Arquivado", "Outro"] as const;
type Motivo = typeof MOTIVOS[number];

const MOTIVO_COLORS: Record<Motivo, { bg: string; color: string }> = {
  "Acordo":        { bg: "rgba(201,168,76,0.12)",  color: "var(--gold)" },
  "Desistência":   { bg: "rgba(107,114,128,0.12)", color: "#9ca3af" },
  "Improcedência": { bg: "rgba(239,68,68,0.10)",   color: "#f87171" },
  "Arquivado":     { bg: "rgba(96,165,250,0.10)",  color: "#60a5fa" },
  "Outro":         { bg: "rgba(168,85,247,0.10)",  color: "#c084fc" },
};

function canonMotivo(m: string): Motivo {
  const u = (m || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (u === "ACORDO")        return "Acordo";
  if (u.startsWith("DESIST")) return "Desistência";
  if (u.startsWith("IMPROC")) return "Improcedência";
  if (u === "ARQUIVADO")     return "Arquivado";
  return "Outro";
}

function fmtDate(s: string) {
  if (!s || s.length < 10) return "—";
  if (s.includes("/")) return s; // já em DD/MM/AAAA
  const [y, m, d] = s.split("-");
  if (!d || !m) return s;
  return `${d}/${m}/${y}`;
}

function ModalForm({ initial, onSave, onClose }: {
  initial?: Finalizado;
  onSave: (entry: Finalizado) => Promise<void>;
  onClose: () => void;
}) {
  const blank: Finalizado = { cliente: "", reu: "", processo: "", objeto: "", data_fin: "", motivo: "Acordo" };
  const [form, setForm] = useState<Finalizado>(initial ? { ...initial } : { ...blank });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Finalizado, v: string) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.cliente.trim()) return;
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold" style={{ color: "var(--text)" }}>
            {initial ? "Editar finalizado" : "Registrar finalizado"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text3)" }}>✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Tipo de finalização *</label>
            <div className="flex gap-2 flex-wrap">
              {MOTIVOS.map(m => {
                const c = MOTIVO_COLORS[m];
                const sel = form.motivo === m;
                return (
                  <button key={m} type="button" onClick={() => set("motivo", m)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: sel ? c.bg : "var(--surface2)",
                      color: sel ? c.color : "var(--text3)",
                      border: `1px solid ${sel ? c.color : "var(--border)"}`,
                    }}>
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {(["cliente", "reu", "objeto", "processo"] as const).map(k => (
            <div key={k}>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>
                {k === "cliente" ? "Cliente *" : k === "reu" ? "Réu" : k === "objeto" ? "Objeto" : "Nº Processo"}
              </label>
              <input value={form[k]} onChange={e => set(k, e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
          ))}

          <DateField label="Data de finalização" value={form.data_fin} onChange={v => set("data_fin", v)} />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={submit} disabled={saving || !form.cliente.trim()}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
            style={{ background: "var(--gold)", color: "#000" }}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm"
            style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export function FinalizadosTab() {
  const [finalizados, setFinalizados] = useState<Finalizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroMotivo, setFiltroMotivo] = useState<string>("");
  const [modal, setModal] = useState<{ entry?: Finalizado } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [financeiroAbertoKey, setFinanceiroAbertoKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/controle/finalizados");
      if (res.ok) {
        const d = await res.json();
        setFinalizados(d.finalizados || []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (entry: Finalizado) => {
    if (entry.id) {
      await fetch("/api/controle/finalizados", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, entry }),
      });
    } else {
      await fetch("/api/controle/finalizados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
    }
    setModal(null);
    load();
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/controle/finalizados", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setConfirmId(null);
    load();
  };

  const handleReabrir = async (id: string) => {
    await fetch("/api/controle/finalizados/reabrir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

  const filtered = finalizados.filter(f => {
    const b = normText(busca);
    const matchBusca = !busca ||
      normText(f.cliente).includes(b) ||
      normText(f.reu).includes(b) ||
      normText(f.objeto).includes(b) ||
      normText(f.processo).includes(b);
    const matchMotivo = !filtroMotivo || canonMotivo(f.motivo) === filtroMotivo;
    return matchBusca && matchMotivo;
  });

  const counts = MOTIVOS.reduce((acc, m) => {
    acc[m] = finalizados.filter(f => canonMotivo(f.motivo) === m).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-5">
      {modal !== null && (
        <ModalForm
          initial={modal.entry}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {confirmId !== null && (
        <ConfirmModal
          title="Excluir finalizado"
          message="Tem certeza que deseja excluir este registro?"
          confirmLabel="Excluir"
          onConfirm={() => handleDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {MOTIVOS.map(m => {
          const c = MOTIVO_COLORS[m];
          return (
            <div key={m} className="rounded-xl p-4 flex flex-col gap-1 cursor-pointer transition-all"
              style={{
                background: "var(--surface)",
                borderLeft: `4px solid ${c.color}`,
                border: `1px solid ${filtroMotivo === m ? c.color : "var(--border)"}`,
                opacity: filtroMotivo && filtroMotivo !== m ? 0.6 : 1,
              }}
              onClick={() => setFiltroMotivo(prev => prev === m ? "" : m)}>
              <span className="text-2xl font-bold tabular-nums" style={{ color: c.color }}>{counts[m]}</span>
              <span className="text-xs" style={{ color: "var(--text3)" }}>{m}</span>
            </div>
          );
        })}
      </div>

      {/* Busca + botão */}
      <div className="flex gap-2">
        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="🔍 Buscar por cliente, réu, objeto ou processo..."
          className="flex-1 px-3 py-2 rounded-lg text-sm"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
        <button onClick={() => setModal({})}
          className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
          style={{ background: "var(--gold)", color: "#000" }}>
          + Registrar
        </button>
      </div>

      {filtroMotivo && (
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--text3)" }}>Filtro ativo:</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: MOTIVO_COLORS[filtroMotivo as Motivo]?.bg, color: MOTIVO_COLORS[filtroMotivo as Motivo]?.color, border: `1px solid ${MOTIVO_COLORS[filtroMotivo as Motivo]?.color}` }}>
            {filtroMotivo}
          </span>
          <button onClick={() => setFiltroMotivo("")} className="text-xs" style={{ color: "var(--text3)" }}>✕ Limpar</button>
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "var(--gold)", borderTopColor: "transparent" }} />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm" style={{ color: "var(--text3)" }}>
          {busca || filtroMotivo ? "Nenhum resultado encontrado." : "Nenhum processo finalizado registrado."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((f, idx) => {
            const rowKey = f.id ?? `migrado-${idx}`;
            const c = MOTIVO_COLORS[f.motivo as Motivo] || { bg: "rgba(107,114,128,0.1)", color: "#9ca3af" };
            return (
              <div key={rowKey} className="rounded-lg px-4 py-3"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-medium text-sm" style={{ color: "var(--text)" }}>{f.cliente}</p>
                      {f.reu && <span className="text-xs" style={{ color: "var(--text3)" }}>× {f.reu}</span>}
                    </div>
                    {f.objeto && (
                      <p className="text-xs" style={{ color: "var(--text3)" }}>{f.objeto}</p>
                    )}
                    {f.processo && (
                      <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text3)" }}>{f.processo}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {f.data_fin && (
                      <span className="text-xs" style={{ color: "var(--text3)" }}>{fmtDate(f.data_fin)}</span>
                    )}
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                      style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}` }}>
                      {f.motivo}
                    </span>
                    {f.processo && (
                      <button onClick={() => setFinanceiroAbertoKey(v => v === rowKey ? null : rowKey)} title="Financeiro do processo"
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: financeiroAbertoKey === rowKey ? "rgba(201,168,76,0.15)" : "var(--surface2)", color: financeiroAbertoKey === rowKey ? "var(--gold)" : "var(--text3)", border: "1px solid var(--border)" }}>
                        💰
                      </button>
                    )}
                    {f._migrado && (
                      <span className="text-xs px-2 py-0.5 rounded" title="Registro do Financeiro — edite lá"
                        style={{ background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border)" }}>
                        Financeiro
                      </span>
                    )}
                    <button onClick={() => handleReabrir(f.id!)} title="Voltar para andamento"
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid var(--border)" }}>
                      ↩️ Reabrir
                    </button>
                    {!f._migrado && (
                      <>
                        <button onClick={() => setModal({ entry: f })}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>
                          ✏️
                        </button>
                        <button onClick={() => setConfirmId(f.id!)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border)" }}>
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {financeiroAbertoKey === rowKey && f.processo && (
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                    <FinanceiroPanel alvo={{ numeroProcesso: f.processo, cliente: f.cliente, reu: f.reu, objeto: f.objeto }} />
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-center pt-2" style={{ color: "var(--text3)" }}>
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}{filtroMotivo || busca ? " encontrado" + (filtered.length !== 1 ? "s" : "") : ""}
          </p>
        </div>
      )}
    </div>
  );
}
