"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ToastType = "error" | "info" | "success";

interface ToastItem { id: number; message: string; type: ToastType; }

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa ser usado dentro de <ToastProvider>");
  return ctx;
}

const STYLE: Record<ToastType, { border: string; color: string; icon: string }> = {
  error:   { border: "rgba(239,68,68,0.4)",  color: "#f87171", icon: "⚠️" },
  info:    { border: "rgba(96,165,250,0.4)", color: "#60a5fa", icon: "ℹ️" },
  success: { border: "rgba(34,197,94,0.4)",  color: "#4ade80", icon: "✓" },
};

// Métodos de escrita cuja falha precisa avisar a usuária — GETs não contam como "salvar".
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input !== "string" && !(input instanceof URL)) return input.method.toUpperCase();
  return "GET";
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = "error") => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000);
  }, []);

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // Rede de segurança global: qualquer POST/PUT/PATCH/DELETE para /api/* que falhar (resposta
  // de erro ou queda de conexão) mostra um aviso, mesmo que o componente que chamou não trate
  // o erro (hoje a maioria não trata — falha fica silenciosa). /api/auth/* fica de fora porque
  // o próprio fluxo de login já mostra seu erro específico.
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const isAppApi = url.includes("/api/") && !url.includes("/api/auth/");
      const isWrite = WRITE_METHODS.has(requestMethod(input, init));

      if (!isAppApi || !isWrite) return originalFetch(input, init);

      try {
        const res = await originalFetch(input, init);
        if (!res.ok) {
          let detail = "";
          try {
            const body = await res.clone().json();
            if (body?.error) detail = `: ${body.error}`;
          } catch { /* resposta pode não ser JSON */ }
          showToast(`Não foi possível salvar${detail}. Tente novamente.`, "error");
        }
        return res;
      } catch (err) {
        showToast("Falha de conexão ao salvar. Verifique sua internet e tente novamente.", "error");
        throw err;
      }
    };
    return () => { window.fetch = originalFetch; };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map(t => {
          const s = STYLE[t.type];
          return (
            <div key={t.id}
              className="pointer-events-auto flex items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-lg"
              style={{ background: "var(--surface)", border: `1px solid ${s.border}` }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <span className="flex-1" style={{ color: "var(--text)" }}>{t.message}</span>
              <button onClick={() => dismiss(t.id)} style={{ color: "var(--text3)" }}>✕</button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
