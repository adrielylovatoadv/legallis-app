"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { PLAN_FEATURES } from "@/lib/users";
import type { Plan } from "@/lib/users";

export default function ContaPage() {
  const { data: session, update } = useSession();
  const [tab, setTab] = useState<"perfil" | "senha">("perfil");
  const [name, setName] = useState(session?.user.name ?? "");
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const plan = (session?.user.plan ?? "basic") as Plan;
  const planInfo = PLAN_FEATURES[plan];

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await fetch(`/api/usuarios/${session?.user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    setLoading(false);
    if (res.ok) {
      await update({ name, email });
      setMsg({ type: "ok", text: "Perfil atualizado com sucesso." });
    } else {
      setMsg({ type: "err", text: "Erro ao atualizar perfil." });
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) { setMsg({ type: "err", text: "Senhas não conferem." }); return; }
    if (newPass.length < 6) { setMsg({ type: "err", text: "Mínimo 6 caracteres." }); return; }
    setLoading(true);
    setMsg(null);
    // Verify current password via login endpoint
    const checkRes = await fetch("/api/auth/verificar-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: session?.user.id, password: currentPass }),
    });
    if (!checkRes.ok) { setLoading(false); setMsg({ type: "err", text: "Senha atual incorreta." }); return; }
    const res = await fetch(`/api/usuarios/${session?.user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPass }),
    });
    setLoading(false);
    if (res.ok) {
      setCurrentPass(""); setNewPass(""); setConfirmPass("");
      setMsg({ type: "ok", text: "Senha alterada com sucesso." });
    } else {
      setMsg({ type: "err", text: "Erro ao alterar senha." });
    }
  };

  const inp = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors";
  const inpStyle = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>
        Minha Conta
      </h1>

      {/* Plan badge */}
      <div className="rounded-xl p-4 flex items-center gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(201,168,76,0.15)" }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ color: "var(--gold)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{session?.user.name}</p>
          <p className="text-xs" style={{ color: "var(--text3)" }}>{session?.user.email}</p>
        </div>
        <div className="ml-auto">
          <span className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{ background: "rgba(201,168,76,0.15)", color: "var(--gold)" }}>
            {planInfo.label}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--surface2)" }}>
        {(["perfil", "senha"] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setMsg(null); }}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize"
            style={{
              background: tab === t ? "var(--surface)" : "transparent",
              color: tab === t ? "var(--text)" : "var(--text3)",
              boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
            }}>
            {t === "perfil" ? "Dados pessoais" : "Alterar senha"}
          </button>
        ))}
      </div>

      {msg && (
        <div className="text-sm px-4 py-3 rounded-xl"
          style={{
            background: msg.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${msg.type === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: msg.type === "ok" ? "#4ade80" : "#f87171",
          }}>
          {msg.text}
        </div>
      )}

      {/* Perfil */}
      {tab === "perfil" && (
        <form onSubmit={saveProfile} className="space-y-4 rounded-xl p-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div>
            <label className="text-xs uppercase tracking-wider mb-1.5 block"
              style={{ color: "var(--text3)" }}>Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className={inp} style={inpStyle}
              onFocus={e => (e.target.style.borderColor = "var(--gold)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider mb-1.5 block"
              style={{ color: "var(--text3)" }}>Usuário / E-mail</label>
            <input value={email} onChange={e => setEmail(e.target.value)} required
              className={inp} style={inpStyle}
              onFocus={e => (e.target.style.borderColor = "var(--gold)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")} />
          </div>
          <button type="submit" disabled={loading}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--gold)", color: "#000" }}>
            {loading ? "Salvando..." : "Salvar alterações"}
          </button>
        </form>
      )}

      {/* Senha */}
      {tab === "senha" && (
        <form onSubmit={savePassword} className="space-y-4 rounded-xl p-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div>
            <label className="text-xs uppercase tracking-wider mb-1.5 block"
              style={{ color: "var(--text3)" }}>Senha atual</label>
            <input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} required
              className={inp} style={inpStyle}
              onFocus={e => (e.target.style.borderColor = "var(--gold)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider mb-1.5 block"
              style={{ color: "var(--text3)" }}>Nova senha</label>
            <div className="relative">
              <input type={showNew ? "text" : "password"} value={newPass}
                onChange={e => setNewPass(e.target.value)} required
                className={inp + " pr-12"} style={inpStyle}
                onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")} />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                style={{ color: "var(--text3)" }} tabIndex={-1}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d={showNew
                      ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                </svg>
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider mb-1.5 block"
              style={{ color: "var(--text3)" }}>Confirmar nova senha</label>
            <input type={showNew ? "text" : "password"} value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)} required
              className={inp} style={inpStyle}
              onFocus={e => (e.target.style.borderColor = "var(--gold)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")} />
          </div>
          <button type="submit" disabled={loading}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--gold)", color: "#000" }}>
            {loading ? "Salvando..." : "Alterar senha"}
          </button>
        </form>
      )}
    </div>
  );
}
