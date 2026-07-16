"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  getTarefas, createTarefa, updateTarefa, deleteTarefa, COLUNAS,
  type Tarefa, type StatusTarefa,
} from "@/lib/tarefas";
import { getProcessos, normalizeData, fmtData, normText, type Processo } from "@/lib/controle";
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
          <ProcessoPicker
            processos={processos}
            processoId={form.processo_id}
            processoTitulo={form.processo_titulo}
            onSelect={(id, titulo) => { set("processo_id", id); set("processo_titulo", titulo); }}
          />
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

function ProcessoPicker({ processos, processoId, processoTitulo, onSelect }: {
  processos: Processo[];
  processoId: string;
  processoTitulo: string;
  onSelect: (id: string, titulo: string) => void;
}) {
  const displayFor = (p: Processo) => `${p.autor}${p.numero_processo ? ` — ${p.numero_processo}` : ""}`;
  const selected = processoId ? processos.find(p => p.id === processoId) : undefined;
  const [query, setQuery] = useState(selected ? displayFor(selected) : (processoTitulo || ""));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = normText(query.trim());
    if (!q) return processos.slice(0, 8);
    return processos.filter(p =>
      normText(p.autor || "").includes(q) || normText(p.numero_processo || "").includes(q)
    ).slice(0, 8);
  }, [query, processos]);

  return (
    <div className="relative" ref={ref}>
      <Inp
        value={query}
        placeholder="Buscar por autor ou nº do processo..."
        onFocus={() => setOpen(true)}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
          if (processoId) onSelect("", "");
        }}
      />
      {processoId && (
        <button type="button" title="Remover vínculo"
          onClick={() => { onSelect("", ""); setQuery(""); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
          style={{ color: "var(--text3)" }}>✕</button>
      )}
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-lg max-h-56 overflow-y-auto shadow-lg"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs" style={{ color: "var(--text3)" }}>Nenhum processo encontrado</p>
          ) : filtered.map(p => (
            <button key={p.id} type="button"
              onClick={() => {
                onSelect(p.id, `${p.autor}${p.reu ? " x " + p.reu : ""}`);
                setQuery(displayFor(p));
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm transition-colors"
              style={{ color: "var(--text)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div>{p.autor}{p.reu ? ` x ${p.reu}` : ""}</div>
              {p.numero_processo && <div className="text-xs" style={{ color: "var(--text3)" }}>{p.numero_processo}</div>}
            </button>
          ))}
        </div>
      )}
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
  // Tarefa já em andamento ou concluída: não faz sentido continuar marcando como atrasada.
  const emAndamentoOuConcluido = t.status === "fazendo" || t.status === "concluido";
  const atrasada = diasAte !== null && diasAte < 0 && !emAndamentoOuConcluido;
  const corPrazo = diasAte !== null
    ? (atrasada || diasAte === 0 ? "#ef4444" : diasAte > 0 && diasAte <= 3 ? "#f97316" : "var(--text3)")
    : undefined;

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
          {diasAte !== null && (
            diasAte < 0
              ? (atrasada ? ` (atrasada ${Math.abs(diasAte)}d)` : "")
              : diasAte === 0 ? " (hoje!)" : ` (${diasAte}d)`
          )}
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

type FiltroPrazo = "todos" | "atrasadas" | "7dias" | "30dias" | "sem_prazo";

const OPCOES_PRAZO: { value: FiltroPrazo; label: string }[] = [
  { value: "todos", label: "Todos os prazos" },
  { value: "atrasadas", label: "Atrasadas" },
  { value: "7dias", label: "Até 7 dias" },
  { value: "30dias", label: "Até 30 dias" },
  { value: "sem_prazo", label: "Sem prazo" },
];

function FiltrosBar({ responsavel, setResponsavel, prazo, setPrazo, vinculo, setVinculo, responsaveis, onLimpar, ativo }: {
  responsavel: string; setResponsavel: (v: string) => void;
  prazo: FiltroPrazo; setPrazo: (v: FiltroPrazo) => void;
  vinculo: string; setVinculo: (v: string) => void;
  responsaveis: string[];
  onLimpar: () => void;
  ativo: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-5 p-3 rounded-lg" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
      <div className="w-44">
        <Lbl>Responsável</Lbl>
        <Sel value={responsavel} onChange={e => setResponsavel(e.target.value)}>
          <option value="">Todos</option>
          {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
        </Sel>
      </div>
      <div className="w-44">
        <Lbl>Prazo</Lbl>
        <Sel value={prazo} onChange={e => setPrazo(e.target.value as FiltroPrazo)}>
          {OPCOES_PRAZO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Sel>
      </div>
      <div className="w-44">
        <Lbl>Processo vinculado</Lbl>
        <Sel value={vinculo} onChange={e => setVinculo(e.target.value)}>
          <option value="">Todos</option>
          <option value="com">Com vínculo</option>
          <option value="sem">Sem vínculo</option>
        </Sel>
      </div>
      {ativo && (
        <button onClick={onLimpar} className="text-xs px-3 py-2 rounded-lg"
          style={{ background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border)" }}>
          Limpar filtros
        </button>
      )}
    </div>
  );
}

export default function KanbanPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [editando, setEditando] = useState<Tarefa | "novo" | null>(null);
  const [loading, setLoading] = useState(true);
  const [fResponsavel, setFResponsavel] = useState("");
  const [fPrazo, setFPrazo] = useState<FiltroPrazo>("todos");
  const [fVinculo, setFVinculo] = useState("");

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

  const filtrosAtivos = !!fResponsavel || fPrazo !== "todos" || !!fVinculo;
  const limparFiltros = () => { setFResponsavel(""); setFPrazo("todos"); setFVinculo(""); };

  const tarefasFiltradas = useMemo(() => {
    const hoje = new Date().toISOString().split("T")[0];
    return tarefas.filter(t => {
      if (fResponsavel && t.responsavel !== fResponsavel) return false;
      if (fVinculo === "com" && !t.processo_id) return false;
      if (fVinculo === "sem" && t.processo_id) return false;
      if (fPrazo !== "todos") {
        const dPrazo = normalizeData(t.prazo || "");
        if (fPrazo === "sem_prazo") { if (dPrazo) return false; }
        else {
          if (!dPrazo) return false;
          const diasAte = Math.floor((new Date(dPrazo).getTime() - new Date(hoje).getTime()) / 86400000);
          if (fPrazo === "atrasadas" && diasAte >= 0) return false;
          if (fPrazo === "7dias" && (diasAte < 0 || diasAte > 7)) return false;
          if (fPrazo === "30dias" && (diasAte < 0 || diasAte > 30)) return false;
        }
      }
      return true;
    });
  }, [tarefas, fResponsavel, fPrazo, fVinculo]);

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

      {!loading && (
        <FiltrosBar
          responsavel={fResponsavel} setResponsavel={setFResponsavel}
          prazo={fPrazo} setPrazo={setFPrazo}
          vinculo={fVinculo} setVinculo={setFVinculo}
          responsaveis={users}
          onLimpar={limparFiltros}
          ativo={filtrosAtivos}
        />
      )}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--text3)" }}>Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {COLUNAS.map(col => {
            const itens = tarefasFiltradas.filter(t => t.status === col.status);
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
