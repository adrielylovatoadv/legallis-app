"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getClientes, createCliente, updateCliente, deleteCliente,
  fmtData, badgeAndamento,
  type Cliente, type Processo, type Inicial,
} from "@/lib/controle";
import { ConfirmModal } from "@/components/ConfirmModal";

type ClienteComProcs = Cliente & { _ativos?: Processo[]; _finalizados?: Processo[]; _iniciais?: Inicial[] };

function Inp({ ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className="w-full px-3 py-2 rounded-lg text-sm outline-none"
    style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text)" }} />;
}
function Lbl({ children }: { children: React.ReactNode }) {
  return <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color:"var(--text3)" }}>{children}</span>;
}

function ClienteForm({ initial, onSave, onCancel }: {
  initial?: Partial<Cliente>;
  onSave: (c: Omit<Cliente,"id"|"criado_em">) => Promise<void>;
  onCancel: () => void;
}) {
  const blank = { nome:"",telefone:"",cpf:"",email:"",endereco:"",tipo_aposentadoria:"",informacoes:"",senha_gov:"",senha_serasa:"" };
  const [form, setForm] = useState({ ...blank, ...(initial||{}) });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const submit = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    try { await onSave(form as Omit<Cliente,"id"|"criado_em">); } finally { setSaving(false); }
  };
  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Lbl>Nome *</Lbl><Inp value={form.nome} onChange={e => set("nome",e.target.value)} /></div>
        <div><Lbl>Telefone</Lbl><Inp value={form.telefone} onChange={e => set("telefone",e.target.value)} /></div>
        <div><Lbl>CPF</Lbl><Inp value={form.cpf} onChange={e => set("cpf",e.target.value)} /></div>
        <div><Lbl>E-mail</Lbl><Inp type="email" value={form.email} onChange={e => set("email",e.target.value)} /></div>
        <div className="sm:col-span-2"><Lbl>Endereço</Lbl><Inp value={form.endereco} onChange={e => set("endereco",e.target.value)} /></div>
        <div><Lbl>Tipo Aposentadoria</Lbl><Inp value={form.tipo_aposentadoria} onChange={e => set("tipo_aposentadoria",e.target.value)} /></div>
        <div><Lbl>Senha Gov.br</Lbl><Inp value={form.senha_gov} onChange={e => set("senha_gov",e.target.value)} /></div>
        <div><Lbl>Senha Serasa</Lbl><Inp value={form.senha_serasa} onChange={e => set("senha_serasa",e.target.value)} /></div>
        <div className="sm:col-span-2">
          <Lbl>Informações relevantes</Lbl>
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
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm"
          style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ClienteCard({ c, onEdit, onDelete }: {
  c: ClienteComProcs;
  onEdit: (c: Cliente) => void;
  onDelete: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [mostraSenhas, setMostraSenhas] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ativos = c._ativos || [];
  const finalizados = c._finalizados || [];
  const iniciais = c._iniciais || [];

  const semProcessos = ativos.length === 0 && finalizados.length === 0 && iniciais.length === 0;
  const badge = semProcessos ? null : [
    ativos.length > 0 ? `${ativos.length} ativo${ativos.length > 1?"s":""}` : null,
    finalizados.length > 0 ? `${finalizados.length} finalizado${finalizados.length > 1?"s":""}` : null,
    iniciais.length > 0 ? `${iniciais.length} inicial${iniciais.length > 1?"is":""}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="rounded-xl overflow-hidden" style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
      {confirmDelete && (
        <ConfirmModal
          title="Excluir cliente"
          message={`Tem certeza que deseja excluir "${c.nome}"? Todos os dados do cliente serão removidos.`}
          confirmLabel="Excluir"
          onConfirm={() => { setConfirmDelete(false); onDelete(c.id); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {/* Cabeçalho */}
      <div className="flex items-center justify-between p-4 cursor-pointer select-none"
        onClick={() => setAberto(!aberto)}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm select-text" style={{ color:"var(--text)" }} onClick={e => e.stopPropagation()}>👤 {c.nome}</span>
            {ativos.some(p => p.atencao) && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">🚨 Atenção</span>}
          </div>
          <p className="text-xs mt-0.5" style={{ color:"var(--text3)" }}>
            {c.telefone && <span>{c.telefone}</span>}
            {c.cpf && <span className="select-text ml-1" style={{ cursor:"text" }} onClick={e => e.stopPropagation()}>· {c.cpf}</span>}
            {c.tipo_aposentadoria && <span> · {c.tipo_aposentadoria}</span>}
            {badge
              ? <span className="ml-2 text-[var(--gold)]">{badge}</span>
              : <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background:"rgba(107,114,128,0.12)", color:"#9ca3af" }}>sem processos</span>
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); onEdit(c); }}
            className="text-xs px-2 py-1 rounded"
            style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>✏️</button>
          <button onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
            className="text-xs px-2 py-1 rounded"
            style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>🗑</button>
          <span className="text-xs" style={{ color:"var(--text3)" }}>{aberto ? "▲" : "▼"}</span>
        </div>
      </div>

      {aberto && (
        <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor:"var(--border)" }}>
          {/* Dados pessoais */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 text-xs" style={{ color:"var(--text2)" }}>
            {c.email && <div><span style={{ color:"var(--text3)" }}>E-mail: </span>{c.email}</div>}
            {c.endereco && <div className="col-span-2"><span style={{ color:"var(--text3)" }}>Endereço: </span>{c.endereco}</div>}
            <div>
              <span style={{ color:"var(--text3)" }}>Senha Gov.br: </span>
              {mostraSenhas ? (c.senha_gov || "—") : "••••••••"}
            </div>
            {c.senha_serasa && (
              <div>
                <span style={{ color:"var(--text3)" }}>Senha Serasa: </span>
                {mostraSenhas ? c.senha_serasa : "••••••••"}
              </div>
            )}
            <div>
              <button onClick={() => setMostraSenhas(!mostraSenhas)} className="text-xs underline"
                style={{ color:"var(--gold)" }}>
                {mostraSenhas ? "Ocultar senhas" : "👁️ Mostrar senhas"}
              </button>
            </div>
          </div>

          {/* Informações */}
          {c.informacoes && (
            <div className="text-xs p-3 rounded-lg" style={{ background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.2)", color:"var(--text2)" }}>
              ℹ️ {c.informacoes}
            </div>
          )}

          {/* Processos ativos */}
          {ativos.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider mb-2 font-semibold" style={{ color:"var(--text3)" }}>Processos ativos</p>
              <div className="space-y-1.5">
                {ativos.sort((a,b) => (a.data||"9999").localeCompare(b.data||"9999")).map(p => (
                  <div key={p.id} className="flex items-start gap-2 text-xs p-2 rounded-lg"
                    style={{ background: p.atencao ? "rgba(239,68,68,0.06)" : "var(--surface2)", borderLeft: `3px solid ${p.atencao ? "#ef4444" : "var(--border)"}` }}>
                    <span>{p.atencao ? "🚨" : "⚖️"}</span>
                    <div className="min-w-0 flex-1">
                      <span className="font-mono" style={{ color:"var(--text3)" }}>{p.numero_processo}</span>
                      {p.objeto && <span style={{ color:"var(--text2)" }}> — {p.objeto.slice(0,60)}</span>}
                      <span className="ml-2">
                        <span className={`px-1.5 py-0.5 rounded ${badgeAndamento(p.andamento)}`}>{p.andamento}</span>
                      </span>
                    </div>
                    {p.data && <span className="whitespace-nowrap" style={{ color:"var(--text3)" }}>{fmtData(p.data)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Processos finalizados */}
          {finalizados.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider mb-2 font-semibold" style={{ color:"var(--text3)" }}>Processos finalizados</p>
              <div className="space-y-1">
                {finalizados.map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-xs py-1" style={{ color:"var(--text3)" }}>
                    <span>📁</span>
                    <span className="font-mono">{p.numero_processo}</span>
                    <span>— {p.objeto?.slice(0,50)}</span>
                    <span style={{ color:"var(--text2)" }}>{p.andamento}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Iniciais */}
          {iniciais.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider mb-2 font-semibold" style={{ color:"var(--text3)" }}>Iniciais</p>
              <div className="space-y-1">
                {iniciais.map(i => (
                  <div key={i.id} className="flex items-center gap-2 text-xs py-1" style={{ color:"var(--text2)" }}>
                    <span>📝</span>
                    <span>{i.reu}</span>
                    {i.objeto && <span style={{ color:"var(--text3)" }}>— {i.objeto.slice(0,40)}</span>}
                    <span className={`px-1.5 py-0.5 rounded ${badgeAndamento(i.andamento)}`}>{i.andamento}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ClientesTab() {
  const [clientes, setClientes] = useState<ClienteComProcs[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p: Record<string,string> = { com_processos: "1" };
      if (busca) p.busca = busca;
      setClientes(await getClientes(p) as ClienteComProcs[]);
    } finally { setLoading(false); }
  }, [busca]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form: Omit<Cliente,"id"|"criado_em">) => {
    if (editando) { await updateCliente(editando.id, form); setEditando(null); }
    else { await createCliente(form); setNovoAberto(false); }
    load();
  };
  const handleDelete = async (id: string) => { await deleteCliente(id); load(); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center">
        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="🔍 Buscar por nome, CPF, telefone..."
          className="flex-1 min-w-48 px-3 py-2 rounded-lg text-sm"
          style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text)" }} />
        <button onClick={() => { setNovoAberto(true); setEditando(null); }}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background:"var(--gold)", color:"#000" }}>
          + Novo cliente
        </button>
      </div>

      {novoAberto && <ClienteForm onSave={handleSave} onCancel={() => setNovoAberto(false)} />}

      {editando && (
        <ClienteForm initial={editando} onSave={handleSave} onCancel={() => setEditando(null)} />
      )}

      {loading
        ? <div className="py-8 text-center" style={{ color:"var(--text3)" }}>Carregando...</div>
        : (
          <div className="space-y-2">
            {clientes.map(c => (
              <ClienteCard key={c.id} c={c}
                onEdit={c => { setEditando(c); setNovoAberto(false); window.scrollTo({ top: 0, behavior:"smooth" }); }}
                onDelete={handleDelete} />
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
