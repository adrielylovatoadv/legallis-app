"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Plan, Role } from "@/lib/plans";

type SafeUser = { id: string; name: string; email: string; role: Role; plan: Plan; isActive: boolean; createdAt: string };

const ROLES: { value: Role; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "user", label: "Usuário Comum" },
];

const PLANS: { value: Plan; label: string }[] = [
  { value: "basic", label: "Básico" },
  { value: "pro", label: "Pro" },
];

export default function UsuariosPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "user" as Role, plan: "basic" as Plan });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<SafeUser>>({});
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/usuarios");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session?.user?.role !== "admin") { router.push("/dashboard/configuracoes"); return; }
    load();
  }, [session, router, load]);

  const createUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      setMsg({ type: "err", text: "Preencha todos os campos." }); return;
    }
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    if (res.ok) { setMsg({ type: "ok", text: "Usuário criado." }); setCreating(false); setNewUser({ name: "", email: "", password: "", role: "user", plan: "basic" }); load(); }
    else { const d = await res.json(); setMsg({ type: "err", text: d.error ?? "Erro ao criar." }); }
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const res = await fetch(`/api/usuarios/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    });
    if (res.ok) { setMsg({ type: "ok", text: "Atualizado." }); setEditingId(null); load(); }
    else setMsg({ type: "err", text: "Erro ao atualizar." });
  };

  const toggleActive = async (u: SafeUser) => {
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    if (res.ok) { setMsg({ type: "ok", text: u.isActive ? "Usuário desativado." : "Usuário ativado." }); load(); }
  };

  const deleteUser = async (id: string) => {
    if (id === session?.user?.id) { setMsg({ type: "err", text: "Não é possível excluir seu próprio usuário." }); return; }
    if (!confirm("Excluir este usuário?")) return;
    const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
    if (res.ok) { setMsg({ type: "ok", text: "Excluído." }); load(); }
  };

  const inp = "w-full px-3 py-2 rounded-lg text-sm outline-none";
  const inpStyle = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" };

  if (loading) return <div className="text-sm" style={{ color: "var(--text3)" }}>Carregando...</div>;

  return (
    <div className="space-y-6">
      {msg && (
        <div className="text-sm px-4 py-2.5 rounded-lg"
          style={{
            background: msg.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${msg.type === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: msg.type === "ok" ? "#4ade80" : "#f87171",
          }}>
          {msg.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-semibold" style={{ color: "var(--text)" }}>Usuários ({users.length})</h2>
        <button onClick={() => setCreating(!creating)}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: "var(--gold)", color: "#000" }}>
          + Adicionar usuário
        </button>
      </div>

      {creating && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--gold)" }}>
          <h3 className="font-medium text-sm" style={{ color: "var(--gold)" }}>Novo Usuário</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })}
              placeholder="Nome completo" className={inp} style={inpStyle} />
            <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="E-mail" className={inp} style={inpStyle} />
            <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })}
              placeholder="Senha" className={inp} style={inpStyle} />
            <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as Role })}
              className={inp} style={inpStyle}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={createUser} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--gold)", color: "#000" }}>Criar</button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 rounded-lg text-sm" style={{ background: "var(--surface2)", color: "var(--text3)" }}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
              {["Nome", "E-mail", "Tipo", "Status", "Ações"].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--text3)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                <td className="px-4 py-3" style={{ color: "var(--text)" }}>
                  {editingId === u.id ? (
                    <input value={editData.name ?? u.name} onChange={e => setEditData({ ...editData, name: e.target.value })}
                      className="px-2 py-1 rounded text-sm w-full" style={inpStyle} />
                  ) : u.name}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--text2)" }}>
                  {editingId === u.id ? (
                    <input value={editData.email ?? u.email} onChange={e => setEditData({ ...editData, email: e.target.value })}
                      className="px-2 py-1 rounded text-sm w-full" style={inpStyle} />
                  ) : u.email}
                </td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <select value={editData.role ?? u.role} onChange={e => setEditData({ ...editData, role: e.target.value as Role })}
                      className="px-2 py-1 rounded text-sm" style={inpStyle}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs"
                      style={{ background: u.role === "admin" ? "rgba(201,168,76,0.15)" : "var(--surface2)", color: u.role === "admin" ? "var(--gold)" : "var(--text3)" }}>
                      {u.role === "admin" ? "Admin" : "Usuário"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs"
                    style={{ background: u.isActive !== false ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: u.isActive !== false ? "#4ade80" : "#f87171" }}>
                    {u.isActive !== false ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {editingId === u.id ? (
                      <>
                        <button onClick={saveEdit} className="px-3 py-1 rounded text-xs font-medium" style={{ background: "var(--gold)", color: "#000" }}>Salvar</button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1 rounded text-xs" style={{ background: "var(--surface2)", color: "var(--text3)" }}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(u.id); setEditData({}); }}
                          className="p-1.5 rounded transition-colors hover:bg-white/5" style={{ color: "var(--text3)" }} title="Editar">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => toggleActive(u)}
                          className="p-1.5 rounded transition-colors hover:bg-white/5" style={{ color: u.isActive !== false ? "#facc15" : "#4ade80" }}
                          title={u.isActive !== false ? "Desativar" : "Ativar"}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        </button>
                        {u.id !== session?.user?.id && (
                          <button onClick={() => deleteUser(u.id)}
                            className="p-1.5 rounded transition-colors hover:bg-red-500/10" style={{ color: "#f87171" }} title="Excluir">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
