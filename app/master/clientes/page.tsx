"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  plan: string;
  subscriptionStatus: string;
  trialEndsAt?: string;
  isActive: boolean;
  createdAt: string;
  company?: { name?: string };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "#4ade80" },
  trial: { label: "Trial", color: "var(--gold)" },
  expired: { label: "Expirado", color: "#f87171" },
  cancelled: { label: "Cancelado", color: "#f87171" },
  pending: { label: "Pendente", color: "#facc15" },
};

const PLAN_LABELS: Record<string, string> = {
  admin: "Admin", profissional: "Profissional", pro: "Pro", basic: "Básico",
};

export default function MasterClientesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm" style={{ color: "var(--text3)" }}>Carregando...</div>}>
      <MasterClientesContent />
    </Suspense>
  );
}

function MasterClientesContent() {
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(searchParams.get("status") ?? "all");
  const [selected, setSelected] = useState<Client | null>(null);
  const [editData, setEditData] = useState<Partial<Client & { trialDays: number }>>({});
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/master/usuarios");
    if (res.ok) {
      const all: Client[] = await res.json();
      setClients(all.filter(u => (u as { plan?: string }).plan !== "admin" || (u as { role?: string }).role !== "admin"));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = clients.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || c.subscriptionStatus === filter;
    return matchSearch && matchFilter;
  });

  const saveClient = async () => {
    if (!selected) return;
    const res = await fetch(`/api/usuarios/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    });
    if (res.ok) { setMsg({ type: "ok", text: "Atualizado." }); setSelected(null); load(); }
    else setMsg({ type: "err", text: "Erro ao atualizar." });
  };

  const extendTrial = async (client: Client, days: number) => {
    const newEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const res = await fetch(`/api/usuarios/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trialEndsAt: newEnd, subscriptionStatus: "trial" }),
    });
    if (res.ok) { setMsg({ type: "ok", text: `Trial estendido por ${days} dias.` }); load(); }
  };

  const toggleAccess = async (client: Client) => {
    const res = await fetch(`/api/usuarios/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !client.isActive }),
    });
    if (res.ok) { setMsg({ type: "ok", text: client.isActive ? "Acesso bloqueado." : "Acesso liberado." }); load(); }
  };

  const deleteClient = async (id: string) => {
    if (!confirm("Excluir esta conta permanentemente?")) return;
    const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
    if (res.ok) { setMsg({ type: "ok", text: "Conta excluída." }); load(); }
  };

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--text3)" }}>Carregando...</div>;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--gold)" }}>Painel Master</p>
        <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>Gestão de Clientes</h1>
      </div>

      {msg && (
        <div className="mb-4 text-sm px-4 py-2.5 rounded-lg"
          style={{
            background: msg.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${msg.type === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: msg.type === "ok" ? "#4ade80" : "#f87171",
          }}>
          {msg.text}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="px-4 py-2 rounded-xl text-sm outline-none flex-1 min-w-48"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
          onFocus={e => (e.target.style.borderColor = "var(--gold)")}
          onBlur={e => (e.target.style.borderColor = "var(--border)")} />
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="px-4 py-2 rounded-xl text-sm outline-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="trial">Trial</option>
          <option value="expired">Expirados</option>
          <option value="cancelled">Cancelados</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                {["Nome", "E-mail", "Empresa", "Plano", "Status", "Cadastro", "Ações"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text3)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const s = STATUS_LABELS[c.subscriptionStatus] ?? STATUS_LABELS.active;
                return (
                  <tr key={c.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: "var(--text)" }}>
                      {c.name}
                      {!c.isActive && <span className="ml-1 text-xs" style={{ color: "#f87171" }}>• Bloqueado</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text2)" }}>{c.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text3)" }}>{c.company?.name ?? "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(201,168,76,0.1)", color: "var(--gold)" }}>
                        {PLAN_LABELS[c.plan] ?? c.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${s.color}22`, color: s.color }}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text3)" }}>
                      {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setSelected(c); setEditData({}); }}
                          className="px-2 py-1 rounded text-xs" style={{ background: "var(--surface2)", color: "var(--text3)" }}>
                          Editar
                        </button>
                        {c.subscriptionStatus === "trial" && (
                          <button onClick={() => extendTrial(c, 4)}
                            className="px-2 py-1 rounded text-xs" style={{ background: "rgba(201,168,76,0.15)", color: "var(--gold)" }}>
                            +4d
                          </button>
                        )}
                        <button onClick={() => toggleAccess(c)}
                          className="px-2 py-1 rounded text-xs"
                          style={{ background: c.isActive ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)", color: c.isActive ? "#f87171" : "#4ade80" }}>
                          {c.isActive ? "Bloquear" : "Liberar"}
                        </button>
                        <button onClick={() => deleteClient(c.id)}
                          className="p-1 rounded transition-colors hover:bg-red-500/10" style={{ color: "#f87171" }}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm" style={{ color: "var(--text3)" }}>Nenhum cliente encontrado.</div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {selected && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: "var(--text)" }}>Editar: {selected.name}</h2>
              <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-white/10" style={{ color: "var(--text3)" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Plano</label>
                <select value={(editData.plan as string) ?? selected.plan}
                  onChange={e => setEditData({ ...editData, plan: e.target.value as typeof selected.plan })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                  <option value="basic">Básico</option>
                  <option value="pro">Pro</option>
                  <option value="profissional">Profissional</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Status</label>
                <select value={(editData.subscriptionStatus as string) ?? selected.subscriptionStatus}
                  onChange={e => setEditData({ ...editData, subscriptionStatus: e.target.value as typeof selected.subscriptionStatus })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                  <option value="active">Ativo</option>
                  <option value="trial">Trial</option>
                  <option value="expired">Expirado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveClient} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--gold)", color: "#000" }}>Salvar</button>
              <button onClick={() => setSelected(null)} className="px-4 py-2 rounded-lg text-sm" style={{ background: "var(--surface2)", color: "var(--text3)" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
