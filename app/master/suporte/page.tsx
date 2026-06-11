"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Ticket } from "@/lib/suporte";
import { useSession } from "next-auth/react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  aberto: { label: "Aberto", color: "#4ade80" },
  em_andamento: { label: "Em andamento", color: "var(--gold)" },
  resolvido: { label: "Resolvido", color: "#818cf8" },
  fechado: { label: "Fechado", color: "var(--text3)" },
};

export default function MasterSuportePage() {
  const { data: session } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState("aberto");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/suporte/tickets");
    if (res.ok) setTickets(await res.json());
    setLoading(false);
  }, []);

  const loadTicket = useCallback(async (id: string) => {
    const res = await fetch(`/api/suporte/tickets/${id}`);
    if (res.ok) setSelected(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selected) {
      if (sseRef.current) sseRef.current.close();
      const es = new EventSource(`/api/suporte/tickets/${selected.id}/stream`);
      sseRef.current = es;
      es.onmessage = (e) => {
        try {
          const p = JSON.parse(e.data) as { type: string; messages?: import("@/lib/suporte").TicketMessage[]; status?: string };
          if (p.type === "messages" && p.messages?.length) {
            setSelected(prev => prev ? {
              ...prev,
              messages: [...prev.messages, ...p.messages!],
              status: (p.status as Ticket["status"]) ?? prev.status,
            } : prev);
          }
        } catch { /* ignore */ }
      };
      return () => { es.close(); sseRef.current = null; };
    }
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim() || !selected) return;
    setSending(true);
    const res = await fetch(`/api/suporte/tickets/${selected.id}/mensagens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newMsg }),
    });
    setSending(false);
    if (res.ok) { setNewMsg(""); loadTicket(selected.id); }
  };

  const changeStatus = async (status: string) => {
    if (!selected) return;
    const res = await fetch(`/api/suporte/tickets/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { loadTicket(selected.id); load(); }
  };

  const filtered = tickets.filter(t => filter === "all" || t.status === filter);

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--text3)" }}>Carregando...</div>;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--gold)" }}>Painel Master</p>
        <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>Central de Suporte</h1>
      </div>

      <div className="flex gap-6 h-[calc(100vh-200px)]">
        {/* Left: ticket list */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3">
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
            <option value="all">Todos</option>
            <option value="aberto">Abertos</option>
            <option value="em_andamento">Em andamento</option>
            <option value="resolvido">Resolvidos</option>
            <option value="fechado">Fechados</option>
          </select>

          <div className="flex-1 overflow-y-auto space-y-2">
            {filtered.map(t => {
              const s = STATUS_LABELS[t.status] ?? STATUS_LABELS.aberto;
              const isSelected = selected?.id === t.id;
              return (
                <div key={t.id} onClick={() => loadTicket(t.id)}
                  className="p-3 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: isSelected ? "rgba(201,168,76,0.12)" : "var(--surface)",
                    border: `1px solid ${isSelected ? "var(--gold)" : "var(--border)"}`,
                  }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: `${s.color}22`, color: s.color }}>{s.label}</span>
                  </div>
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{t.subject}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{t.userName} · {new Date(t.updatedAt).toLocaleDateString("pt-BR")}</p>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-sm" style={{ color: "var(--text3)" }}>Nenhum chamado.</div>
            )}
          </div>
        </div>

        {/* Right: chat */}
        {selected ? (
          <div className="flex-1 flex flex-col rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
              style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
              <div>
                <p className="font-medium text-sm" style={{ color: "var(--text)" }}>{selected.subject}</p>
                <p className="text-xs" style={{ color: "var(--text3)" }}>{selected.userName} · {selected.userEmail}</p>
              </div>
              <div className="flex gap-2">
                {selected.status !== "resolvido" && (
                  <button onClick={() => changeStatus("resolvido")}
                    className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: "rgba(129,140,248,0.15)", color: "#818cf8" }}>
                    Marcar resolvido
                  </button>
                )}
                {selected.status !== "fechado" && (
                  <button onClick={() => changeStatus("fechado")}
                    className="px-3 py-1 rounded-lg text-xs" style={{ background: "var(--surface)", color: "var(--text3)", border: "1px solid var(--border)" }}>
                    Encerrar
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ background: "var(--surface)" }}>
              {selected.messages.map(m => {
                const isMe = m.authorId === session?.user?.id;
                return (
                  <div key={m.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: isMe ? "rgba(201,168,76,0.2)" : "var(--surface2)", color: isMe ? "var(--gold)" : "var(--text2)" }}>
                      {m.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div className={`flex-1 max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                      <span className="text-xs" style={{ color: "var(--text3)" }}>{m.authorName}</span>
                      <div className="rounded-2xl px-4 py-3 text-sm"
                        style={{
                          background: isMe ? "rgba(201,168,76,0.15)" : "var(--surface2)",
                          color: "var(--text)",
                          borderBottomRightRadius: isMe ? "4px" : undefined,
                          borderBottomLeftRadius: isMe ? undefined : "4px",
                        }}>
                        {m.content}
                      </div>
                      <span className="text-xs" style={{ color: "var(--text3)" }}>{new Date(m.createdAt).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {selected.status !== "fechado" && (
              <form onSubmit={sendReply} className="flex gap-3 p-4 flex-shrink-0"
                style={{ borderTop: "1px solid var(--border)", background: "var(--surface2)" }}>
                <input value={newMsg} onChange={e => setNewMsg(e.target.value)}
                  placeholder="Responder..."
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
                  onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                  onBlur={e => (e.target.style.borderColor = "var(--border)")} />
                <button type="submit" disabled={sending || !newMsg.trim()}
                  className="px-4 py-2.5 rounded-xl font-semibold text-sm"
                  style={{ background: "var(--gold)", color: "#000", opacity: sending || !newMsg.trim() ? 0.5 : 1 }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center rounded-2xl" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--text3)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm" style={{ color: "var(--text3)" }}>Selecione um chamado</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
