"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/esqueci-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="Legallis" width={180} height={54} priority />
        </div>

        <div className="rounded-2xl px-8 py-8 space-y-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-center">
            <h1 className="font-serif text-xl font-semibold" style={{ color: "var(--text)" }}>
              Recuperar senha
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>
              Enviaremos um link de redefinição
            </p>
          </div>

          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                style={{ background: "rgba(201,168,76,0.15)" }}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  style={{ color: "var(--gold)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm" style={{ color: "var(--text2)" }}>
                Se o e-mail estiver cadastrado, você receberá um link em breve.
              </p>
              <Link href="/login"
                className="block text-center py-3 rounded-xl font-semibold text-sm"
                style={{ background: "var(--gold)", color: "#000" }}>
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider mb-1.5 block"
                  style={{ color: "var(--text3)" }}>E-mail ou usuário</label>
                <input
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="adriely@legallis"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
                  onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                  onBlur={e => (e.target.style.borderColor = "var(--border)")}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm"
                style={{ background: loading ? "var(--surface2)" : "var(--gold)", color: loading ? "var(--text3)" : "#000" }}>
                {loading ? "Enviando..." : "Enviar link"}
              </button>
              <Link href="/login"
                className="block text-center text-sm"
                style={{ color: "var(--text3)" }}>
                ← Voltar ao login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
