"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getIniciais, createInicial, updateInicial, deleteInicial,
  ANDAMENTOS_INICIAL, RESPONSAVEIS, badgeAndamento,
  type Inicial,
} from "@/lib/controle";

const ANDAMENTOS_PENDENTES = ["FAZER INICIAL","EM ANDAMENTO","AGUARDAR","AGUARDAR DOCS","AGUARDAR CONTRATO","AGUARDAR LIMINAR","ENVIAR NOTIFICAÇÃO","AGUARDAR NOTIFICAÇÃO","ASSINAR PROCURAÇÃO"];
const ANDAMENTOS_CONCLUIDOS = ["PROTOCOLADO","ARQUIVADO"];

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className="w-full px-3 py-2 rounded-lg text-sm outline-none"
      style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text)" }} />
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>{children}</span>;
}
function SelectField({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className="w-full px-3 py-2 rounded-lg text-sm outline-none"
      style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text)" }}>
      {children}
    </select>
  );
}

function InicialForm({ initial, onSave, onCancel }: {
  initial?: Partial<Inicial>; onSave: (i: Omit<Inicial,"id"|"criado_em">) => Promise<void>; onCancel: () => void;
}) {
  const blank = { cliente:"",reu:"",objeto:"",andamento:"FAZER INICIAL",responsavel:"",observacoes:"" };
  const [form, setForm] = useState({ ...blank, ...(initial||{}) });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.cliente.trim()) return;
    setSaving(true);
    try { await onSave(form as Omit<Inicial,"id"|"criado_em">); } finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Cliente *</Label><Input value={form.cliente} onChange={e => set("cliente",e.target.value)} /></div>
        <div><Label>Réu</Label><Input value={form.reu} onChange={e => set("reu",e.target.value)} /></div>
        <div><Label>Objeto</Label><Input value={form.objeto} onChange={e => set("objeto",e.target.value)} /></div>
        <div>
          <Label>Andamento</Label>
          <SelectField value={form.andamento} onChange={e => set("andamento",e.target.value)}>
            {ANDAMENTOS_INICIAL.map(a => <option key={a} value={a}>{a}</option>)}
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

export default function IniciaisPage() {
  const [iniciais, setIniciais] = useState<Inicial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroAnd, setFiltroAnd] = useState("Todos");
  const [aba, setAba] = useState<"pendentes"|"concluidos"|"novo">("pendentes");
  const [editando, setEditando] = useState<Inicial | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setIniciais(await getIniciais()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtrar = (lista: Inicial[]) => {
    let r = lista;
    if (busca) {
      const b = busca.toLowerCase();
      r = r.filter(i => (i.cliente||"").toLowerCase().includes(b) || (i.reu||"").toLowerCase().includes(b) || (i.objeto||"").toLowerCase().includes(b));
    }
    if (filtroAnd !== "Todos") r = r.filter(i => i.andamento === filtroAnd);
    return r;
  };

  const pendentes = filtrar(iniciais.filter(i => !ANDAMENTOS_CONCLUIDOS.includes((i.andamento||"").toUpperCase().trim())));
  const concluidos = filtrar(iniciais.filter(i => ANDAMENTOS_CONCLUIDOS.includes((i.andamento||"").toUpperCase().trim())));

  const handleSave = async (form: Omit<Inicial,"id"|"criado_em">) => {
    if (editando) {
      await updateInicial(editando.id, form);
      setEditando(null);
    } else {
      await createInicial(form);
      setAba("pendentes");
    }
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteInicial(id);
    load();
  };

  const tabStyle = (tab: string) => ({
    background: aba === tab ? "var(--gold)" : "var(--surface2)",
    color: aba === tab ? "#000" : "var(--text2)",
    border: "1px solid var(--border)",
  });

  const renderLista = (lista: Inicial[]) => (
    lista.length === 0
      ? <p className="py-6 text-center text-sm" style={{ color:"var(--text3)" }}>Nenhuma inicial encontrada.</p>
      : (
        <div className="space-y-2">
          {lista.map(i => (
            editando?.id === i.id
              ? <InicialForm key={i.id} initial={editando} onSave={handleSave} onCancel={() => setEditando(null)} />
              : (
                <div key={i.id} className="flex items-center gap-3 px-4 py-3 rounded-lg"
                  style={{ background:"var(--surface2)", border:"1px solid var(--border)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate" style={{ color:"var(--text)" }}>{i.cliente}</span>
                      {i.reu && <span className="text-xs" style={{ color:"var(--text3)" }}>× {i.reu}</span>}
                    </div>
                    {i.objeto && <p className="text-xs mt-0.5 truncate" style={{ color:"var(--text3)" }}>{i.objeto}</p>}
                    {i.observacoes && <p className="text-xs mt-0.5 truncate" style={{ color:"var(--text3)" }}>{i.observacoes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {i.responsavel && <span className="text-xs" style={{ color:"var(--text2)" }}>{i.responsavel}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${badgeAndamento(i.andamento)}`}>{i.andamento}</span>
                    <button onClick={() => setEditando(i)} className="text-xs px-2 py-1 rounded"
                      style={{ background:"var(--surface)", color:"var(--text2)", border:"1px solid var(--border)" }}>✏️</button>
                    <button onClick={() => { if(confirm("Excluir?")) handleDelete(i.id); }}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background:"var(--surface)", color:"var(--text3)", border:"1px solid var(--border)" }}>🗑</button>
                  </div>
                </div>
              )
          ))}
        </div>
      )
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-semibold" style={{ color:"var(--text)" }}>Iniciais</h1>
        <p className="text-sm mt-0.5" style={{ color:"var(--text3)" }}>Petições iniciais e seu andamento</p>
      </div>

      {/* Abas */}
      <div className="flex gap-2 flex-wrap">
        {(["pendentes","concluidos","novo"] as const).map(tab => (
          <button key={tab} onClick={() => setAba(tab)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={tabStyle(tab)}>
            {tab === "pendentes" ? `📋 Pendentes (${iniciais.filter(i => !ANDAMENTOS_CONCLUIDOS.includes((i.andamento||"").toUpperCase())).length})`
              : tab === "concluidos" ? `✅ Concluídas`
              : "➕ Nova"}
          </button>
        ))}
      </div>

      {aba !== "novo" && (
        <div className="flex flex-wrap gap-3">
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Buscar por cliente, réu, objeto..."
            className="flex-1 min-w-48 px-3 py-2 rounded-lg text-sm"
            style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text)" }} />
          <SelectField value={filtroAnd} onChange={e => setFiltroAnd(e.target.value)} style={{ width:"auto" }}>
            <option value="Todos">Andamento: Todos</option>
            {ANDAMENTOS_INICIAL.map(a => <option key={a} value={a}>{a}</option>)}
          </SelectField>
        </div>
      )}

      {aba === "novo" && (
        <InicialForm onSave={handleSave} onCancel={() => setAba("pendentes")} />
      )}
      {aba === "pendentes" && (loading
        ? <div className="py-8 text-center" style={{ color:"var(--text3)" }}>Carregando...</div>
        : renderLista(pendentes)
      )}
      {aba === "concluidos" && (loading
        ? <div className="py-8 text-center" style={{ color:"var(--text3)" }}>Carregando...</div>
        : renderLista(concluidos)
      )}
    </div>
  );
}
