"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getClientes, createCliente, updateCliente, deleteCliente,
  type Cliente,
} from "@/lib/controle";

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className="w-full px-3 py-2 rounded-lg text-sm outline-none"
      style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text)" }} />
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>{children}</span>;
}

function ClienteForm({ initial, onSave, onCancel }: {
  initial?: Partial<Cliente>; onSave: (c: Omit<Cliente,"id"|"criado_em">) => Promise<void>; onCancel: () => void;
}) {
  const blank = { nome:"",telefone:"",cpf:"",email:"",endereco:"",tipo_aposentadoria:"",informacoes:"",senha_gov:"",senha_serasa:"" };
  const [form, setForm] = useState({ ...blank, ...(initial||{}) });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    try { await onSave(form as Omit<Cliente,"id"|"criado_em">); } finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Nome *</Label><Input value={form.nome} onChange={e => set("nome",e.target.value)} /></div>
        <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => set("telefone",e.target.value)} /></div>
        <div><Label>CPF</Label><Input value={form.cpf} onChange={e => set("cpf",e.target.value)} /></div>
        <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => set("email",e.target.value)} /></div>
        <div className="sm:col-span-2"><Label>Endereço</Label><Input value={form.endereco} onChange={e => set("endereco",e.target.value)} /></div>
        <div><Label>Tipo Aposentadoria</Label><Input value={form.tipo_aposentadoria} onChange={e => set("tipo_aposentadoria",e.target.value)} /></div>
        <div><Label>Senha Gov</Label><Input value={form.senha_gov} onChange={e => set("senha_gov",e.target.value)} /></div>
        <div className="sm:col-span-2">
          <Label>Informações relevantes</Label>
          <textarea rows={2} value={form.informacoes} onChange={e => set("informacoes",e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text)" }} />
        </div>
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

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setClientes(await getClientes(busca || undefined)); } finally { setLoading(false); }
  }, [busca]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form: Omit<Cliente,"id"|"criado_em">) => {
    if (editando) {
      await updateCliente(editando.id, form);
      setEditando(null);
    } else {
      await createCliente(form);
      setNovoAberto(false);
    }
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteCliente(id);
    load();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold" style={{ color:"var(--text)" }}>Clientes</h1>
          <p className="text-sm mt-0.5" style={{ color:"var(--text3)" }}>{clientes.length} cadastrado{clientes.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setNovoAberto(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background:"var(--gold)", color:"#000" }}>
          + Novo cliente
        </button>
      </div>

      <input value={busca} onChange={e => setBusca(e.target.value)}
        placeholder="🔍 Buscar por nome, CPF, telefone..."
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text)" }} />

      {novoAberto && (
        <ClienteForm onSave={handleSave} onCancel={() => setNovoAberto(false)} />
      )}

      {loading
        ? <div className="py-8 text-center" style={{ color:"var(--text3)" }}>Carregando...</div>
        : (
          <div className="space-y-2">
            {clientes.sort((a,b) => a.nome.localeCompare(b.nome)).map(c => (
              <div key={c.id}>
                {editando?.id === c.id ? (
                  <ClienteForm initial={editando} onSave={handleSave} onCancel={() => setEditando(null)} />
                ) : (
                  <div className="rounded-xl" style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
                    <div className="flex items-center justify-between p-4 cursor-pointer"
                      onClick={() => setExpandido(expandido === c.id ? null : c.id)}>
                      <div>
                        <p className="font-medium text-sm" style={{ color:"var(--text)" }}>{c.nome}</p>
                        <p className="text-xs mt-0.5" style={{ color:"var(--text3)" }}>
                          {[c.telefone, c.cpf, c.tipo_aposentadoria].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={e => { e.stopPropagation(); setEditando(c); }}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>✏️</button>
                        <button onClick={e => { e.stopPropagation(); if(confirm("Excluir cliente?")) handleDelete(c.id); }}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>🗑</button>
                      </div>
                    </div>
                    {expandido === c.id && (
                      <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs border-t"
                        style={{ borderColor:"var(--border)", color:"var(--text2)" }}>
                        {c.email && <div><span style={{ color:"var(--text3)" }}>E-mail: </span>{c.email}</div>}
                        {c.endereco && <div className="col-span-2"><span style={{ color:"var(--text3)" }}>Endereço: </span>{c.endereco}</div>}
                        {c.informacoes && <div className="col-span-3"><span style={{ color:"var(--text3)" }}>Informações: </span>{c.informacoes}</div>}
                        {c.senha_gov && <div><span style={{ color:"var(--text3)" }}>Senha Gov: </span>{c.senha_gov}</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {clientes.length === 0 && (
              <p className="py-8 text-center text-sm" style={{ color:"var(--text3)" }}>Nenhum cliente encontrado.</p>
            )}
          </div>
        )
      }
    </div>
  );
}
