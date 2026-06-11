"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trialCreated = searchParams.get("cadastro") === "trial";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      // NextAuth uses maxAge from session config; remember=false sets shorter cookie
    });
    setLoading(false);
    if (res?.error) {
      setError("Usuário ou senha incorretos.");
    } else {
      if (!remember) {
        // Session cookie only (browser close = logout)
        document.cookie = "next-auth.session-token; max-age=0; path=/";
      }
      router.push("/dashboard");
      router.refresh();
    }
  };

  const inp = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors";
  const inpStyle = {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="Legallis" width={180} height={54} priority />
        </div>

        {trialCreated && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm"
            style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" }}>
            Conta criada com sucesso! Faça login para iniciar seu teste gratuito de 4 dias.
          </div>
        )}

        <div className="rounded-2xl px-8 py-8 space-y-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-center">
            <h1 className="font-serif text-xl font-semibold" style={{ color: "var(--text)" }}>
              Acesso ao sistema
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>
              Lovato & Estevão Advocacia
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs uppercase tracking-wider mb-1.5 block"
                style={{ color: "var(--text3)" }}>Usuário</label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="adriely@legallis"
                required
                className={inp}
                style={inpStyle}
                onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")}
              />
            </div>

            {/* Senha com toggle */}
            <div>
              <label className="text-xs uppercase tracking-wider mb-1.5 block"
                style={{ color: "var(--text3)" }}>Senha</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className={inp + " pr-12"}
                  style={inpStyle}
                  onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                  onBlur={e => (e.target.style.borderColor = "var(--border)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: "var(--text3)" }}
                  tabIndex={-1}
                >
                  {showPass ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Lembrar + Esqueci */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: "var(--gold)" }}
                />
                <span className="text-xs" style={{ color: "var(--text3)" }}>Lembrar de mim</span>
              </label>
              <Link href="/esqueci-senha"
                className="text-xs transition-colors hover:opacity-80"
                style={{ color: "var(--gold)" }}>
                Esqueci a senha
              </Link>
            </div>

            {error && (
              <div className="text-sm px-4 py-2.5 rounded-lg"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity"
              style={{ background: loading ? "var(--surface2)" : "var(--gold)", color: loading ? "var(--text3)" : "#000" }}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <div className="flex items-center justify-center gap-3 mt-4 text-xs">
          <Link href="/cadastro/gratis" className="hover:opacity-80" style={{ color: "var(--gold)" }}>
            Começar grátis (4 dias)
          </Link>
          <span style={{ color: "var(--text3)" }}>·</span>
          <Link href="/cadastro" className="hover:opacity-80" style={{ color: "var(--gold)" }}>
            Ver planos
          </Link>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: "var(--text3)" }}>
          LEGALLIS · GESTÃO JURÍDICA & FINANCEIRA
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }} />
    }>
      <LoginForm />
    </Suspense>
  );
}
