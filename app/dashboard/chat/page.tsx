"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";

interface ChatMessage {
  id: string;
  conversationId: string;
  from: string;
  fromName: string;
  text: string;
  type: "user" | "system";
  createdAt: string;
  readBy: string[];
}

interface Conversation {
  id: string;
  type: "channel" | "dm" | "group" | "system";
  name: string;
  members: string[] | null;
  createdAt: string;
  createdBy?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR");
}
function convLabel(conv: Conversation, myId: string, users: User[]): string {
  if (conv.type === "channel") return `# ${conv.name}`;
  if (conv.type === "system") return "⚙ Sistema";
  if (conv.type === "group") return `👥 ${conv.name}`;
  if (conv.type === "dm") {
    const otherId = (conv.members || []).find(m => m !== myId);
    const other = users.find(u => u.id === otherId);
    return other?.name || "DM";
  }
  return conv.name;
}
function convIcon(type: string) {
  if (type === "channel") return "💬";
  if (type === "system") return "⚙";
  if (type === "group") return "👥";
  return "👤";
}

function NewGroupModal({ users, myId, onClose, onCreated }: {
  users: User[]; myId: string; onClose: () => void; onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const create = async () => {
    if (!name.trim() || selected.length === 0) return;
    setSaving(true);
    const res = await fetch("/api/chat/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, members: selected }),
    });
    setSaving(false);
    if (res.ok) {
      const conv = await res.json();
      onCreated(conv.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Novo Grupo</h2>
          <button onClick={onClose} style={{ color: "var(--text3)" }}>✕</button>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Nome do grupo</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Participantes</label>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {users.filter(u => u.id !== myId).length === 0 && (
              <p className="px-3 py-2 text-xs" style={{ color: "var(--text3)" }}>Nenhum usuário disponível</p>
            )}
            {users.filter(u => u.id !== myId).map(u => (
              <div key={u.id}
                onClick={() => toggle(u.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer select-none"
                style={{ background: selected.includes(u.id) ? "rgba(201,168,76,0.15)" : "var(--surface2)" }}>
                <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)}
                  className="accent-yellow-500" onClick={e => e.stopPropagation()} />
                <span className="text-sm" style={{ color: "var(--text)" }}>{u.name}</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={create} disabled={saving || !name.trim() || selected.length === 0}
          className="w-full py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: "var(--gold)", color: "#000", opacity: (saving || !name.trim() || selected.length === 0) ? 0.5 : 1 }}>
          {saving ? "Criando..." : "Criar Grupo"}
        </button>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { data: session } = useSession();
  const myId = session?.user?.id || "";
  const myName = session?.user?.name || "";

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState("general");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/chat?type=conversations");
    if (res.ok) {
      const d = await res.json();
      setConversations(d.conversations || []);
      setUnread(d.unread || {});
    }
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    const res = await fetch(`/api/chat?conversationId=${convId}`);
    if (res.ok) setMessages(await res.json());
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }, []);

  useEffect(() => {
    loadConversations();
    loadUsers();
  }, [loadConversations, loadUsers]);

  useEffect(() => {
    loadMessages(activeId);
    const id = setInterval(() => {
      loadMessages(activeId);
      loadConversations();
    }, 4000);
    return () => clearInterval(id);
  }, [activeId, loadMessages, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, conversationId: activeId }),
    });
    setLoading(false);
    if (res.ok) { setText(""); await loadMessages(activeId); }
  };

  const startDM = async (targetUserId: string) => {
    const res = await fetch("/api/chat/dm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    });
    if (res.ok) {
      const conv = await res.json();
      await loadConversations();
      setActiveId(conv.id);
      setShowUserList(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const grouped: { date: string; msgs: ChatMessage[] }[] = [];
  messages.forEach(m => {
    const d = fmtDate(m.createdAt);
    const last = grouped[grouped.length - 1];
    if (last && last.date === d) last.msgs.push(m);
    else grouped.push({ date: d, msgs: [m] });
  });

  const activeConv = conversations.find(c => c.id === activeId);
  const channels = conversations.filter(c => c.type === "channel" || c.type === "system");
  const dms = conversations.filter(c => c.type === "dm");
  const groups = conversations.filter(c => c.type === "group");

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-56 flex flex-col flex-shrink-0" style={{ borderRight: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>Mensagens</span>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Channels */}
          <div className="px-3 py-1.5">
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--text3)" }}>Canais</span>
          </div>
          {channels.map(c => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 rounded-lg mx-1 transition-colors"
              style={{
                background: activeId === c.id ? "rgba(201,168,76,0.15)" : "transparent",
                color: activeId === c.id ? "var(--gold)" : "var(--text2)",
              }}>
              <span className="text-sm truncate">{convLabel(c, myId, users)}</span>
              {unread[c.id] > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                  style={{ background: "var(--gold)", color: "#000" }}>{unread[c.id]}</span>
              )}
            </button>
          ))}

          {/* Groups */}
          <div className="px-3 py-1.5 mt-2 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--text3)" }}>Grupos</span>
            <button onClick={() => setShowGroupModal(true)} className="text-xs px-2 py-0.5 rounded"
              style={{ background: "rgba(201,168,76,0.1)", color: "var(--gold)" }}>+</button>
          </div>
          {groups.map(c => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 rounded-lg mx-1 transition-colors"
              style={{
                background: activeId === c.id ? "rgba(201,168,76,0.15)" : "transparent",
                color: activeId === c.id ? "var(--gold)" : "var(--text2)",
              }}>
              <span className="text-sm truncate">{convLabel(c, myId, users)}</span>
              {unread[c.id] > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                  style={{ background: "var(--gold)", color: "#000" }}>{unread[c.id]}</span>
              )}
            </button>
          ))}

          {/* DMs */}
          <div className="px-3 py-1.5 mt-2 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--text3)" }}>Mensagens diretas</span>
            <button onClick={() => setShowUserList(s => !s)} className="text-xs px-2 py-0.5 rounded"
              style={{ background: "rgba(201,168,76,0.1)", color: "var(--gold)" }}>+</button>
          </div>
          {showUserList && (
            <div className="mx-2 mb-1 rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface2)", position: "relative", zIndex: 10 }}>
              {users.filter(u => u.id !== myId).length === 0 && (
                <p className="px-3 py-2 text-xs" style={{ color: "var(--text3)" }}>Nenhum usuário disponível</p>
              )}
              {users.filter(u => u.id !== myId).map(u => (
                <button key={u.id} onClick={() => startDM(u.id)}
                  className="w-full px-3 py-2 text-left text-sm transition-colors"
                  style={{ color: "var(--text2)", cursor: "pointer", display: "block" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  👤 {u.name}
                </button>
              ))}
            </div>
          )}
          {dms.map(c => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 rounded-lg mx-1 transition-colors"
              style={{
                background: activeId === c.id ? "rgba(201,168,76,0.15)" : "transparent",
                color: activeId === c.id ? "var(--gold)" : "var(--text2)",
              }}>
              <span className="text-sm truncate">{convLabel(c, myId, users)}</span>
              {unread[c.id] > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                  style={{ background: "var(--gold)", color: "#000" }}>{unread[c.id]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Me */}
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: "var(--gold)", color: "#000" }}>
            {myName.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-medium" style={{ color: "var(--text2)" }}>{myName}</span>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
          {activeConv && (
            <>
              <span className="text-lg">{convIcon(activeConv.type)}</span>
              <div>
                <h1 className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                  {convLabel(activeConv, myId, users)}
                </h1>
                <p className="text-xs" style={{ color: "var(--text3)" }}>
                  {activeConv.type === "channel" ? "Canal interno" :
                   activeConv.type === "system" ? "Eventos automáticos do sistema" :
                   activeConv.type === "group" ? `${(activeConv.members || []).length} participantes` :
                   "Conversa privada"}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {grouped.map(group => (
            <div key={group.date}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                <span className="text-xs px-2" style={{ color: "var(--text3)" }}>{group.date}</span>
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              </div>
              {group.msgs.map(m => {
                if (m.type === "system") {
                  return (
                    <div key={m.id} className="flex justify-center my-2">
                      <div className="px-3 py-1.5 rounded-full text-xs max-w-lg text-center"
                        style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", color: "var(--text3)" }}>
                        ⚙ {m.text}
                      </div>
                    </div>
                  );
                }
                const isMe = m.from === myId;
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"} gap-2 py-0.5`}>
                    {!isMe && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold mt-1"
                        style={{ background: "var(--surface2)", color: "var(--text2)" }}>
                        {m.fromName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={`max-w-xs lg:max-w-md space-y-0.5 ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                      {!isMe && (
                        <span className="text-xs font-medium px-1" style={{ color: "var(--text3)" }}>{m.fromName}</span>
                      )}
                      <div className="px-3 py-2 rounded-2xl text-sm"
                        style={{
                          background: isMe ? "var(--gold)" : "var(--surface)",
                          color: isMe ? "#000" : "var(--text)",
                          border: isMe ? "none" : "1px solid var(--border)",
                          borderBottomRightRadius: isMe ? "4px" : undefined,
                          borderBottomLeftRadius: !isMe ? "4px" : undefined,
                        }}>
                        {m.text}
                      </div>
                      <span className="text-xs px-1" style={{ color: "var(--text3)" }}>{fmtTime(m.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: "var(--text3)" }}>
              <span className="text-4xl">💬</span>
              <span className="text-sm">Nenhuma mensagem ainda</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input — hide for system channel */}
        {activeConv?.type !== "system" && (
          <div className="px-4 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
            <div className="flex gap-2 items-end">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Digite uma mensagem... (Enter para enviar)"
                rows={1}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", maxHeight: "120px" }}
                onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")}
              />
              <button onClick={send} disabled={!text.trim() || loading}
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity"
                style={{ background: text.trim() ? "var(--gold)" : "var(--surface2)", color: text.trim() ? "#000" : "var(--text3)" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {showGroupModal && (
        <NewGroupModal
          users={users} myId={myId}
          onClose={() => setShowGroupModal(false)}
          onCreated={id => { setShowGroupModal(false); loadConversations(); setActiveId(id); }}
        />
      )}
    </div>
  );
}
