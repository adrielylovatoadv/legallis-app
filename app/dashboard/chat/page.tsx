"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";

interface Message {
  id: string;
  from: string;
  fromName: string;
  to: string | null;
  text: string;
  createdAt: string;
  readBy: string[];
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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

export default function ChatPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/chat");
    if (res.ok) setMessages(await res.json());
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setLoading(false);
    if (res.ok) { setText(""); await load(); }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Group by date
  const grouped: { date: string; msgs: Message[] }[] = [];
  messages.forEach(m => {
    const d = fmtDate(m.createdAt);
    const last = grouped[grouped.length - 1];
    if (last && last.date === d) last.msgs.push(m);
    else grouped.push({ date: d, msgs: [m] });
  });

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "rgba(201,168,76,0.15)" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ color: "var(--gold)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div>
          <h1 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Canal Interno</h1>
          <p className="text-xs" style={{ color: "var(--text3)" }}>Mensagens visíveis a todos os usuários</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {grouped.map(group => (
          <div key={group.date}>
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              <span className="text-xs px-2" style={{ color: "var(--text3)" }}>{group.date}</span>
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            </div>
            {group.msgs.map(m => {
              const isMe = m.from === session?.user.id;
              return (
                <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"} gap-2`}>
                  {!isMe && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold mt-1"
                      style={{ background: "var(--surface2)", color: "var(--text2)" }}>
                      {m.fromName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={`max-w-xs lg:max-w-md space-y-1 ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                    {!isMe && (
                      <span className="text-xs font-medium px-1" style={{ color: "var(--text3)" }}>
                        {m.fromName}
                      </span>
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
                    <span className="text-xs px-1" style={{ color: "var(--text3)" }}>
                      {fmtTime(m.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Digite uma mensagem... (Enter para enviar)"
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              maxHeight: "120px",
            }}
            onFocus={e => (e.target.style.borderColor = "var(--gold)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
          />
          <button
            onClick={send}
            disabled={!text.trim() || loading}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity"
            style={{
              background: text.trim() ? "var(--gold)" : "var(--surface2)",
              color: text.trim() ? "#000" : "var(--text3)",
            }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
