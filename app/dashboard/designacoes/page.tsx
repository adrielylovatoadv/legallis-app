"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  getProcessos, getIniciais, updateProcesso, marcarOk, createProcesso,
  fmtData, badgeAndamento, gcalUrl, normalizeData,
  ANDAMENTOS_PROCESSO,
  type Processo, type Inicial,
} from "@/lib/controle";
import { Card, MetricCard, Input as Inp, FieldLabel as Lbl } from "@/components/ui";

// ── Modal cadastrar processo a partir de inicial ─────────────────────────────
function ModalCadastroProcesso({ initialData, onClose, onSaved, responsaveis = [] }: {
  initialData: { autor: string; reu: string; objeto: string };
  onClose: () => void;
  onSaved: () => void;
  responsaveis?: string[];
}) {
  const [form, setForm] = useState({
    autor: initialData.autor,
    reu: initialData.reu,
    objeto: initialData.objeto,
    numero_processo: "",
    data: "",
    hora: "",
    andamento: "AGUARDANDO DESPACHO",
    responsavel: "",
    observacoes: "",
    atencao: false,
    finalizado: false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.autor.trim()) return;
    setSaving(true);
    try {
      await createProcesso(form as Omit<Processo, "id" | "criado_em">);
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 overflow-y-auto max-h-[90vh]"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold" style={{ color: "var(--text)" }}>Cadastrar Processo</h2>
          <button onClick={onClose} style={{ color: "var(--text3)" }}>✕</button>
        </div>
        <p className="text-xs" style={{ color: "var(--text3)" }}>A petição inicial foi concluída. Cadastre o processo para acompanhamento.</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Lbl>Autor *</Lbl><Inp value={form.autor} onChange={e => set("autor", e.target.value)} /></div>
          <div><Lbl>Réu</Lbl><Inp value={form.reu} onChange={e => set("reu", e.target.value)} /></div>
          <div><Lbl>Objeto</Lbl><Inp value={form.objeto} onChange={e => set("objeto", e.target.value)} /></div>
          <div><Lbl>Nº Processo</Lbl><Inp value={form.numero_processo} onChange={e => set("numero_processo", e.target.value)} /></div>
          <div>
            <Lbl>Andamento</Lbl>
            <select value={form.andamento} onChange={e => set("andamento", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
              <option value="">Selecionar</option>
              {ANDAMENTOS_PROCESSO.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <Lbl>Responsável</Lbl>
            <select value={form.responsavel} onChange={e => set("responsavel", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
              <option value="">—</option>
              {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <Lbl>Observações</Lbl>
            <textarea rows={2} value={form.observacoes} onChange={e => set("observacoes", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={save} disabled={saving || !form.autor.trim()}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: "var(--gold)", color: "#000", opacity: (!form.autor.trim() || saving) ? 0.5 : 1 }}>
            {saving ? "Salvando..." : "Cadastrar Processo"}
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm"
            style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>
            Pular
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal edição rápida ─────────────────────────────────────────
function ModalEditar({ p, onClose, onSaved }: { p: Processo; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ ...p });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Processo, v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }));
  const save = async () => {
    setSaving(true);
    try { await updateProcesso(p.id, form); onSaved(); } finally { setSaving(false); }
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
          {(["andamento","data","hora","observacoes"] as const).map(k => (
            <div key={k} className={k === "observacoes" ? "col-span-2" : ""}>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>{k}</label>
              {k === "andamento" ? (
                <select value={form.andamento} onChange={e => set("andamento", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                  <option value="">Selecionar</option>
                  {ANDAMENTOS_PROCESSO.map(a => <option key={a}>{a}</option>)}
                </select>
              ) : k === "observacoes" ? (
                <textarea rows={2} value={form.observacoes || ""} onChange={e => set("observacoes", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
              ) : (
                <input type={k === "data" ? "date" : "text"} value={(form[k] as string) || ""} onChange={e => set(k, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
              )}
            </div>
          ))}
        </div>
        <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: "var(--gold)", color: "#000" }}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

export default function DesignacoesPage() {
  const { data: session } = useSession();
  const userName = session?.user?.name || "";

  const [processos, setProcessos] = useState<Processo[]>([]);
  const [iniciais, setIniciais] = useState<Inicial[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroData, setFiltroData] = useState("");
  const [editando, setEditando] = useState<Processo | null>(null);
  const [responsavelFiltro, setResponsavelFiltro] = useState(userName);
  const [redesignando, setRedesignando] = useState<{ tipo: "processo"|"inicial"; id: string; label: string } | null>(null);
  const [motivoRedesign, setMotivoRedesign] = useState("");
  const [adminDestinoId, setAdminDestinoId] = useState("");
  const [admins, setAdmins] = useState<{ id: string; name: string }[]>([]);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [cadastroProcesso, setCadastroProcesso] = useState<{ autor: string; reu: string; objeto: string } | null>(null);
  const [pendentesRecebidas, setPendentesRecebidas] = useState<{
    id: string; tipo: "processo"|"inicial"; label: string; deUserName: string; motivo: string;
  }[]>([]);
  // Snapshot de "agora" só na montagem — Date.now() direto no corpo do componente é impuro.
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, i] = await Promise.all([getProcessos(), getIniciais()]);
      setProcessos(p);
      setIniciais(i);
    } finally { setLoading(false); }
  }, []);

  const loadPendentes = useCallback(async () => {
    try {
      const res = await fetch("/api/designacoes");
      if (res.ok) {
        const json = await res.json();
        setPendentesRecebidas(json.recebidas || []);
      }
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPendentes(); }, [loadPendentes]);
  useEffect(() => { if (userName) setResponsavelFiltro(userName); }, [userName]);
  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then((users: { id: string; name: string }[]) => {
      setAdmins(users);
      if (users.length > 0) setAdminDestinoId(users[0].id);
    }).catch(() => {});
  }, []);

  const hoje = new Date(now).toISOString().split("T")[0];
  const em3Dias = new Date(now + 3 * 86400000).toISOString().split("T")[0];

  const isFinalizado = (p: Processo) => {
    if (p.finalizado) return true;
    const a = (p.andamento || "").toUpperCase();
    return a === "ACORDO" || a === "ARQUIVADO" || a.startsWith("DESISTÊN") || a.startsWith("DESISTEN") || a === "IMPROCEDENTE";
  };

  const meusProcessos = processos.filter(p => {
    if (!p.responsavel) return false;
    const match = responsavelFiltro
      ? p.responsavel.toLowerCase().includes(responsavelFiltro.toLowerCase())
      : true;
    if (!match) return false;
    if (filtroStatus === "ativos") return !isFinalizado(p);
    if (filtroStatus === "finalizados") return isFinalizado(p);
    if (filtroStatus === "audiencias") {
      const a = (p.andamento || "").toUpperCase();
      return (a.includes("AIJ") || a.startsWith("AC")) && !!p.data && !isFinalizado(p);
    }
    return true;
  });

  const CONCLUIDOS_INICIAL = ["PROTOCOLADO", "ARQUIVADO"];
  const minhasIniciais = iniciais.filter(i => {
    if (!i.responsavel) return false;
    if (CONCLUIDOS_INICIAL.includes((i.andamento || "").toUpperCase().trim())) return false;
    return responsavelFiltro
      ? i.responsavel.toLowerCase().includes(responsavelFiltro.toLowerCase())
      : true;
  });

  const prazosHoje = meusProcessos.filter(p => normalizeData(p.data) === hoje && !isFinalizado(p));
  const prazos3d = meusProcessos.filter(p => { const d = normalizeData(p.data); return d > hoje && d <= em3Dias && !isFinalizado(p); });
  const audiencias = meusProcessos.filter(p => {
    const a = (p.andamento || "").toUpperCase();
    return (a.includes("AIJ") || a.startsWith("AC")) && !!p.data && !isFinalizado(p);
  });

  const filtradosFiltroData = meusProcessos.filter(p =>
    filtroData ? normalizeData(p.data) === filtroData : true
  );

  const handleOk = async (id: string) => { await marcarOk(id); load(); };

  const handleConcluir = async (tipo: "processo"|"inicial", id: string) => {
    const res = await fetch("/api/designacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "concluir", tipo, id }),
    });
    if (res.ok) {
      const json = await res.json();
      setActionMsg("Tarefa concluída! Status: AGUARDANDO DESPACHO.");
      load();
      setTimeout(() => setActionMsg(null), 4000);
      if (json.openCadastro && json.initialData) {
        setCadastroProcesso(json.initialData);
      }
    }
  };

  const handleRedesignacao = async () => {
    if (!redesignando || !motivoRedesign.trim() || !adminDestinoId) return;
    const res = await fetch("/api/designacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "redesignacao", tipo: redesignando.tipo, id: redesignando.id, motivo: motivoRedesign, adminId: adminDestinoId }),
    });
    if (res.ok) {
      const admin = admins.find(a => a.id === adminDestinoId);
      setActionMsg(`Solicitação enviada para ${admin?.name || "administrador"}!`);
      setRedesignando(null);
      setMotivoRedesign("");
      setTimeout(() => setActionMsg(null), 4000);
    }
  };

  const handleResponderRedesignacao = async (redesignacaoId: string, aceitar: boolean) => {
    const res = await fetch("/api/designacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "responder_redesignacao", redesignacaoId, aceitar }),
    });
    if (res.ok) {
      setActionMsg(aceitar ? "Redesignação aceita — prazo transferido para você." : "Solicitação recusada.");
      loadPendentes();
      load();
      setTimeout(() => setActionMsg(null), 4000);
    }
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-64">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "var(--gold)", borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {editando && (
        <ModalEditar p={editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); load(); }} />
      )}

      {cadastroProcesso && (
        <ModalCadastroProcesso
          initialData={cadastroProcesso}
          onClose={() => setCadastroProcesso(null)}
          responsaveis={admins.map(u => u.name)}
          onSaved={() => { setCadastroProcesso(null); setActionMsg("Processo cadastrado com sucesso!"); load(); setTimeout(() => setActionMsg(null), 3000); }}
        />
      )}

      {/* Modal redesignação */}
      {redesignando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Solicitar Redesignação</h2>
              <button onClick={() => { setRedesignando(null); setMotivoRedesign(""); }} style={{ color: "var(--text3)" }}>✕</button>
            </div>
            <p className="text-sm" style={{ color: "var(--text2)" }}><strong>{redesignando.label}</strong></p>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Enviar para *</label>
              <select value={adminDestinoId} onChange={e => setAdminDestinoId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Motivo da redesignação *</label>
              <textarea rows={3} value={motivoRedesign} onChange={e => setMotivoRedesign(e.target.value)}
                placeholder="Descreva o motivo..."
                className="w-full px-3 py-2 rounded-lg text-sm resize-none outline-none"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
            <div className="flex gap-3">
              <button onClick={handleRedesignacao} disabled={!motivoRedesign.trim() || !adminDestinoId}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm"
                style={{ background: "var(--gold)", color: "#000", opacity: (motivoRedesign.trim() && adminDestinoId) ? 1 : 0.5 }}>
                Enviar Solicitação
              </button>
              <button onClick={() => { setRedesignando(null); setMotivoRedesign(""); }}
                className="px-4 py-2.5 rounded-xl text-sm"
                style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {actionMsg && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg"
          style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" }}>
          ✓ {actionMsg}
        </div>
      )}

      {/* Solicitações de redesignação recebidas */}
      {pendentesRecebidas.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-3" style={{ color: "#facc15" }}>📨 Solicitações de Redesignação para você ({pendentesRecebidas.length})</h2>
          <div className="space-y-2">
            {pendentesRecebidas.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg flex-wrap"
                style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.25)" }}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm" style={{ color: "var(--text)" }}>{r.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
                    {r.deUserName} pede redesignação — {r.motivo}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleResponderRedesignacao(r.id, true)}
                    className="text-xs px-3 py-1.5 rounded font-semibold"
                    style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>Aceitar</button>
                  <button onClick={() => handleResponderRedesignacao(r.id, false)}
                    className="text-xs px-3 py-1.5 rounded"
                    style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>Recusar</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>Minhas Designações</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text3)" }}>Processos e tarefas atribuídas a você</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={responsavelFiltro} onChange={e => setResponsavelFiltro(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
            <option value="">Todos</option>
            {admins.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
          </select>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
            <option value="todos">Todos os status</option>
            <option value="ativos">Ativos</option>
            <option value="audiencias">Audiências</option>
            <option value="finalizados">Finalizados</option>
          </select>
          <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
          {filtroData && (
            <button onClick={() => setFiltroData("")} className="px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border)" }}>✕</button>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard value={meusProcessos.filter(p => !isFinalizado(p)).length} label="Processos ativos" color="#C9A84C" />
        <MetricCard value={prazosHoje.length} label="Prazos hoje" color="#ef4444" />
        <MetricCard value={prazos3d.length} label="Próximos 3 dias" color="#f97316" />
        <MetricCard value={minhasIniciais.length} label="Iniciais designadas" color="#22c55e" />
      </div>

      {/* Prazos hoje */}
      {prazosHoje.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-3" style={{ color: "#ef4444" }}>🔴 Prazos Hoje</h2>
          <div className="space-y-2">
            {prazosHoje.sort((a, b) => (a.hora || "").localeCompare(b.hora || "")).map(p => (
              <ProcessoRow key={p.id} p={p} onOk={handleOk} onEdit={setEditando} onConcluir={handleConcluir} onRedesignacao={setRedesignando} />
            ))}
          </div>
        </Card>
      )}

      {/* Audiências */}
      {audiencias.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-3" style={{ color: "#818cf8" }}>📅 Audiências</h2>
          <div className="space-y-2">
            {audiencias.sort((a, b) => (normalizeData(a.data) + (a.hora || "")).localeCompare(normalizeData(b.data) + (b.hora || ""))).map(p => (
              <ProcessoRow key={p.id} p={p} onOk={handleOk} onEdit={setEditando} showDate onConcluir={handleConcluir} onRedesignacao={setRedesignando} />
            ))}
          </div>
        </Card>
      )}

      {/* Todos os processos filtrados */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold" style={{ color: "var(--text)" }}>
            ⚖️ Processos designados
            <span className="ml-2 text-sm font-normal" style={{ color: "var(--text3)" }}>
              ({filtradosFiltroData.length})
            </span>
          </h2>
        </div>
        {filtradosFiltroData.length === 0
          ? <p className="text-sm py-4 text-center" style={{ color: "var(--text3)" }}>Nenhum processo encontrado.</p>
          : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filtradosFiltroData.sort((a, b) => (normalizeData(a.data) || "9999").localeCompare(normalizeData(b.data) || "9999")).map(p => (
                <ProcessoRow key={p.id} p={p} onOk={handleOk} onEdit={setEditando} showDate onConcluir={handleConcluir} onRedesignacao={setRedesignando} />
              ))}
            </div>
          )
        }
      </Card>

      {/* Iniciais designadas */}
      {minhasIniciais.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-3" style={{ color: "var(--text)" }}>📝 Iniciais designadas ({minhasIniciais.length})</h2>
          <div className="space-y-2">
            {minhasIniciais.map(i => (
              <div key={i.id} className="flex items-center gap-3 px-4 py-3 rounded-lg"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" style={{ color: "var(--text)" }}>{i.cliente}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
                    {[i.reu, i.objeto].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${badgeAndamento(i.andamento)}`}>{i.andamento}</span>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => handleConcluir("inicial", i.id)}
                    className="text-xs px-2 py-1 rounded font-semibold"
                    style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}>Concluir</button>
                  <button onClick={() => setRedesignando({ tipo: "inicial", id: i.id, label: `${i.cliente} × ${i.reu}` })}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>Redesignar</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ProcessoRow({ p, onOk, onEdit, showDate = false, onConcluir, onRedesignacao }: {
  p: Processo; onOk: (id: string) => void; onEdit: (p: Processo) => void; showDate?: boolean;
  onConcluir?: (tipo: "processo"|"inicial", id: string) => void;
  onRedesignacao?: (r: { tipo: "processo"|"inicial"; id: string; label: string }) => void;
}) {
  const url = gcalUrl(p);
  const isAud = (p.andamento || "").toUpperCase().includes("AIJ") || (p.andamento || "").toUpperCase().startsWith("AC");
  return (
    <div className="rounded-lg p-3"
      style={{
        background: p.atencao ? "rgba(239,68,68,0.06)" : "var(--surface2)",
        borderLeft: `3px solid ${isAud ? "#818cf8" : p.atencao ? "#ef4444" : "var(--border)"}`,
        border: "1px solid var(--border)",
      }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate" style={{ color: "var(--text)" }}>
            {p.atencao && "🚨 "}{p.autor} <span style={{ color: "var(--text3)" }}>×</span> {p.reu}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
            {p.objeto && <span>{p.objeto} · </span>}
            <span className={`font-medium ${badgeAndamento(p.andamento)}`}>{p.andamento}</span>
            {showDate && p.data && <span className="ml-2" style={{ color: "var(--gold)" }}>{fmtData(p.data)}{p.hora && ` ${p.hora}`}</span>}
          </p>
          {p.numero_processo && (
            <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: "var(--text2)" }}>
              <span className="font-mono select-all">{p.numero_processo}</span>
              <button
                onClick={() => navigator.clipboard.writeText(p.numero_processo)}
                title="Copiar número do processo"
                className="text-xs px-1 rounded hover:opacity-80"
                style={{ color: "var(--text3)", background: "var(--surface)", border: "1px solid var(--border)" }}
              >⎘</button>
            </p>
          )}
        </div>
        <div className="flex gap-1 shrink-0 flex-wrap justify-end">
          <button onClick={() => onOk(p.id)} title="Marcar OK"
            className="text-xs px-2 py-1 rounded"
            style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80" }}>OK</button>
          {onConcluir && (
            <button onClick={() => onConcluir("processo", p.id)}
              className="text-xs px-2 py-1 rounded font-semibold"
              style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>Concluir</button>
          )}
          {onRedesignacao && (
            <button onClick={() => onRedesignacao({ tipo: "processo", id: p.id, label: `${p.autor} × ${p.reu}` })}
              className="text-xs px-2 py-1 rounded"
              style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>Redesignar</button>
          )}
          <button onClick={() => onEdit(p)}
            className="text-xs px-2 py-1 rounded"
            style={{ background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border)" }}>✏️</button>
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
