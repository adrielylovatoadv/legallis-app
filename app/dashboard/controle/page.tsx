"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  getDashboard, marcarOk, fmtData, gcalUrl, badgeAndamento, normalizeData,
  ANDAMENTOS_PROCESSO, updateProcesso,
  type DashboardData, type Processo,
} from "@/lib/controle";
import { ProcessosTab } from "./_processos";
import { IniciaisTab } from "./_iniciais";
import { ClientesTab } from "./_clientes";
import { FinalizadosTab } from "./_finalizados";
import { Card, MetricCard as MetricCardBase } from "@/components/ui";
import { hasControleRestrito } from "@/lib/acl";

function MetricCard({ value, label, color }: { value: number; label: string; color: string }) {
  return <MetricCardBase value={value} label={label} color={color} size="lg" align="center" />;
}

function ProcessoCard({ p, onOk, onEdit }: {
  p: Processo; onOk: (id: string) => void; onEdit: (p: Processo) => void;
}) {
  const url = gcalUrl(p);
  const isAud = (p.andamento || "").toUpperCase().includes("AIJ") ||
    (p.andamento || "").toUpperCase().includes("AUDIÊNCIA");
  return (
    <div className="rounded-lg p-3 mb-2"
      style={{
        background: p.atencao ? "rgba(239,68,68,0.06)" : "var(--surface2)",
        borderLeft: `3px solid ${isAud ? "#ef4444" : p.atencao ? "#ef4444" : "var(--border)"}`,
        border: "1px solid var(--border)",
      }}>
      {/* Andamento em destaque no topo */}
      {p.andamento && (
        <div className="mb-1.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeAndamento(p.andamento)}`}>
            {p.andamento}
          </span>
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate" style={{ color: "var(--text)" }}>
            {p.autor} <span style={{ color: "var(--text3)" }}>×</span> {p.reu}
            {p.hora && <span className="ml-1 text-xs" style={{ color: "var(--text3)" }}>· {p.hora}</span>}
          </p>
          {p.responsavel && (
            <p className="text-xs mt-0.5 font-semibold" style={{ color: "var(--gold)" }}>
              👤 {p.responsavel}
            </p>
          )}
          {p.numero_processo && (
            <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--text3)" }}>{p.numero_processo}</p>
          )}
          {p.objeto && (
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text3)", opacity: 0.7 }}>{p.objeto}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onOk(p.id)}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80" }}>
            OK
          </button>
          <button onClick={() => onEdit(p)}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{ background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border)" }}>
            ✏️
          </button>
        </div>
      </div>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded"
          style={{ background: "rgba(26,115,232,0.15)", color: "#60a5fa" }}>
          📅 Google Calendar
        </a>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>{label}</label>
      <input value={value || ""} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
    </div>
  );
}

