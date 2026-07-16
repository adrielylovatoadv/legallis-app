"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getAtendimentos, createAtendimento, updateAtendimento, deleteAtendimento,
  concluirAtendimento, criarProcessoDeAtendimento, getClientes,
  FORMAS_ATENDIMENTO, STATUS_ATENDIMENTO, badgeStatusAtendimento, normalizeData, normText, fmtData, gcalUrlAtendimento,
  type Atendimento, type Cliente,
} from "@/lib/controle";
import { ConfirmModal } from "@/components/ConfirmModal";
import { DateField } from "@/components/ui/DateField";
import { Dialog } from "@/components/ui/Dialog";
import { Input, FieldLabel as Label, Select as SelectField } from "@/components/ui";

// ── datas (sem biblioteca externa) ─────────────────────────────────────────────
function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDaysIso(iso: string, n: number): string {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + n);
  return dateToIso(d);
}
function startOfWeekIso(iso: string): string {
  const d = isoToDate(iso);
  const dow = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - dow);
  return dateToIso(d);
}
function todayIso(): string { return dateToIso(new Date()); }
function monthGrid(iso: string): string[][] {
  const d = isoToDate(iso);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const cur = new Date(first);
  cur.setDate(cur.getDate() - offset);
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) { week.push(dateToIso(cur)); cur.setDate(cur.getDate() + 1); }
    weeks.push(week);
  }
  return weeks;
}
const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// ── formulário ──────────────────────────────────────────────────────────────────
function AtendimentoForm({ initial, onSave, onCancel, responsaveis = [] }: {
  initial?: Partial<Atendimento>; onSave: (a: Omit<Atendimento, "id" | "criado_em">) => Promise<void>; onCancel: () => void; responsaveis?: string[];
}) {
  const blank = { data: "", hora: "", cliente: "", telefone: "", forma: "Presencial", observacoes: "", status: "Agendado", responsavel: "" };
  const [form, setForm] = useState({ ...blank, ...(initial || {}), data: normalizeData(initial?.data || "") });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.cliente.trim()) return;
    setSaving(true);
    try { await onSave(form as Omit<Atendimento, "id" | "criado_em">); } finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Cliente / Potencial cliente *</Label><Input value={form.cliente} onChange={e => set("cliente", e.target.value)} /></div>
        <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => set("telefone", e.target.value)} /></div>
        <DateField label="Data" value={form.data} onChange={v => set("data", v)} />
        <DateField label="Hora" type="time" value={form.hora} onChange={v => set("hora", v)} />
        <div>
          <Label>Forma de atendimento</Label>
          <SelectField value={form.forma} onChange={e => set("forma", e.target.value)}>
            {FORMAS_ATENDIMENTO.map(f => <option key={f} value={f}>{f}</option>)}
          </SelectField>
        </div>
        <div>
          <Label>Status</Label>
          <SelectField value={form.status} onChange={e => set("status", e.target.value)}>
            {STATUS_ATENDIMENTO.map(s => <option key={s} value={s}>{s}</option>)}
          </SelectField>
        </div>
        <div>
          <Label>Responsável</Label>
          <SelectField value={form.responsavel} onChange={e => set("responsavel", e.target.value)}>
            <option value="">—</option>
            {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
          </SelectField>
        </div>
      </div>
      <div>
        <Label>Resumo / Observações</Label>
        <textarea rows={3} value={form.observacoes} onChange={e => set("observacoes", e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm resize-none"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
      </div>
      <div className="flex gap-3">
        <button onClick={submit} disabled={saving}
          className="px-5 py-2 rounded-lg font-semibold text-sm"
          style={{ background: "var(--gold)", color: "#000" }}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button onClick={onCancel} className="px-5 py-2 rounded-lg text-sm"
          style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── modal de conclusão ──────────────────────────────────────────────────────────
function ConcluirModal({ atendimento, clientes, onClose, onDone }: {
  atendimento: Atendimento; clientes: Cliente[]; onClose: () => void; onDone: () => void;
}) {
  const [modo, setModo] = useState<"nenhum" | "novo" | "existente">("novo");
  const [nome, setNome] = useState(atendimento.cliente);
  const [telefone, setTelefone] = useState(atendimento.telefone);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [saving, setSaving] = useState(false);

  const filtrados = clientes.filter(c => normText(c.nome).includes(normText(buscaCliente)));

  const confirmar = async () => {
    setSaving(true);
    try {
      if (modo === "novo") await concluirAtendimento(atendimento.id, { acao: "cadastrar_cliente", nome, telefone });
      else if (modo === "existente" && clienteId) await concluirAtendimento(atendimento.id, { acao: "vincular_cliente", clienteId });
      else await concluirAtendimento(atendimento.id, { acao: "nenhum" });
      onDone();
    } finally { setSaving(false); }
  };

  return (
    <Dialog onClose={onClose}>
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold" style={{ color: "var(--text)" }}>Finalizar atendimento</h2>
        <button onClick={onClose} style={{ color: "var(--text3)" }}>✕</button>
      </div>
      <p className="text-sm" style={{ color: "var(--text2)" }}>
        {atendimento.cliente}{atendimento.telefone && ` · ${atendimento.telefone}`}
      </p>

      <div className="space-y-2">
        {([
          ["novo", "Cadastrar novo cliente"],
          ["existente", "Vincular a cliente já cadastrado"],
          ["nenhum", "Não vincular por enquanto"],
        ] as const).map(([m, label]) => (
          <label key={m} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "var(--text2)" }}>
            <input type="radio" checked={modo === m} onChange={() => setModo(m)} />
            {label}
          </label>
        ))}
      </div>

      {modo === "novo" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
          <div><Label>Telefone</Label><Input value={telefone} onChange={e => setTelefone(e.target.value)} /></div>
        </div>
      )}

      {modo === "existente" && (
        <div className="space-y-2">
          <input value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)}
            placeholder="🔍 Buscar cliente..."
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filtrados.map(c => (
              <button key={c.id} onClick={() => setClienteId(c.id)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm"
                style={{
                  background: clienteId === c.id ? "rgba(201,168,76,0.15)" : "var(--surface2)",
                  color: clienteId === c.id ? "var(--gold)" : "var(--text2)",
                  border: `1px solid ${clienteId === c.id ? "var(--gold)" : "var(--border)"}`,
                }}>
                {c.nome}
              </button>
            ))}
            {filtrados.length === 0 && <p className="text-xs py-2 text-center" style={{ color: "var(--text3)" }}>Nenhum cliente encontrado.</p>}
          </div>
        </div>
      )}

      <button onClick={confirmar} disabled={saving || (modo === "existente" && !clienteId)}
        className="w-full py-2.5 rounded-xl font-semibold text-sm" style={{ background: "var(--gold)", color: "#000" }}>
        {saving ? "Salvando..." : "Confirmar"}
      </button>
    </Dialog>
  );
}

