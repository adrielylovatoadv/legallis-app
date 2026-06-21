"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

const PLANS = [
  {
    id: "basic",
    name: "Básico",
    price: "R$ 97",
    period: "/mês",
    description: "Para advogados autônomos",
    features: ["1 admin + até 2 usuários", "Controle Processual", "Calculadora Jurídica", "Export PDF"],
    paymentLink: "https://buy.stripe.com/test_9B600ke867Gta2EdNveEo09",
    color: "var(--text3)",
  },
  {
    id: "profissional",
    name: "Profissional",
    price: "R$ 197",
    period: "/mês",
    description: "Para pequenos escritórios",
    features: ["1 admin + até 4 usuários", "Todos os módulos", "Financeiro completo", "Export PDF/Word/Excel", "Suporte por e-mail"],
    paymentLink: "https://buy.stripe.com/test_00wfZi8NMe4RcaMfVDeEo0a",
    color: "var(--gold)",
    destaque: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 347",
    period: "/mês",
    description: "Para escritórios em crescimento",
    features: ["1 admin + até 20 usuários", "Todos os módulos", "Export PDF/Word/Excel", "Suporte prioritário", "Onboarding incluso"],
    paymentLink: "https://buy.stripe.com/test_eVq7sM1lk7Gt7Uw9xfeEo0b",
    color: "#818cf8",
  },
];

