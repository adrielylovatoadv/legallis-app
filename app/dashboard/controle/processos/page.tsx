"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getProcessos, createProcesso, updateProcesso, deleteProcesso,
  ANDAMENTOS_PROCESSO, RESPONSAVEIS, fmtData, badgeAndamento,
  type Processo,
} from "@/lib/controle";

const FILTROS_PERIODO = ["Todos","Hoje","Próximos 3 dias","Próximos 7 dias","Este mês"];

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className="w-full px-3 py-2 rounded-lg text-sm outline-none"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
  );
}
function SelectField({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className="w-full px-3 py-2 rounded-lg text-sm outline-none"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
      {children}
    </select>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>{children}</span>;
}

// ── Formulário ────────────────────────────────────────────────────────────────
function ProcessoForm({ initial, onSave, onCancel }: {
  initial?: Partial<Processo>; onSave: (data: Omit<Processo, "id" | "criado_em">) => Promise<void>; onCancel: () => void;
}) {
  const blank = { autor:"",reu:"",objeto:"",numero_processo:"",data:"",hora:"",andamento:"",responsavel:"",observacoes:"",atencao:false,finalizado:false };
  const [form, setForm] = useState({ ...blank, ...(initial || {}) });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.autor.trim()) return;
    setSaving(true);
    try { await onSave(form as Omit<Processo,"id"|"criado_em">); } finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Autor *</Label><Input value={form.autor} onChange={e => set("autor",e.target.value)} /></div>
        <div><Label>Réu</Label><Input value={form.reu} onChange={e => set("reu",e.target.value)} /></div>
        <div><Label>Objeto</Label><Input value={form.objeto} onChange={e => set("objeto",e.target.value)} /></div>
        <div><Label>Nº Processo</Label><Input value={form.numero_processo} onChange={e => set("numero_processo",e.target.value)} /></div>
        <div><Label>Data (YYYY-MM-DD)</Label><Input type="date" value={form.data} onChange={e => set("data",e.target.value)} /></div>
        <div><Label>Hora</Label><Input value={form.hora} placeholder="HH:MM" onChange={e => set("hora",e.target.value)} /></div>
        <div>
          <Label>Andamento</Label>
          <SelectField value={form.andamento} onChange={e => set("andamento",e.target.value)}>
            <option value="">Selecionar</option>
            {ANDAMENTOS_PROCESSO.map(a => <option key={a} value={a}>{a}</option>)}
          </SelectField>
        </div>
        <div>
          <Label>Responsável</Label>
          <SelectField value={form.responsavel} onChange={e => set("responsavel",e.target.value)}>
            {RESPONSAVEIS.map(r => <option key={r} value={r}>{r || "—"}</option>)}
          </SelectField>
        </div>
      </div>
      <div>
        <Label>Observações</Label>
        <textarea rows={2} value={form.observacoes} onChange={e => set("observacoes",e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm resize-none"
          style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text)" }} />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!form.atencao} onChange={e => set("atencao",e.target.checked)} className="accent-red-500" />
          <span className="text-sm" style={{ color:"var(--text2)" }}>🚨 Atenção</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!form.finalizado} onChange={e => set("finalizado",e.target.checked)} className="accent-gray-500" />
          <span className="text-sm" style={{ color:"var(--text2)" }}>Finalizado</span>
        </label>
      </div>
      <div className="flex gap-3">
        <button onClick={submit} disabled={saving}
          className="px-5 py-2 rounded-lg font-semibold text-sm"
          style={{ background:"var(--gold)", color:"#000" }}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button onClick={onCancel} className="px-5 py-2 rounded-lg text-sm"
          style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Linha da tabela ───────────────────────────────────────────────────────────
function ProcessoRow({ p, onEdit, onDelete }: {
  p: Processo; onEdit: (p: Processo) => void; onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}
      className={p.atencao ? "bg-red-500/5" : ""}>
      <td className="py-2 pr-3 text-sm font-medium max-w-40 truncate" style={{ color:"var(--text)" }}>
        {p.atencao && <span className="mr-1 text-red-400">🚨</span>}{p.autor}
      </td>
      <td className="py-2 pr-3 text-sm" style={{ color:"var(--text2)" }}>{p.reu}</td>
      <td className="py-2 pr-3 text-xs max-w-32 truncate" style={{ color:"var(--text3)" }}>{p.objeto}</td>
      <td className="py-2 pr-3 text-xs font-mono" style={{ color:"var(--text3)" }}>{p.numero_processo}</td>
      <td className="py-2 pr-3 text-xs tabular-nums whitespace-nowrap" style={{ color:"var(--text2)" }}>
        {fmtData(p.data)}{p.hora && ` ${p.hora}`}
      </td>
      <td className="py-2 pr-3">
        {p.andamento && (
          <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${badgeAndamento(p.andamento)}`}>{p.andamento}</span>
        )}
      </td>
      <td className="py-2 pr-3 text-xs" style={{ color:"var(--text3)" }}>{p.responsavel}</td>
      <td className="py-2">
        <div className="flex gap-1">
          <button onClick={() => onEdit(p)} className="text-xs px-2 py-1 rounded"
            style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>✏️</button>
          {confirming
            ? <button onClick={() => { onDelete(p.id); setConfirming(false); }}
                className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">Confirmar</button>
            : <button onClick={() => setConfirming(true)} className="text-xs px-2 py-1 rounded"
                style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>🗑</button>
          }
        </div>
      </td>
    </tr>
  );
}

// ── página ────────────────────────────────────────────────────────────────────
export default function ProcessosPage() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroAnd, setFiltroAnd] = useState("Todos");
  const [filtroPer, setFiltroPer] = useState("Todos");
  const [abaAtiva, setAbaAtiva] = useState<"ativos"|"finalizados"|"novo">("ativos");
  const [editando, setEditando] = useState<Processo | null>(null);
  const [soAtencao, setSoAtencao] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getProcessos();
      setProcessos(all);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtrar = useCallback((lista: Processo[]) => {
    let r = lista;
    if (busca) {
      const b = busca.toLowerCase();
      r = r.filter(p => (p.autor||"").toLowerCase().includes(b) || (p.reu||"").toLowerCase().includes(b)
        || (p.numero_processo||"").toLowerCase().includes(b) || (p.objeto||"").toLowerCase().includes(b));
    }
    if (filtroAnd !== "Todos") r = r.filter(p => (p.andamento||"").toUpperCase().includes(filtroAnd.toUpperCase()));
    if (soAtencao) r = r.filter(p => p.atencao);
    if (filtroPer !== "Todos") {
      const hoje = new Date().toISOString().split("T")[0];
      const em3  = new Date(Date.now() + 3*86400000).toISOString().split("T")[0];
      const em7  = new Date(Date.now() + 7*86400000).toISOString().split("T")[0];
      const mes  = hoje.slice(0,7);
      if (filtroPer === "Hoje") r = r.filter(p => p.data?.slice(0,10) === hoje);
      else if (filtroPer === "Próximos 3 dias") r = r.filter(p => p.data >= hoje && p.data <= em3);
      else if (filtroPer === "Próximos 7 dias") r = r.filter(p => p.data >= hoje && p.data <= em7);
      else if (filtroPer === "Este mês") r = r.filter(p => p.data?.startsWith(mes));
    }
    return r;
  }, [busca, filtroAnd, filtroPer, soAtencao]);

  const ativos = filtrar(processos.filter(p => !p.finalizado));
  const finalizados = filtrar(processos.filter(p => p.finalizado));

  const handleSave = async (form: Omit<Processo,"id"|"criado_em">) => {
    if (editando) {
      await updateProcesso(editando.id, form);
      setEditando(null);
    } else {
      await createProcesso(form);
      setAbaAtiva("ativos");
    }
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteProcesso(id);
    load();
  };

  const tabStyle = (tab: string) => ({
    background: abaAtiva === tab ? "var(--gold)" : "var(--surface2)",
    color: abaAtiva === tab ? "#000" : "var(--text2)",
    border: "1px solid var(--border)",
  });

  const renderTable = (lista: Processo[]) => (
    lista.length === 0
      ? <p className="py-6 text-center text-sm" style={{ color:"var(--text3)" }}>Nenhum processo encontrado.</p>
      : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom:"2px solid var(--border)" }}>
                {["Autor","Réu","Objeto","Processo","Data/Hora","Andamento","Resp.",""].map(h => (
                  <th key={h} className="pb-2 pt-1 text-left pr-3 text-xs uppercase tracking-wider font-medium"
                    style={{ color:"var(--text3)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.sort((a,b) => (a.data||"9").localeCompare(b.data||"9")).map(p => (
                editando?.id === p.id
                  ? <tr key={p.id}><td colSpan={8} className="py-2">
                      <ProcessoForm initial={editando} onSave={handleSave} onCancel={() => setEditando(null)} />
                    </td></tr>
                  : <ProcessoRow key={p.id} p={p} onEdit={setEditando} onDelete={handleDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-semibold" style={{ color:"var(--text)" }}>Andamentos Processuais</h1>
        <p className="text-sm mt-0.5" style={{ color:"var(--text3)" }}>Prazos, audiências e movimentações</p>
      </div>

      {/* Abas */}
      <div className="flex gap-2 flex-wrap">
        {(["ativos","finalizados","novo"] as const).map(tab => (
          <button key={tab} onClick={() => setAbaAtiva(tab)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={tabStyle(tab)}>
            {tab === "ativos" ? `📋 Ativos (${processos.filter(p => !p.finalizado).length})`
              : tab === "finalizados" ? `✅ Finalizados (${processos.filter(p => p.finalizado).length})`
              : "➕ Novo"}
          </button>
        ))}
      </div>

      {/* Filtros */}
      {abaAtiva !== "novo" && (
        <div className="flex flex-wrap gap-3 items-center">
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Buscar por nome, processo, réu..."
            className="px-3 py-2 rounded-lg text-sm flex-1 min-w-48"
            style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text)" }} />
          <SelectField value={filtroAnd} onChange={e => setFiltroAnd(e.target.value)} style={{ width:"auto" }}>
            <option value="Todos">Andamento: Todos</option>
            {ANDAMENTOS_PROCESSO.map(a => <option key={a} value={a}>{a}</option>)}
          </SelectField>
          <SelectField value={filtroPer} onChange={e => setFiltroPer(e.target.value)} style={{ width:"auto" }}>
            {FILTROS_PERIODO.map(f => <option key={f} value={f}>{f}</option>)}
          </SelectField>
          <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={soAtencao} onChange={e => setSoAtencao(e.target.checked)} className="accent-red-500" />
            <span className="text-sm" style={{ color:"var(--text2)" }}>🚨 Só Atenção</span>
          </label>
        </div>
      )}

      {/* Conteúdo */}
      <div className="rounded-xl p-5" style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
        {abaAtiva === "novo" && (
          <ProcessoForm
            onSave={handleSave}
            onCancel={() => setAbaAtiva("ativos")} />
        )}
        {abaAtiva === "ativos" && (loading
          ? <div className="py-8 text-center" style={{ color:"var(--text3)" }}>Carregando...</div>
          : renderTable(ativos)
        )}
        {abaAtiva === "finalizados" && (loading
          ? <div className="py-8 text-center" style={{ color:"var(--text3)" }}>Carregando...</div>
          : renderTable(finalizados)
        )}
      </div>
    </div>
  );
}