// ── aba principal ────────────────────────────────────────────────────────────────
export function AtendimentosTab({ onVerCliente }: { onVerCliente?: (nome: string) => void }) {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"lista" | "agenda" | "novo">("lista");

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [filtroForma, setFiltroForma] = useState("Todos");
  const [filtroResponsavel, setFiltroResponsavel] = useState("Todos");

  const [editando, setEditando] = useState<Atendimento | null>(null);
  const [concluindo, setConcluindo] = useState<Atendimento | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Atendimento | null>(null);

  const [agendaModo, setAgendaModo] = useState<"dia" | "semana" | "mes">("dia");
  const [agendaRef, setAgendaRef] = useState(todayIso());

  const load = useCallback(async () => {
    setLoading(true);
    try { setAtendimentos(await getAtendimentos()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/users").then(r => r.ok ? r.json() : [])
      .then((list: { name: string }[]) => setUsers(list.map(u => u.name)));
    getClientes().then(setClientes).catch(() => {});
  }, []);

  const filtrar = (lista: Atendimento[]) => {
    let r = lista;
    if (busca) { const b = normText(busca); r = r.filter(a => normText(a.cliente).includes(b)); }
    if (filtroStatus !== "Todos") r = r.filter(a => a.status === filtroStatus);
    if (filtroForma !== "Todos") r = r.filter(a => a.forma === filtroForma);
    if (filtroResponsavel !== "Todos") r = r.filter(a => a.responsavel === filtroResponsavel);
    return r.sort((a, b) => (normalizeData(a.data) + a.hora).localeCompare(normalizeData(b.data) + b.hora));
  };

  const listaFiltrada = filtrar(atendimentos);

  const handleSave = async (form: Omit<Atendimento, "id" | "criado_em">) => {
    if (editando) { await updateAtendimento(editando.id, form); setEditando(null); }
    else { await createAtendimento(form); setAba("lista"); }
    load();
  };

  const handleDelete = async (id: string) => { await deleteAtendimento(id); load(); };
  const handleIniciar = async (id: string) => { await updateAtendimento(id, { status: "Em andamento" }); load(); };
  const handleCriarProcesso = async (id: string) => { await criarProcessoDeAtendimento(id); load(); };

  const hoje = todayIso();
  const amanha = addDaysIso(hoje, 1);

  const renderLinha = (a: Atendimento) => {
    const editandoEsta = editando?.id === a.id;
    if (editandoEsta) {
      return <AtendimentoForm key={a.id} initial={editando} onSave={handleSave} onCancel={() => setEditando(null)} responsaveis={users} />;
    }
    const d = normalizeData(a.data);
    const eHoje = d === hoje;
    const eAmanha = d === amanha;
    const destaque = eHoje ? "#ef4444" : eAmanha ? "#f97316" : undefined;
    const gcalUrl = gcalUrlAtendimento(a);
    return (
      <div key={a.id} className="flex items-start gap-3 px-4 py-3 rounded-lg flex-wrap"
        style={{ background: eHoje ? "rgba(239,68,68,0.05)" : "var(--surface2)", border: `1px solid ${destaque ? `${destaque}4d` : "var(--border)"}` }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {eHoje && <span title="Hoje">⏰</span>}
            <span className="font-medium text-sm truncate" style={{ color: "var(--text)" }}>{a.cliente}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${badgeStatusAtendimento(a.status)}`}>{a.status}</span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
            {a.forma}{a.telefone && ` · ${a.telefone}`}
          </p>
          {a.observacoes && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text3)" }}>{a.observacoes}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {a.responsavel && <span className="text-xs" style={{ color: "var(--text2)" }}>{a.responsavel}</span>}
          {a.data && (
            <span className="text-xs tabular-nums whitespace-nowrap font-semibold" style={{ color: destaque || "var(--gold)" }}>
              {fmtData(a.data)}{a.hora && ` ${a.hora}`}
            </span>
          )}
          {gcalUrl && (
            <a href={gcalUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded whitespace-nowrap"
              style={{ background: "rgba(26,115,232,0.15)", color: "#60a5fa" }}>
              📅 Google Calendar
            </a>
          )}
          {a.status === "Agendado" && (
            <button onClick={() => handleIniciar(a.id)} className="text-xs px-2 py-1 rounded font-semibold"
              style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}>
              ▶️ Iniciar
            </button>
          )}
          {(a.status === "Agendado" || a.status === "Em andamento") && (
            <button onClick={() => setConcluindo(a)} className="text-xs px-2 py-1 rounded font-semibold"
              style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }}>
              ✅ Finalizar
            </button>
          )}
          {a.cliente_id && (
            <button onClick={() => onVerCliente?.(a.cliente)} className="text-xs px-2 py-1 rounded"
              style={{ background: "var(--surface)", color: "var(--gold)", border: "1px solid var(--border)" }}>
              👤 Ver Cliente
            </button>
          )}
          {a.cliente_id && !a.processo_id && (
            <button onClick={() => handleCriarProcesso(a.id)} className="text-xs px-2 py-1 rounded"
              style={{ background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border)" }}>
              📁 Criar Processo
            </button>
          )}
          <button onClick={() => setEditando(a)} className="text-xs px-2 py-1 rounded"
            style={{ background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border)" }}>✏️</button>
          <button onClick={() => setConfirmDelete(a)} className="text-xs px-2 py-1 rounded"
            style={{ background: "var(--surface)", color: "var(--text3)", border: "1px solid var(--border)" }}>🗑</button>
        </div>
      </div>
    );
  };

  const renderLista = (lista: Atendimento[]) => (
    lista.length === 0
      ? <p className="py-6 text-center text-sm" style={{ color: "var(--text3)" }}>Nenhum atendimento encontrado.</p>
      : <div className="space-y-2">{lista.map(renderLinha)}</div>
  );

  const AgendaView = () => {
    const doDia = (iso: string) => atendimentos.filter(a => normalizeData(a.data) === iso)
      .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));

    if (agendaModo === "dia") {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setAgendaRef(addDaysIso(agendaRef, -1))} className="px-3 py-1.5 rounded-lg text-sm" style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>← Anterior</button>
            <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{fmtData(agendaRef)}{agendaRef === hoje && " · Hoje"}</span>
            <button onClick={() => setAgendaRef(addDaysIso(agendaRef, 1))} className="px-3 py-1.5 rounded-lg text-sm" style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>Próximo →</button>
          </div>
          {renderLista(doDia(agendaRef))}
        </div>
      );
    }

    if (agendaModo === "semana") {
      const inicio = startOfWeekIso(agendaRef);
      const dias = Array.from({ length: 7 }, (_, i) => addDaysIso(inicio, i));
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setAgendaRef(addDaysIso(agendaRef, -7))} className="px-3 py-1.5 rounded-lg text-sm" style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>← Semana anterior</button>
            <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{fmtData(dias[0])} – {fmtData(dias[6])}</span>
            <button onClick={() => setAgendaRef(addDaysIso(agendaRef, 7))} className="px-3 py-1.5 rounded-lg text-sm" style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>Próxima semana →</button>
          </div>
          {dias.map((iso, i) => {
            const itens = doDia(iso);
            return (
              <div key={iso}>
                <p className="text-xs uppercase tracking-wider mb-2 font-semibold" style={{ color: iso === hoje ? "var(--gold)" : "var(--text3)" }}>
                  {DIAS_SEMANA[i]} · {fmtData(iso)}
                </p>
                {itens.length > 0 ? renderLista(itens) : <p className="text-xs pb-2" style={{ color: "var(--text3)" }}>Sem atendimentos.</p>}
              </div>
            );
          })}
        </div>
      );
    }

    // mês
    const weeks = monthGrid(agendaRef);
    const mesAtual = isoToDate(agendaRef).getMonth();
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setAgendaRef(addDaysIso(agendaRef, -28))} className="px-3 py-1.5 rounded-lg text-sm" style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>← Mês anterior</button>
          <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{MESES[mesAtual]} {isoToDate(agendaRef).getFullYear()}</span>
          <button onClick={() => setAgendaRef(addDaysIso(agendaRef, 28))} className="px-3 py-1.5 rounded-lg text-sm" style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>Próximo mês →</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs" style={{ color: "var(--text3)" }}>
          {DIAS_SEMANA.map(d => <div key={d} className="py-1 font-semibold">{d}</div>)}
          {weeks.flat().map(iso => {
            const itens = doDia(iso);
            const foraDoMes = isoToDate(iso).getMonth() !== mesAtual;
            return (
              <button key={iso} onClick={() => { setAgendaRef(iso); setAgendaModo("dia"); }}
                className="aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 p-1"
                style={{
                  background: iso === hoje ? "rgba(201,168,76,0.12)" : "var(--surface2)",
                  border: `1px solid ${iso === hoje ? "var(--gold)" : "var(--border)"}`,
                  opacity: foraDoMes ? 0.35 : 1,
                }}>
                <span style={{ color: "var(--text)" }}>{isoToDate(iso).getDate()}</span>
                {itens.length > 0 && (
                  <span className="text-[10px] px-1.5 rounded-full" style={{ background: "var(--gold)", color: "#000" }}>{itens.length}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const tabStyle = (tab: string) => ({
    background: aba === tab ? "var(--gold)" : "var(--surface2)",
    color: aba === tab ? "#000" : "var(--text2)",
    border: "1px solid var(--border)",
  });

  const proximosDestaque = atendimentos.filter(a =>
    a.status !== "Cancelado" && a.status !== "Concluído" && (normalizeData(a.data) === hoje || normalizeData(a.data) === amanha)
  );

  return (
    <div className="space-y-5">
      {confirmDelete && (
        <ConfirmModal
          title="Excluir atendimento"
          message={`Excluir o atendimento de "${confirmDelete.cliente}"?`}
          confirmLabel="Excluir"
          onConfirm={() => { handleDelete(confirmDelete.id); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {concluindo && (
        <ConcluirModal atendimento={concluindo} clientes={clientes} onClose={() => setConcluindo(null)}
          onDone={() => { setConcluindo(null); load(); getClientes().then(setClientes).catch(() => {}); }} />
      )}

      {proximosDestaque.length > 0 && aba !== "novo" && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--text2)" }}>
          🔔 {proximosDestaque.length} atendimento{proximosDestaque.length > 1 ? "s" : ""} hoje/amanhã.
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(["lista", "agenda", "novo"] as const).map(tab => (
          <button key={tab} onClick={() => setAba(tab)} className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors" style={tabStyle(tab)}>
            {tab === "lista" ? `📋 Lista (${atendimentos.length})` : tab === "agenda" ? "📅 Agenda" : "➕ Novo"}
          </button>
        ))}
      </div>

      {aba === "lista" && (
        <div className="flex flex-wrap gap-3">
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por cliente..."
            className="flex-1 min-w-48 px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
          <SelectField value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ width: "auto" }}>
            <option value="Todos">Status: Todos</option>
            {STATUS_ATENDIMENTO.map(s => <option key={s} value={s}>{s}</option>)}
          </SelectField>
          <SelectField value={filtroForma} onChange={e => setFiltroForma(e.target.value)} style={{ width: "auto" }}>
            <option value="Todos">Forma: Todas</option>
            {FORMAS_ATENDIMENTO.map(f => <option key={f} value={f}>{f}</option>)}
          </SelectField>
          <SelectField value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)} style={{ width: "auto" }}>
            <option value="Todos">Responsável: Todos</option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </SelectField>
        </div>
      )}

      {aba === "novo" && <AtendimentoForm onSave={handleSave} onCancel={() => setAba("lista")} responsaveis={users} />}

      {aba === "lista" && (loading
        ? <div className="py-8 text-center" style={{ color: "var(--text3)" }}>Carregando...</div>
        : renderLista(listaFiltrada)
      )}

      {aba === "agenda" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(["dia", "semana", "mes"] as const).map(m => (
              <button key={m} onClick={() => setAgendaModo(m)} className="px-3 py-1 rounded-lg text-xs font-medium"
                style={{
                  background: agendaModo === m ? "rgba(201,168,76,0.15)" : "var(--surface2)",
                  color: agendaModo === m ? "var(--gold)" : "var(--text3)",
                  border: `1px solid ${agendaModo === m ? "var(--gold)" : "var(--border)"}`,
                }}>
                {m === "dia" ? "Diária" : m === "semana" ? "Semanal" : "Mensal"}
              </button>
            ))}
          </div>
          <AgendaView />
        </div>
      )}
    </div>
  );
}