function ModalEditar({ p, onClose, onSaved }: {
  p: Processo; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...p });
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/users").then(r => r.ok ? r.json() : [])
      .then((list: { name: string }[]) => setUsers(list.map(u => u.name)));
  }, []);

  const set = (k: keyof Processo, v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await updateProcesso(p.id, form);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold" style={{ color: "var(--text)" }}>Editar processo</h2>
          <button onClick={onClose} style={{ color: "var(--text3)" }}>✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Autor" value={form.autor} onChange={v => set("autor", v)} />
          <Field label="Réu" value={form.reu} onChange={v => set("reu", v)} />
          <Field label="Objeto" value={form.objeto} onChange={v => set("objeto", v)} />
          <Field label="Nº Processo" value={form.numero_processo} onChange={v => set("numero_processo", v)} />
          <Field label="Data (YYYY-MM-DD)" value={form.data} onChange={v => set("data", v)} />
          <Field label="Hora" value={form.hora} onChange={v => set("hora", v)} />
          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Andamento</label>
            <select value={form.andamento} onChange={e => set("andamento", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
              <option value="">Selecionar</option>
              {ANDAMENTOS_PROCESSO.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Responsável</label>
            <select value={form.responsavel} onChange={e => set("responsavel", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
              <option value="">—</option>
              {users.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Observações</label>
          <textarea rows={2} value={form.observacoes} onChange={e => set("observacoes", e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!form.atencao} onChange={e => set("atencao", e.target.checked)}
            className="accent-red-500" />
          <span className="text-sm" style={{ color: "var(--text2)" }}>🚨 Atenção / Risco</span>
        </label>
        <button onClick={save} disabled={saving}
          className="w-full py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: "var(--gold)", color: "#000" }}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

// ── Visão Geral ────────────────────────────────────────────────────────────────
function VisaoGeral() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Processo | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try { setData(await getDashboard()); } finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleOk = async (id: string) => {
    await marcarOk(id);
    load(true);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "var(--gold)", borderTopColor: "transparent" }} />
    </div>
  );

  if (!data) return <div style={{ color: "var(--text3)" }}>Erro ao carregar dados.</div>;

  const audiencias_hoje = data.prazos_hoje.filter(p =>
    (p.andamento || "").toUpperCase().includes("AIJ") || (p.andamento || "").toUpperCase().includes("AUDIÊNCIA"));
  const outros_hoje = data.prazos_hoje.filter(p => !audiencias_hoje.includes(p));
  const audiencias_3d = data.prazos_3dias.filter(p =>
    (p.andamento || "").toUpperCase().includes("AIJ") || (p.andamento || "").toUpperCase().includes("AUDIÊNCIA"));
  const outros_3d = data.prazos_3dias.filter(p => !audiencias_3d.includes(p));

  return (
    <div className="space-y-6">
      {editing && (
        <ModalEditar p={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(true); }} />
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard value={data.prazos_hoje.length} label="Prazos Hoje" color="#f97316" />
        <MetricCard value={data.prazos_3dias.length} label="Alertas — Próx. 3 dias" color="#ef4444" />
        <MetricCard value={data.iniciais_pendentes.length} label="Iniciais Pendentes" color="#C9A84C" />
        <MetricCard value={data.total_clientes} label="Clientes Cadastrados" color="#22c55e" />
      </div>

      {/* Cards de prazos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Audiências */}
        <Card>
          <h2 className="font-semibold mb-3" style={{ color: "#ef4444" }}>🔴 Audiências</h2>
          {audiencias_hoje.length > 0 && (
            <>
              <p className="text-xs mb-2 font-medium uppercase tracking-wider" style={{ color: "var(--text3)" }}>Hoje</p>
              {audiencias_hoje.sort((a, b) => (a.hora || "").localeCompare(b.hora || "")).map(p => (
                <ProcessoCard key={p.id} p={p} onOk={handleOk} onEdit={setEditing} />
              ))}
            </>
          )}
          {audiencias_3d.length > 0 && (
            <>
              <p className="text-xs mb-2 mt-3 font-medium uppercase tracking-wider" style={{ color: "var(--text3)" }}>Próximos 3 dias</p>
              {audiencias_3d.sort((a, b) => (normalizeData(a.data) + a.hora).localeCompare(normalizeData(b.data) + b.hora)).map(p => (
                <div key={p.id}>
                  <span className="text-xs font-medium" style={{ color: "var(--gold)" }}>{fmtData(p.data)} </span>
                  <ProcessoCard p={p} onOk={handleOk} onEdit={setEditing} />
                </div>
              ))}
            </>
          )}
          {audiencias_hoje.length === 0 && audiencias_3d.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-2xl mb-1">📅</p>
              <p className="text-sm font-medium" style={{ color: "var(--text2)" }}>Sem audiências nos próximos dias</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>Bom momento para focar nas iniciais pendentes.</p>
            </div>
          )}
        </Card>

        {/* Outros Prazos */}
        <Card>
          <h2 className="font-semibold mb-3" style={{ color: "var(--gold)" }}>📋 Outros Prazos</h2>
          {outros_hoje.length > 0 && (
            <>
              <p className="text-xs mb-2 font-medium uppercase tracking-wider" style={{ color: "var(--text3)" }}>Hoje</p>
              {outros_hoje.map(p => (
                <ProcessoCard key={p.id} p={p} onOk={handleOk} onEdit={setEditing} />
              ))}
            </>
          )}
          {outros_3d.length > 0 && (
            <>
              <p className="text-xs mb-2 mt-3 font-medium uppercase tracking-wider" style={{ color: "var(--text3)" }}>Próximos 3 dias</p>
              {outros_3d.sort((a, b) => (normalizeData(a.data) + a.hora).localeCompare(normalizeData(b.data) + b.hora)).map(p => (
                <div key={p.id}>
                  <span className="text-xs font-medium" style={{ color: "var(--gold)" }}>{fmtData(p.data)} </span>
                  <ProcessoCard p={p} onOk={handleOk} onEdit={setEditing} />
                </div>
              ))}
            </>
          )}
          {outros_hoje.length === 0 && outros_3d.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-2xl mb-1">✅</p>
              <p className="text-sm font-medium" style={{ color: "var(--text2)" }}>Nenhum prazo nos próximos dias</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>Agenda limpa por aqui.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Iniciais pendentes (resumo) */}
      {data.iniciais_pendentes.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>📝 Iniciais Pendentes</h2>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {data.iniciais_pendentes.slice(0, 10).map(i => (
              <div key={i.id} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{ background: "var(--surface2)" }}>
                <span className="text-xs font-medium flex-1 truncate" style={{ color: "var(--text)" }}>{i.cliente}</span>
                <span className="text-xs truncate" style={{ color: "var(--text3)" }}>{i.reu}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${badgeAndamento(i.andamento)}`}>{i.andamento}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
type Tab = "inicio" | "processos" | "iniciais" | "clientes" | "finalizados";

export default function ControlePage() {
  const { data: session } = useSession();
  const restrito = hasControleRestrito(session?.user?.cargo);
  const [tab, setTab] = useState<Tab>("inicio");
  const effectiveTab: Tab = restrito && tab !== "iniciais" && tab !== "clientes" ? "iniciais" : tab;

  const ALL_TABS = [
    { id: "inicio", label: "📊 Visão Geral" },
    { id: "processos", label: "⚖️ Processos" },
    { id: "iniciais", label: "📝 Iniciais" },
    { id: "clientes", label: "👥 Clientes" },
    { id: "finalizados", label: "✅ Finalizados" },
  ] as const;
  const TABS = restrito ? ALL_TABS.filter(t => t.id === "iniciais" || t.id === "clientes") : ALL_TABS;

  const tabStyle = (id: Tab) => ({
    background: effectiveTab === id ? "var(--gold)" : "var(--surface2)",
    color: effectiveTab === id ? "#1a1a1a" : "var(--text2)",
    border: "1px solid var(--border)",
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>Controle Processual</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text3)" }}>Direito do Consumidor · Cobranças Indevidas · Fraudes Bancárias</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={tabStyle(t.id as Tab)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {effectiveTab === "inicio" && <VisaoGeral />}
      {effectiveTab === "processos" && <ProcessosTab />}
      {effectiveTab === "iniciais" && <IniciaisTab />}
      {effectiveTab === "clientes" && <ClientesTab />}
      {effectiveTab === "finalizados" && <FinalizadosTab />}
    </div>
  );
}
