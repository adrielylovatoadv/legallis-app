"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { Ticket, TicketMessage } from "@/lib/suporte";

type View = "list" | "new" | "ticket";

const CATEGORIES = [
  { value: "duvida", label: "Dúvida" },
  { value: "bug", label: "Problema técnico" },
  { value: "financeiro", label: "Financeiro" },
  { value: "sugestao", label: "Sugestão" },
  { value: "outro", label: "Outro" },
];

const PRIORITIES = [
  { value: "baixa", label: "Baixa", color: "#4ade80" },
  { value: "media", label: "Média", color: "var(--gold)" },
  { value: "alta", label: "Alta", color: "#fb923c" },
  { value: "urgente", label: "Urgente", color: "#f87171" },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  aberto: { label: "Aberto", color: "#4ade80" },
  em_andamento: { label: "Em andamento", color: "var(--gold)" },
  resolvido: { label: "Resolvido", color: "#818cf8" },
  fechado: { label: "Fechado", color: "var(--text3)" },
};

export default function SuportePage() {
  const { data: session } = useSession();
  const [view, setView] = useState<View>("list");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  // New ticket form
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("duvida");
  const [priority, setPriority] = useState("media");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    const res = await fetch("/api/suporte/tickets");
    if (res.ok) setTickets(await res.json());
    setLoading(false);
  }, []);

  const loadTicket = useCallback(async (id: string) => {
    const res = await fetch(`/api/suporte/tickets/${id}`);
    if (res.ok) {
      const t = await res.json();
      setSelectedTicket(t);
    }
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  // SSE subscription for real-time messages
  useEffect(() => {
    if (view === "ticket" && selectedTicket) {
      if (sseRef.current) sseRef.current.close();
      const es = new EventSource(`/api/suporte/tickets/${selectedTicket.id}/stream`);
      sseRef.current = es;

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data) as { type: string; messages?: TicketMessage[]; status?: string };
          if (payload.type === "messages" && payload.messages?.length) {
            setSelectedTicket(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: [...prev.messages, ...payload.messages!],
                status: (payload.status as Ticket["status"]) ?? prev.status,
              };
            });
          }
        } catch { /* ignore parse errors */ }
      };

      return () => { es.close(); sseRef.current = null; };
    } else {
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    }
  }, [view, selectedTicket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedTicket?.messages]);

  const openTicket = async (t: Ticket) => {
    await loadTicket(t.id);
    setView("ticket");
  };

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setMsg(null);
    const res = await fetch("/api/suporte/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, category, priority, message }),
    });
    setSubmitting(false);
    if (res.ok) {
      const ticket = await res.json();
      setMsg({ type: "ok", text: "Chamado aberto com sucesso." });
      setSubject(""); setCategory("duvida"); setPriority("media"); setMessage("");
      await loadTickets();
      await loadTicket(ticket.id);
      setSelectedTicket(ticket);
      setView("ticket");
    } else {
      setMsg({ type: "err", text: "Erro ao abrir chamado." });
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim() || !selectedTicket) return;
    setSending(true);
    const res = await fetch(`/api/suporte/tickets/${selectedTicket.id}/mensagens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newMsg }),
    });
    setSending(false);
    if (res.ok) { setNewMsg(""); await loadTicket(selectedTicket.id); }
  };

  const inp = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors";
  const inpStyle = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" };

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--text3)" }}>Carregando...</div>;

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {(view === "new" || view === "ticket") && (
            <button onClick={() => { setView("list"); loadTickets(); }}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: "var(--text3)" }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>
              {view === "list" ? "Suporte" : view === "new" ? "Abrir Chamado" : selectedTicket?.subject}
            </h1>
            {view === "list" && (
              <p className="text-sm mt-0.5" style={{ color: "var(--text3)" }}>Central de atendimento</p>
            )}
          </div>
        </div>
        {view === "list" && (
          <button onClick={() => setView("new")}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--gold)", color: "#000" }}>
            + Abrir chamado
          </button>
        )}
      </div>

      {/* List View */}
      {view === "list" && (
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--text3)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className="font-medium" style={{ color: "var(--text2)" }}>Nenhum chamado ainda</p>
              <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>Abra um chamado para receber suporte</p>
              <button onClick={() => setView("new")} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--gold)", color: "#000" }}>
                Abrir primeiro chamado
              </button>
            </div>
          ) : (
            tickets.map(t => {
              const statusInfo = STATUS_LABELS[t.status] ?? STATUS_LABELS.aberto;
              const priorityInfo = PRIORITIES.find(p => p.value === t.priority);
              return (
                <div key={t.id} onClick={() => openTicket(t)}
                  className="rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.005]"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{t.subject}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs"
                          style={{ background: `${statusInfo.color}22`, color: statusInfo.color }}>
                          {statusInfo.label}
                        </span>
                        {priorityInfo && (
                          <span className="px-2 py-0.5 rounded-full text-xs"
                            style={{ background: `${priorityInfo.color}22`, color: priorityInfo.color }}>
                            {priorityInfo.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: "var(--text3)" }}>
                        {CATEGORIES.find(c => c.value === t.category)?.label} ·{" "}
                        {new Date(t.createdAt).toLocaleDateString("pt-BR")} ·{" "}
                        {t.messages.length} mensagem{t.messages.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--text3)" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* New Ticket */}
      {view === "new" && (
        <form onSubmit={submitTicket} className="max-w-2xl space-y-5">
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
          <div className="rounded-2xl p-6 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Assunto *</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} required
                placeholder="Descreva resumidamente o problema" className={inp} style={inpStyle}
                onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Categoria</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className={inp} style={inpStyle}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Prioridade</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}
                  className={inp} style={inpStyle}>
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Mensagem *</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} required
                rows={5} placeholder="Descreva detalhadamente o que aconteceu..."
                className={inp + " resize-none"} style={inpStyle}
                onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")} />
            </div>
            <button type="submit" disabled={submitting}
              className="px-6 py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: "var(--gold)", color: "#000", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Enviando..." : "Abrir chamado"}
            </button>
          </div>
        </form>
      )}

      {/* Ticket Chat */}
      {view === "ticket" && selectedTicket && (
        <div className="max-w-3xl">
          {/* Ticket info */}
          <div className="rounded-xl p-4 mb-4 flex items-center justify-between flex-wrap gap-3"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const s = STATUS_LABELS[selectedTicket.status] ?? STATUS_LABELS.aberto;
                return (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: `${s.color}22`, color: s.color }}>{s.label}</span>
                );
              })()}
              {(() => {
                const p = PRIORITIES.find(p => p.value === selectedTicket.priority);
                return p ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs"
                    style={{ background: `${p.color}22`, color: p.color }}>{p.label}</span>
                ) : null;
              })()}
              <span className="text-xs" style={{ color: "var(--text3)" }}>
                #{selectedTicket.id.slice(-6)} · {new Date(selectedTicket.createdAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="p-4 space-y-4 min-h-[300px] max-h-[500px] overflow-y-auto">
              {selectedTicket.messages.map(m => {
                const isMe = m.authorId === session?.user?.id;
                return (
                  <div key={m.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: m.authorRole === "master" || m.authorRole === "admin" ? "rgba(201,168,76,0.2)" : "var(--surface2)", color: m.authorRole === "master" || m.authorRole === "admin" ? "var(--gold)" : "var(--text2)" }}>
                      {m.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div className={`flex-1 max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: "var(--text3)" }}>{m.authorName}</span>
                        {(m.authorRole === "admin" || m.authorRole === "master") && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(201,168,76,0.15)", color: "var(--gold)" }}>Suporte</span>
                        )}
                      </div>
                      <div className="rounded-2xl px-4 py-3 text-sm"
                        style={{
                          background: isMe ? "rgba(201,168,76,0.15)" : "var(--surface2)",
                          color: "var(--text)",
                          borderBottomRightRadius: isMe ? "4px" : undefined,
                          borderBottomLeftRadius: isMe ? undefined : "4px",
                        }}>
                        {m.content}
                      </div>
                      <span className="text-xs" style={{ color: "var(--text3)" }}>
                        {new Date(m.createdAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            {selectedTicket.status !== "fechado" && (
              <div style={{ borderTop: "1px solid var(--border)" }}>
                <form onSubmit={sendMessage} className="p-4 flex gap-3">
                  <input
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={inpStyle}
                    onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                    onBlur={e => (e.target.style.borderColor = "var(--border)")}
                  />
                  <button type="submit" disabled={sending || !newMsg.trim()}
                    className="px-4 py-2.5 rounded-xl font-semibold text-sm flex-shrink-0 transition-opacity"
                    style={{ background: "var(--gold)", color: "#000", opacity: sending || !newMsg.trim() ? 0.5 : 1 }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </form>
                <p className="text-xs text-center pb-3" style={{ color: "var(--text3)" }}>
                  Mensagens em tempo real (SSE)
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