export default function CadastroPage() {
  const [step, setStep] = useState<"plano" | "dados">("plano");
  const [planSelecionado, setPlanSelecionado] = useState<typeof PLANS[0] | null>(null);
  const [nome, setNome] = useState("");
  const [nomeEscritorio, setNomeEscritorio] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [termosAceitos, setTermosAceitos] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selecionarPlano = (plan: typeof PLANS[0]) => {
    setPlanSelecionado(plan);
    setStep("dados");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planSelecionado) return;
    if (!termosAceitos) { setError("Você precisa aceitar os termos de uso e política de privacidade."); return; }
    if (senha !== confirmSenha) { setError("Senhas não conferem."); return; }
    if (senha.length < 6) { setError("Senha mínima de 6 caracteres."); return; }
    setError("");
    setLoading(true);

    // Cria o usuário com plano "pending"
    const res = await fetch("/api/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, nomeEscritorio, email, telefone, senha, plan: planSelecionado.id }),
    });

    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Erro ao criar conta.");
      return;
    }
    const { userId } = await res.json();

    // Redireciona para o Stripe com email e referência pré-preenchidos
    const url = `${planSelecionado.paymentLink}?prefilled_email=${encodeURIComponent(email)}&client_reference_id=${userId}`;
    window.location.href = url;
  };

  const inp = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors";
  const inpStyle = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" };

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-5xl mx-auto">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Image src="/logo.png" alt="Legallis" width={160} height={48} priority />
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {["plano", "dados"].map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: step === s || (s === "plano" && step === "dados") ? "var(--gold)" : "var(--surface2)",
                    color: step === s || (s === "plano" && step === "dados") ? "#000" : "var(--text3)",
                  }}>
                  {i + 1}
                </div>
                <span className="text-sm font-medium" style={{ color: step === s ? "var(--text)" : "var(--text3)" }}>
                  {s === "plano" ? "Escolher plano" : "Criar conta"}
                </span>
              </div>
              {i === 0 && <div className="w-12 h-px" style={{ background: "var(--border)" }} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Planos ── */}
        {step === "plano" && (
          <>
            <h1 className="font-serif text-3xl font-semibold text-center mb-2" style={{ color: "var(--text)" }}>
              Escolha seu plano
            </h1>
            <p className="text-center text-sm mb-8" style={{ color: "var(--text3)" }}>
              Cancele quando quiser. Sem taxa de adesão.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {PLANS.map(plan => (
                <div key={plan.id} onClick={() => selecionarPlano(plan)}
                  className="relative rounded-2xl p-6 cursor-pointer transition-all hover:scale-[1.02]"
                  style={{
                    background: "var(--surface)",
                    border: `2px solid ${plan.destaque ? "var(--gold)" : "var(--border)"}`,
                    boxShadow: plan.destaque ? "0 0 24px rgba(201,168,76,0.15)" : "none",
                  }}>
                  {plan.destaque && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: "var(--gold)", color: "#000" }}>
                      Mais popular
                    </div>
                  )}
                  <div className="mb-4">
                    <h3 className="font-semibold text-lg" style={{ color: plan.color }}>{plan.name}</h3>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{plan.description}</p>
                  </div>
                  <div className="flex items-baseline gap-1 mb-5">
                    <span className="text-3xl font-bold" style={{ color: "var(--text)" }}>{plan.price}</span>
                    <span className="text-sm" style={{ color: "var(--text3)" }}>{plan.period}</span>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "var(--text2)" }}>
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          style={{ color: plan.color }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: plan.destaque ? "var(--gold)" : "var(--surface2)",
                      color: plan.destaque ? "#000" : "var(--text)",
                      border: plan.destaque ? "none" : `1px solid ${plan.color}`,
                    }}>
                    Começar com {plan.name}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-center text-xs mt-6" style={{ color: "var(--text3)" }}>
              Já tem uma conta?{" "}
              <Link href="/login" style={{ color: "var(--gold)" }}>
                Entrar
              </Link>
            </p>
          </>
        )}

        {/* ── Step 2: Dados ── */}
        {step === "dados" && planSelecionado && (
          <div className="max-w-md mx-auto">
            <div className="rounded-xl p-4 mb-6 flex items-center justify-between"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div>
                <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: "var(--text3)" }}>Plano selecionado</p>
                <p className="font-semibold" style={{ color: "var(--text)" }}>{planSelecionado.name} — {planSelecionado.price}/mês</p>
              </div>
              <button onClick={() => setStep("plano")}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "var(--surface2)", color: "var(--text3)" }}>
                Trocar
              </button>
            </div>

            <div className="rounded-2xl px-8 py-8 space-y-5"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div>
                <h2 className="font-serif text-xl font-semibold" style={{ color: "var(--text)" }}>Criar sua conta</h2>
                <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>Você será redirecionado ao pagamento após o cadastro</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Nome completo *</label>
                  <input value={nome} onChange={e => setNome(e.target.value)} required
                    placeholder="Nome completo" className={inp} style={inpStyle}
                    onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                    onBlur={e => (e.target.style.borderColor = "var(--border)")} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Nome do escritório *</label>
                  <input value={nomeEscritorio} onChange={e => setNomeEscritorio(e.target.value)} required
                    placeholder="Sobrenome & Associados Advocacia" className={inp} style={inpStyle}
                    onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                    onBlur={e => (e.target.style.borderColor = "var(--border)")} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>E-mail *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="nome@escritorio.com" className={inp} style={inpStyle}
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
                      placeholder="Mínimo 6 caracteres"
                      className={inp + " pr-12"} style={inpStyle}
                      onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                      onBlur={e => (e.target.style.borderColor = "var(--border)")} />
                    <button type="button" onClick={() => setShowSenha(!showSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      style={{ color: "var(--text3)" }} tabIndex={-1}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d={showSenha
                            ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                            : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                      </svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Confirmar senha *</label>
                  <div className="relative">
                    <input type={showConfirm ? "text" : "password"} value={confirmSenha}
                      onChange={e => setConfirmSenha(e.target.value)} required
                      placeholder="Repita a senha"
                      className={inp + " pr-12"} style={inpStyle}
                      onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                      onBlur={e => (e.target.style.borderColor = "var(--border)")} />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      style={{ color: "var(--text3)" }} tabIndex={-1}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d={showConfirm
                            ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                            : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                      </svg>
                    </button>
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termosAceitos}
                    onChange={e => setTermosAceitos(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded flex-shrink-0"
                    style={{ accentColor: "var(--gold)" }}
                  />
                  <span className="text-xs leading-relaxed" style={{ color: "var(--text3)" }}>
                    Li e concordo com os{" "}
                    <Link href="/termos" target="_blank" className="underline" style={{ color: "var(--gold)" }}>Termos de Uso</Link>
                    {" "}e a{" "}
                    <Link href="/privacidade" target="_blank" className="underline" style={{ color: "var(--gold)" }}>Política de Privacidade</Link>.
                    Pagamento processado com segurança pelo Stripe.
                  </span>
                </label>

                {error && (
                  <div className="text-sm px-4 py-2.5 rounded-lg"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-sm"
                  style={{ background: loading ? "var(--surface2)" : "var(--gold)", color: loading ? "var(--text3)" : "#000" }}>
                  {loading ? "Criando conta..." : "Continuar para pagamento →"}
                </button>
              </form>
            </div>

            <p className="text-center text-xs mt-4" style={{ color: "var(--text3)" }}>
              Já tem uma conta?{" "}
              <Link href="/login" style={{ color: "var(--gold)" }}>Entrar</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
