"use client";

import { useTheme } from "@/components/layout/ThemeContext";
import type { ThemeMode } from "@/components/layout/ThemeContext";
import { useSession } from "next-auth/react";

const THEMES: { value: ThemeMode; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    value: "light",
    label: "Modo Claro",
    desc: "Visual limpo com fundo claro. Excelente para uso diurno.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Modo Escuro",
    desc: "Visual premium com tons escuros elegantes. Confortável para uso noturno.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  },
  {
    value: "auto",
    label: "Automático",
    desc: "Segue a configuração do seu dispositivo. Alterna automaticamente.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
      </svg>
    ),
  },
];

export default function AparenciaPage() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();

  const saveTheme = async (t: ThemeMode) => {
    setTheme(t);
    if (session?.user?.id) {
      await fetch(`/api/usuarios/${session.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: t }),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold mb-1" style={{ color: "var(--text)" }}>Tema</h2>
        <p className="text-sm mb-6" style={{ color: "var(--text3)" }}>
          A mudança de tema é aplicada instantaneamente e salva em sua conta.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {THEMES.map(t => {
            const selected = theme === t.value;
            return (
              <button key={t.value} onClick={() => saveTheme(t.value)}
                className="relative rounded-xl p-5 text-left transition-all"
                style={{
                  background: selected ? "rgba(201,168,76,0.1)" : "var(--surface2)",
                  border: `2px solid ${selected ? "var(--gold)" : "var(--border)"}`,
                }}>
                {selected && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "var(--gold)" }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#000" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                <div className="mb-3" style={{ color: selected ? "var(--gold)" : "var(--text2)" }}>
                  {t.icon}
                </div>
                <p className="font-semibold text-sm mb-1" style={{ color: "var(--text)" }}>{t.label}</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text3)" }}>{t.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Pré-visualização</h2>
        <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg" style={{ background: "var(--gold)" }} />
            <div>
              <div className="w-32 h-3 rounded-full mb-1.5" style={{ background: "var(--text)" }} />
              <div className="w-20 h-2 rounded-full" style={{ background: "var(--text3)" }} />
            </div>
          </div>
          <div className="rounded-lg p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="w-full h-2 rounded-full mb-2" style={{ background: "var(--text2)" }} />
            <div className="w-3/4 h-2 rounded-full" style={{ background: "var(--text3)" }} />
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: "var(--text3)" }}>
          Tema atual: <span style={{ color: "var(--gold)", fontWeight: 600 }}>
            {THEMES.find(t => t.value === theme)?.label}
          </span>
        </p>
      </div>
    </div>
  );
}
