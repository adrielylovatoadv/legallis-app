"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CadastroGratisPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha !== confirmSenha) { setError("Senhas não conferem."); return; }
    if (senha.length < 6) { setError("Senha mínima de 6 caracteres."); return; }
    setError("");
    setLoading(true);

    const res = await fetch("/api/cadastro/gratis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, telefone, senha, confirmSenha }),
    });

    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Erro ao criar conta.");
      return;
    }

    router.push("/login?cadastro=trial");
  };

  const inp = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors";
  const inpStyle = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" };

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-md mx-auto">
        <div className="flex justify-center mb-10">
          <Image src="/logo.png" alt="Legallis" width={160} height={48} priority />
        </div>

        {/* Trial Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
            style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)", color: "var(--gold)" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            4 dias grátis · Sem cartão de crédito
          </div>
        </div>

        <div className="rounded-2xl px-8 py-8 space-y-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-center">
            <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>Começar gratuitamente</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>Crie sua conta e explore o Legallis por 4 dias sem custo</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Nome completo *</label>
              <input value={nome} onChange={e => setNome(e.target.value)} required
                placeholder="Adriely Lovato" className={inp} style={inpStyle}
                onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")} />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>E-mail *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="adriely@escritorio.com" className={inp} style={inpStyle}
                onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")} />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Telefone</label>
              <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999" className={inp} style={inpStyle}
                onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")} />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Senha *</label>
              <div className="relative">
                <input type={showSenha ? "text" : "password"} value={senha}
                  onChange={e => setSenha(e.target.value)} required minLength={6}
                  placeholder="Mínimo 6 caracteres" className={inp + " pr-12"} style={inpStyle}
                  onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                  onBlur={e => (e.target.style.borderColor = "var(--border)")} />
                <button type="button" onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1" style={{ color: "var(--text3)" }} tabIndex={-1}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d={showSenha ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Confirmar senha *</label>
              <div className="relative">
                <input type={showConfirm ? "text" : "password"} value={confirmSenha}
                  onChange={e => setConfirmSenha(e.target.value)} required
                  placeholder="Repita a senha" className={inp + " pr-12"} style={inpStyle}
                  onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                  onBlur={e => (e.target.style.borderColor = "var(--border)")} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1" style={{ color: "var(--text3)" }} tabIndex={-1}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d={showConfirm ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm px-4 py-2.5 rounded-lg"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity"
              style={{ background: loading ? "var(--surface2)" : "var(--gold)", color: loading ? "var(--text3)" : "#000" }}>
              {loading ? "Criando conta..." : "Começar teste gratuito →"}
            </button>

            <p className="text-xs text-center" style={{ color: "var(--text3)" }}>
              Após 4 dias, selecione um plano para continuar. Os dados são mantidos por 1 dia após o vencimento.
            </p>
          </form>
        </div>

        <div className="flex items-center justify-center gap-4 mt-6 text-xs" style={{ color: "var(--text3)" }}>
          <Link href="/cadastro" className="hover:opacity-80 transition-opacity" style={{ color: "var(--gold)" }}>
            Ver planos pagos
          </Link>
          <span>·</span>
          <Link href="/login" className="hover:opacity-80 transition-opacity" style={{ color: "var(--gold)" }}>
            Já tenho conta
          </Link>
        </div>
      </div>
    </div>
  );
}
