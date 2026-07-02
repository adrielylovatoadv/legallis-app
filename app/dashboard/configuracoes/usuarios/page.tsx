"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Plan, Role } from "@/lib/plans";
import { PLAN_FEATURES } from "@/lib/plans";

type Cargo = "administrador" | "socio" | "advogado" | "estagiario" | "assistente";
type SafeUser = { id: string; name: string; email: string; role: Role; plan: Plan; cargo?: Cargo; isActive: boolean; createdAt: string };

const ROLES: { value: Role; label: string }[] = [
  { value: "admin", label: "Administrador do sistema" },
  { value: "user", label: "Usuário comum" },
];

const CARGOS: { value: Cargo; label: string }[] = [
  { value: "administrador", label: "Administrador" },
  { value: "socio", label: "Sócio" },
  { value: "advogado", label: "Advogado" },
  { value: "estagiario", label: "Estagiário" },
  { value: "assistente", label: "Assistente" },
];

const blankNewUser = { name: "", email: "", password: "", role: "user" as Role, cargo: "advogado" as Cargo };

export default function UsuariosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState(blankNewUser);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<SafeUser>>({});
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const isSuperAdmin = session?.user?.role === "admin";
  const isOwner = !!session?.user && session.user.tenantId === `t_${session.user.id}`;

  const load = useCallback(async () => {
    const res = await fetch("/api/usuarios");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!isSuperAdmin && !isOwner) { router.push("/dashboard/configuracoes"); return; }
    load();
  }, [session, status, router, load, isSuperAdmin, isOwner]);

  const plan = (session?.user?.plan ?? "basic") as Plan;
  const maxUsers = PLAN_FEATURES[plan]?.maxUsers ?? 1;
  const atLimit = users.length >= maxUsers;

  const createUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      setMsg({ type: "err", text: "Preencha todos os campos." }); return;
    }
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    if (res.ok) { setMsg({ type: "ok", text: "Usuário criado." }); setCreating(false); setNewUser(blankNewUser); load(); }
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
    else { const d = await res.json(); setMsg({ type: "err", text: d.error ?? "Erro ao atualizar." }); }
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

  const resetPassword = async (id: string) => {
    if (!newPassword || newPassword.length < 6) { setMsg({ type: "err", text: "A senha deve ter ao menos 6 caracteres." }); return; }
    const res = await fetch(`/api/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    if (res.ok) { setMsg({ type: "ok", text: "Senha redefinida." }); setResettingId(null); setNewPassword(""); }
    else { setMsg({ type: "err", text: "Erro ao redefinir senha." }); }
  };

  const inp = "w-full px-3 py-2 rounded-lg text-sm outline-none";
  const inpStyle = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" };
  const cargoLabel = (c?: Cargo) => CARGOS.find(x => x.value === c)?.label ?? "—";

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

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold" style={{ color: "var(--text)" }}>Usuários ({users.length})</h2>
          <p className="text-xs mt-0.5" style={{ color: atLimit ? "#f87171" : "var(--text3)" }}>
            {users.length} de {maxUsers === Infinity ? "∞" : maxUsers} usuários do plano {PLAN_FEATURES[plan]?.label ?? plan}
          </p>
        </div>
        <button onClick={() => setCreating(!creating)} disabled={atLimit && !creating}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: "var(--gold)", color: "#000" }}>
          + Adicionar usuário
        </button>
      </div>

      {atLimit && !creating && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
          Limite de usuários do plano {PLAN_FEATURES[plan]?.label ?? plan} atingido. Faça upgrade para adicionar mais usuários.
        </p>
      )}

      {creating && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--gold)" }}>
          <h3 className="font-medium text-sm" style={{ color: "var(--gold)" }}>Novo Usuário</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })}
              placeholder="Nome completo" autoComplete="off" className={inp} style={inpStyle} />
            <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="E-mail" autoComplete="off" className={inp} style={inpStyle} />
            <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })}
              placeholder="Senha" autoComplete="new-password" className={inp} style={inpStyle} />
            <select value={newUser.cargo} onChange={e => setNewUser({ ...newUser, cargo: e.target.value as Cargo })}
              className={inp} style={inpStyle}>
              {CARGOS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {isSuperAdmin && (
              <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as Role })}
                className={inp} style={inpStyle}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            )}
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
              {["Nome", "E-mail", "Perfil", "Status", "Ações"].map(h => (
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
                    <select value={editData.cargo ?? u.cargo ?? ""} onChange={e => setEditData({ ...editData, cargo: e.target.value as Cargo })}
                      className="px-2 py-1 rounded text-sm" style={inpStyle}>
                      <option value="">—</option>
                      {CARGOS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs"
                      style={{ background: "var(--surface2)", color: "var(--text2)" }}>
                      {cargoLabel(u.cargo)}
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
                  {resettingId === u.id ? (
                    <div className="flex items-center gap-1">
                      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                        placeholder="Nova senha" autoComplete="new-password"
                        className="px-2 py-1 rounded text-xs w-32" style={inpStyle} />
                      <button onClick={() => resetPassword(u.id)} className="px-2 py-1 rounded text-xs font-medium" style={{ background: "var(--gold)", color: "#000" }}>OK</button>
                      <button onClick={() => { setResettingId(null); setNewPassword(""); }} className="px-2 py-1 rounded text-xs" style={{ background: "var(--surface2)", color: "var(--text3)" }}>✕</button>
                    </div>
                  ) : (
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
                          {u.id !== session?.user?.id && (
                            <button onClick={() => { setResettingId(u.id); setNewPassword(""); }}
                              className="p-1.5 rounded transition-colors hover:bg-white/5" style={{ color: "var(--text3)" }} title="Redefinir senha">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                            </button>
                          )}
                          {u.id !== session?.user?.id && (
                            <button onClick={() => toggleActive(u)}
                              className="p-1.5 rounded transition-colors hover:bg-white/5" style={{ color: u.isActive !== false ? "#facc15" : "#4ade80" }}
                              title={u.isActive !== false ? "Desativar" : "Ativar"}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            </button>
                          )}
                          {u.id !== session?.user?.id && (
                            <button onClick={() => deleteUser(u.id)}
                              className="p-1.5 rounded transition-colors hover:bg-red-500/10" style={{ color: "#f87171" }} title="Excluir">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
