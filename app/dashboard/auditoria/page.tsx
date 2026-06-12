"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface AuditEvent {
  id: string;
  tipo: string;
  descricao: string;
  usuario: string;
  usuarioId: string;
  data: string;
  hora: string;
  detalhe?: string;
}

const TIPO_COLORS: Record<string, string> = {
  "Conclusão de Tarefa": "#4ade80",
  "Redesignação": "#facc15",
  "Protocolo": "#60a5fa",
  "Prazo Concluído": "#a78bfa",
  "Financeiro": "#fb923c",
  "Sócios": "#f472b6",
};

function tipoBadge(tipo: string) {
  const color = TIPO_COLORS[tipo] || "var(--text3)";
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
      {tipo}
    </span>
  );
}

export default function AuditoriaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("Todos");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || session?.user?.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/audit");
      if (res.ok) setEvents(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (status === "loading" || session?.user?.role !== "admin") {
    return null;
  }

  const tipos = ["Todos", ...Array.from(new Set(events.map(e => e.tipo)))];

  const filtered = events.filter(e => {
    const matchTipo = filtroTipo === "Todos" || e.tipo === filtroTipo;
    const matchBusca = !busca || [e.descricao, e.usuario, e.tipo, e.detalhe].some(v => v?.toLowerCase().includes(busca.toLowerCase()));
    return matchTipo && matchBusca;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>Log de Auditoria</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text3)" }}>Histórico completo de ações do sistema</p>
        </div>
        <button onClick={load} className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>
          Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..."
          className="px-3 py-2 rounded-lg text-sm outline-none w-64"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
          {tipos.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total de eventos", val: events.length, color: "var(--gold)" },
          { label: "Hoje", val: events.filter(e => e.data === new Date().toLocaleDateString("pt-BR")).length, color: "#4ade80" },
          { label: "Esta semana", val: events.filter(e => {
            const [d, m, y] = e.data.split("/").map(Number);
            const dt = new Date(y, m - 1, d);
            const now = new Date();
            const diff = (now.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24);
            return diff >= 0 && diff <= 7;
          }).length, color: "#60a5fa" },
          { label: "Filtrado", val: filtered.length, color: "var(--text2)" },
        ].map(m => (
          <div key={m.label} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="text-2xl font-bold tabular-nums" style={{ color: m.color }}>{m.val}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{m.label}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="py-12 text-center" style={{ color: "var(--text3)" }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center" style={{ color: "var(--text3)" }}>Nenhum evento encontrado</div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                  {["Data","Hora","Tipo","Descrição","Usuário","Detalhe"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "var(--text3)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs" style={{ color: "var(--text2)" }}>{e.data}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs" style={{ color: "var(--text3)" }}>{e.hora}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{tipoBadge(e.tipo)}</td>
                    <td className="px-4 py-3 max-w-sm" style={{ color: "var(--text)" }}>{e.descricao}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-medium" style={{ color: "var(--gold)" }}>{e.usuario}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text3)" }}>{e.detalhe || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
