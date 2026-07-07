"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getTarefas, createTarefa, updateTarefa, deleteTarefa, COLUNAS,
  type Tarefa, type StatusTarefa,
} from "@/lib/tarefas";
import { getProcessos, normalizeData, fmtData, type Processo } from "@/lib/controle";
import { Input as Inp, Select as Sel, FieldLabel as Lbl, Dialog } from "@/components/ui";
import { DateField } from "@/components/ui/DateField";

const COR_COLUNA: Record<StatusTarefa, string> = {
  a_fazer: "var(--text3)",
  fazendo: "#60a5fa",
  concluido: "#4ade80",
};

function TarefaForm({ initial, onSave, onCancel, onDelete, responsaveis, processos }: {
  initial?: Tarefa;
  onSave: (t: Omit<Tarefa, "id" | "criado_em">) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  responsaveis: string[];
  processos: Processo[];
}) {
  const blank = { titulo: "", descricao: "", status: "a_fazer" as StatusTarefa, responsavel: "", prazo: "", processo_id: "", processo_titulo: "" };
  const [form, setForm] = useState({ ...blank, ...(initial || {}), prazo: normalizeData(initial?.prazo || "") });
  const [saving, setSaving] = useState(false);
  const [erroTitulo, setErroTitulo] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (k === "titulo") setErroTitulo(false);
  };
  const submit = async () => {
    if (!form.titulo.trim()) { setErroTitulo(true); return; }
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };
  return (
    <div className="space-y-4">
      <h2 className="font-serif text-lg font-semibold" style={{ color: "var(--text)" }}>
        {initial ? "Editar tarefa" : "Nova tarefa"}
      </h2>
      <div>
        <Lbl>Título *</Lbl>
        <Inp value={form.titulo} onChange={e => set("titulo", e.target.value)}
          style={erroTitulo ? { background: "rgba(239,68,68,0.08)", border: "1px solid #ef4444", color: "var(--text)" } : undefined} />
        {erroTitulo && <p className="text-xs mt-1" style={{ color: "#f87171" }}>Campo obrigatório</p>}
      </div>
      <div>
        <Lbl>Descrição</Lbl>
        <textarea rows={2} value={form.descricao} onChange={e => set("descricao", e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm resize-none"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Lbl>Status</Lbl>
          <Sel value={form.status} onChange={e => set("status", e.target.value as StatusTarefa)}>
            {COLUNAS.map(c => <option key={c.status} value={c.status}>{c.label}</option>)}
          </Sel>
        </div>
        <div>
          <Lbl>Responsável</Lbl>
          <Sel value={form.responsavel} onChange={e => set("responsavel", e.target.value)}>
            <option value="">—</option>
            {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
          </Sel>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DateField label="Prazo" value={form.prazo} onChange={v => set("prazo", v)} />
        <div>
          <Lbl>Processo vinculado</Lbl>
          <Sel value={form.processo_id} onChange={e => {
            const p = processos.find(p => p.id === e.target.value);
            set("processo_id", e.target.value);
            set("processo_titulo", p ? `${p.autor}${p.reu ? " x " + p.reu : ""}` : "");
          }}>
            <option value="">— nenhum —</option>
            {processos.map(p => (
              <option key={p.id} value={p.id}>{p.autor}{p.numero_processo ? ` — ${p.numero_processo}` : ""}</option>
            ))}
          </Sel>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={submit} disabled={saving}
          className="px-5 py-2 rounded-lg font-semibold text-sm"
          style={{ background: "var(--gold)", color: "#000" }}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm"
          style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>
          Cancelar
        </button>
        {onDelete && (
          <button onClick={onDelete} className="px-4 py-2 rounded-lg text-sm ml-auto"
            style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
            Excluir
          </button>
        )}
      </div>
    </div>
  );
}

function TarefaCard({ t, onEdit, onMove }: {
  t: Tarefa;
  onEdit: (t: Tarefa) => void;
  onMove: (t: Tarefa, status: StatusTarefa) => void;
}) {
  const idx = COLUNAS.findIndex(c => c.status === t.status);
  const dPrazo = normalizeData(t.prazo || "");
  const hoje = new Date().toISOString().split("T")[0];
  const diasAte = dPrazo ? Math.floor((new Date(dPrazo).getTime() - new Date(hoje).getTime()) / 86400000) : null;
  const corPrazo = diasAte !== null ? (diasAte <= 0 ? "#ef4444" : diasAte <= 3 ? "#f97316" : "var(--text3)") : undefined;

  return (
    <div onClick={() => onEdit(t)}
      className="rounded-lg p-3 cursor-pointer transition-colors hover:border-[var(--gold)]/40"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${COR_COLUNA[t.status]}` }}>
      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{t.titulo}</p>
      {t.processo_titulo && (
        <p className="text-xs mt-1 truncate" style={{ color: "var(--text3)" }}>📁 {t.processo_titulo}</p>
      )}
      {t.responsavel && <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>{t.responsavel}</p>}
      {dPrazo && (
        <p className="text-xs mt-1 font-semibold" style={{ color: corPrazo }}>
          📅 {fmtData(t.prazo || "")}
          {diasAte !== null && (diasAte < 0 ? ` (atrasada ${Math.abs(diasAte)}d)` : diasAte === 0 ? " (hoje!)" : ` (${diasAte}d)`)}
        </p>
      )}
      <div className="flex gap-1 mt-2" onClick={e => e.stopPropagation()}>
        {idx > 0 && (
          <button onClick={() => onMove(t, COLUNAS[idx - 1].status)}
            title={`Mover para ${COLUNAS[idx - 1].label}`}
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>◀</button>
        )}
        {idx < COLUNAS.length - 1 && (
          <button onClick={() => onMove(t, COLUNAS[idx + 1].status)}
            title={`Mover para ${COLUNAS[idx + 1].label}`}
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>▶</button>
        )}
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [editando, setEditando] = useState<Tarefa | "novo" | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getTarefas().then(setTarefas).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/users").then(r => r.ok ? r.json() : [])
      .then((list: { name: string }[]) => setUsers(list.map(u => u.name)));
    getProcessos({ tipo: "ativos" }).then(setProcessos).catch(() => {});
  }, []);

  const handleSave = async (data: Omit<Tarefa, "id" | "criado_em">) => {
    if (editando && editando !== "novo") await updateTarefa(editando.id, data);
    else await createTarefa(data);
    setEditando(null);
    load();
  };

  const handleDelete = async () => {
    if (!editando || editando === "novo") return;
    await deleteTarefa(editando.id);
    setEditando(null);
    load();
  };

  const handleMove = async (t: Tarefa, status: StatusTarefa) => {
    setTarefas(prev => prev.map(x => x.id === t.id ? { ...x, status } : x));
    await updateTarefa(t.id, { status });
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>Kanban de Tarefas</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>Organize o dia a dia do escritório em quadro visual</p>
        </div>
        <button onClick={() => setEditando("novo")}
          className="px-4 py-2 rounded-lg font-semibold text-sm"
          style={{ background: "var(--gold)", color: "#000" }}>
          + Nova tarefa
        </button>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--text3)" }}>Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {COLUNAS.map(col => {
            const itens = tarefas.filter(t => t.status === col.status);
            return (
              <div key={col.status} className="rounded-xl p-4" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full" style={{ background: COR_COLUNA[col.status] }} />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{col.label}</h3>
                  <span className="text-xs" style={{ color: "var(--text3)" }}>({itens.length})</span>
                </div>
                <div className="space-y-3">
                  {itens.length === 0 && (
                    <p className="text-xs py-6 text-center" style={{ color: "var(--text3)" }}>Nenhuma tarefa</p>
                  )}
                  {itens.map(t => <TarefaCard key={t.id} t={t} onEdit={setEditando} onMove={handleMove} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editando && (
        <Dialog onClose={() => setEditando(null)}>
          <TarefaForm
            initial={editando === "novo" ? undefined : editando}
            onSave={handleSave}
            onCancel={() => setEditando(null)}
            onDelete={editando !== "novo" ? handleDelete : undefined}
            responsaveis={users}
            processos={processos}
          />
        </Dialog>
      )}
    </div>
  );
}
