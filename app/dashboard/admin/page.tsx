"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PLAN_FEATURES } from "@/lib/plans";
import type { Plan, Role } from "@/lib/plans";

type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  plan: Plan;
  createdAt: string;
  tenantId?: string;
};

const PLANS: Plan[] = ["basic", "pro", "admin"];

function PlanBadge({ plan }: { plan: Plan }) {
  const colors: Record<Plan, string> = {
    admin: "rgba(201,168,76,0.2)",
    profissional: "rgba(52,211,153,0.2)",
    pro: "rgba(99,102,241,0.2)",
    basic: "rgba(107,114,128,0.2)",
  };
  const text: Record<Plan, string> = {
    admin: "var(--gold)",
    profissional: "#34d399",
    pro: "#818cf8",
    basic: "var(--text3)",
  };
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: colors[plan], color: text[plan] }}>
      {PLAN_FEATURES[plan].label}
    </span>
  );
}

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<SafeUser & { password: string }>>({});
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "user" as Role, plan: "basic" as Plan });
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/usuarios");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session?.user.role !== "admin") { router.push("/dashboard"); return; }
    load();
  }, [session, router, load]);

  const saveEdit = async () => {
    if (!editingId) return;
    const res = await fetch(`/api/usuarios/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    });
    if (res.ok) { setMsg({ type: "ok", text: "Usuário atualizado." }); setEditingId(null); load(); }
    else setMsg({ type: "err", text: "Erro ao atualizar." });
  };

  const createUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      setMsg({ type: "err", text: "Preencha todos os campos." }); return;
    }
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    if (res.ok) {
      setMsg({ type: "ok", text: "Usuário criado." });
      setCreating(false);
      setNewUser({ name: "", email: "", password: "", role: "user", plan: "basic" });
      load();
    } else setMsg({ type: "err", text: "Erro ao criar usuário." });
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`Excluir usuário "${name}"?`)) return;
    const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
    if (res.ok) { setMsg({ type: "ok", text: "Usuário excluído." }); load(); }
    else { const d = await res.json(); setMsg({ type: "err", text: d.error ?? "Erro." }); }
  };

  const inp = "w-full px-3 py-2 rounded-lg text-sm outline-none";
  const inpStyle = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" };

  if (loading) return (
    <div className="p-6 flex items-center justify-center">
      <p style={{ color: "var(--text3)" }}>Carregando...</p>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>
          Painel Administrativo
        </h1>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "var(--gold)", color: "#000" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo usuário
        </button>
      </div>

      {msg && (
        <div className="text-sm px-4 py-3 rounded-xl"
          style={{
            background: msg.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${msg.type === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: msg.type === "ok" ? "#4ade80" : "#f87171",
          }}>
          {msg.text}
        </div>
      )}

      {/* Criar usuário */}
      {creating && (
        <div className="rounded-xl p-5 space-y-4"
          style={{ background: "var(--surface)", border: "1px solid var(--gold)" }}>
          <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Novo usuário</h3>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Nome" value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))}
              className={inp} style={inpStyle} />
            <input placeholder="E-mail / usuário" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
              className={inp} style={inpStyle} />
            <input placeholder="Senha" type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
              className={inp} style={inpStyle} />
            <div className="grid grid-cols-2 gap-2">
              <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value as Role }))}
                className={inp} style={inpStyle}>
                <option value="user">Usuário</option>
                <option value="admin">Admin</option>
              </select>
              <select value={newUser.plan} onChange={e => setNewUser(p => ({ ...p, plan: e.target.value as Plan }))}
                className={inp} style={inpStyle}>
                {PLANS.map(p => <option key={p} value={p}>{PLAN_FEATURES[p].label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createUser}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "var(--gold)", color: "#000" }}>Criar</button>
            <button onClick={() => setCreating(false)}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface2)", color: "var(--text3)" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Tabela de usuários */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
              {["Nome", "Usuário/E-mail", "Perfil", "Plano", "Escritório (tenantId)", "Ações"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold"
                  style={{ color: "var(--text3)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                {editingId === u.id ? (
                  <>
                    <td className="px-4 py-3">
                      <input value={editData.name ?? u.name}
                        onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                        className={inp} style={{ ...inpStyle, width: "120px" }} />
                    </td>
                    <td className="px-4 py-3">
                      <input value={editData.email ?? u.email}
                        onChange={e => setEditData(p => ({ ...p, email: e.target.value }))}
                        className={inp} style={{ ...inpStyle, width: "160px" }} />
                    </td>
                    <td className="px-4 py-3">
                      <select value={editData.role ?? u.role}
                        onChange={e => setEditData(p => ({ ...p, role: e.target.value as Role }))}
                        className={inp} style={{ ...inpStyle, width: "100px" }}>
                        <option value="user">Usuário</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select value={editData.plan ?? u.plan}
                        onChange={e => setEditData(p => ({ ...p, plan: e.target.value as Plan }))}
                        className={inp} style={{ ...inpStyle, width: "100px" }}>
                        {PLANS.map(p => <option key={p} value={p}>{PLAN_FEATURES[p].label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={editData.tenantId ?? u.tenantId ?? ""}
                        onChange={e => setEditData(p => ({ ...p, tenantId: e.target.value || undefined }))}
                        placeholder="ex: t_1"
                        className={inp} style={{ ...inpStyle, width: "90px" }} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={saveEdit}
                          className="px-3 py-1 rounded-lg text-xs font-semibold"
                          style={{ background: "var(--gold)", color: "#000" }}>Salvar</button>
                        <button onClick={() => setEditingId(null)}
                          className="px-3 py-1 rounded-lg text-xs"
                          style={{ background: "var(--surface2)", color: "var(--text3)" }}>✕</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--text)" }}>{u.name}</td>
                    <td className="px-4 py-3" style={{ color: "var(--text2)" }}>{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: u.role === "admin" ? "rgba(201,168,76,0.15)" : "var(--surface2)",
                          color: u.role === "admin" ? "var(--gold)" : "var(--text3)",
                        }}>
                        {u.role === "admin" ? "Admin" : "Usuário"}
                      </span>
                    </td>
                    <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono" style={{ color: u.tenantId ? "var(--gold)" : "var(--text3)" }}>
                        {u.tenantId ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingId(u.id); setEditData({}); }}
                          className="px-3 py-1 rounded-lg text-xs"
                          style={{ background: "var(--surface2)", color: "var(--text2)" }}>Editar</button>
                        {u.id !== session?.user.id && (
                          <button onClick={() => deleteUser(u.id, u.name)}
                            className="px-3 py-1 rounded-lg text-xs"
                            style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>Excluir</button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tabela de permissões por plano */}
      <div className="rounded-xl p-5 space-y-3"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Permissões por plano</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="py-2 px-3 text-left" style={{ color: "var(--text3)" }}>Recurso</th>
                {PLANS.map(p => (
                  <th key={p} className="py-2 px-3 text-center" style={{ color: "var(--text3)" }}>
                    {PLAN_FEATURES[p].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Controle Processual", key: "controle" },
                { label: "Financeiro", key: "financeiro" },
                { label: "Calculadora", key: "calculadora" },
                { label: "Admin", key: "admin" },
                { label: "Export PDF", key: "export_pdf" },
                { label: "Export Word", key: "export_word" },
                { label: "Export Excel", key: "export_excel" },
                { label: "Designar tarefas", key: "assign" },
              ].map(row => (
                <tr key={row.key} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2 px-3" style={{ color: "var(--text2)" }}>{row.label}</td>
                  {PLANS.map(p => {
                    const f = PLAN_FEATURES[p];
                    let has = false;
                    if (row.key === "assign") has = f.canAssignTasks;
                    else if (row.key.startsWith("export_")) has = f.exports.includes(row.key.replace("export_", ""));
                    else has = f.modules.includes(row.key);
                    return (
                      <td key={p} className="py-2 px-3 text-center">
                        {has ? (
                          <span style={{ color: "#4ade80" }}>✓</span>
                        ) : (
                          <span style={{ color: "var(--text3)" }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
