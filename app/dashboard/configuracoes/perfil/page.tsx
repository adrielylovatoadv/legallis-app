"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

const BR_STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

interface OABEntry { state: string; number: string; }

export default function PerfilPage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sexo, setSexo] = useState<"feminino" | "masculino" | "">("");
  const [oabs, setOabs] = useState<OABEntry[]>([{ state: "MG", number: "" }]);
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"dados" | "senha">("dados");
  const [avatarUrl, setAvatarUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const res = await fetch(`/api/usuarios/${session?.user?.id}`);
      if (res.ok) {
        const u = await res.json();
        setName(u.name ?? "");
        setEmail(u.email ?? "");
        setPhone(u.phone ?? "");
        setSexo(u.sexo ?? "");
        setOabs(u.oab?.length ? u.oab : [{ state: "MG", number: "" }]);
        setAvatarUrl(u.avatar ?? "");
      }
    };
    if (session?.user?.id) loadProfile();
  }, [session?.user?.id]);

  const uploadAvatar = async (file: File) => {
    const fd = new FormData();
    fd.append("avatar", file);
    const res = await fetch(`/api/usuarios/${session?.user?.id}/avatar`, { method: "POST", body: fd });
    if (res.ok) {
      const { avatarUrl } = await res.json();
      setAvatarUrl(avatarUrl + "?t=" + Date.now());
      setMsg({ type: "ok", text: "Foto atualizada." });
    } else {
      const d = await res.json();
      setMsg({ type: "err", text: d.error ?? "Erro ao enviar foto." });
    }
  };

  const addOab = () => setOabs([...oabs, { state: "MG", number: "" }]);
  const removeOab = (i: number) => setOabs(oabs.filter((_, idx) => idx !== i));
  const updateOab = (i: number, field: keyof OABEntry, value: string) => {
    setOabs(oabs.map((o, idx) => idx === i ? { ...o, [field]: value } : o));
  };

  const saveDados = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    const res = await fetch(`/api/usuarios/${session?.user?.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, sexo: sexo || undefined, oab: oabs.filter(o => o.number) }),
    });
    setLoading(false);
    if (res.ok) { await update({ name, email }); setMsg({ type: "ok", text: "Perfil salvo com sucesso." }); }
    else setMsg({ type: "err", text: "Erro ao salvar perfil." });
  };

  const saveSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) { setMsg({ type: "err", text: "Senhas não conferem." }); return; }
    if (newPass.length < 6) { setMsg({ type: "err", text: "Mínimo 6 caracteres." }); return; }
    setLoading(true); setMsg(null);
    const checkRes = await fetch("/api/auth/verificar-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: session?.user?.email, password: currentPass }),
    });
    if (!checkRes.ok) { setLoading(false); setMsg({ type: "err", text: "Senha atual incorreta." }); return; }
    const res = await fetch(`/api/usuarios/${session?.user?.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPass }),
    });
    setLoading(false);
    if (res.ok) { setMsg({ type: "ok", text: "Senha alterada." }); setCurrentPass(""); setNewPass(""); setConfirmPass(""); }
    else setMsg({ type: "err", text: "Erro ao alterar senha." });
  };

  const inp = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors";
  const inpStyle = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" };

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Foto de Perfil</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold overflow-hidden"
            style={{ background: avatarUrl ? "transparent" : "rgba(201,168,76,0.15)", color: "var(--gold)", border: "2px solid var(--border)" }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              name.charAt(0).toUpperCase() || "U"
            )}
          </div>
          <div>
            <button onClick={() => fileRef.current?.click()}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}>
              Alterar foto
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
            <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>JPG, PNG ou GIF. Máx 2MB.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["dados", "senha"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: tab === t ? "var(--gold)" : "var(--surface2)",
              color: tab === t ? "#000" : "var(--text3)",
            }}>
            {t === "dados" ? "Dados Pessoais" : "Alterar Senha"}
          </button>
        ))}
      </div>

      {tab === "dados" && (
        <form onSubmit={saveDados} className="rounded-2xl p-6 space-y-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Nome completo</label>
              <input value={name} onChange={e => setName(e.target.value)} required className={inp} style={inpStyle}
                onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inp} style={inpStyle}
                onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Sexo</label>
              <select value={sexo} onChange={e => setSexo(e.target.value as "feminino" | "masculino" | "")}
                className={inp} style={inpStyle}
                onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")}>
                <option value="">Não informado</option>
                <option value="feminino">Feminino</option>
                <option value="masculino">Masculino</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Telefone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" className={inp} style={inpStyle}
                onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")} />
            </div>
          </div>

          {/* OAB */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text3)" }}>OAB</label>
              <button type="button" onClick={addOab}
                className="text-xs px-3 py-1 rounded-lg flex items-center gap-1 transition-colors"
                style={{ background: "var(--surface2)", color: "var(--gold)", border: "1px solid var(--border)" }}>
                + Adicionar OAB
              </button>
            </div>
            <div className="space-y-2">
              {oabs.map((oab, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={oab.state} onChange={e => updateOab(i, "state", e.target.value)}
                    className="px-3 py-3 rounded-xl text-sm outline-none"
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", width: "90px" }}>
                    {BR_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input value={oab.number} onChange={e => updateOab(i, "number", e.target.value)}
                    placeholder="Número da OAB" className={inp + " flex-1"} style={inpStyle}
                    onFocus={e => (e.target.style.borderColor = "var(--gold)")}
                    onBlur={e => (e.target.style.borderColor = "var(--border)")} />
                  {oabs.length > 1 && (
                    <button type="button" onClick={() => removeOab(i)}
                      className="p-2 rounded-lg transition-colors hover:bg-red-500/10" style={{ color: "#f87171" }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {msg && (
            <div className="text-sm px-4 py-2.5 rounded-lg"
              style={{
                background: msg.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${msg.type === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                color: msg.type === "ok" ? "#4ade80" : "#f87171",
              }}>
              {msg.text}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="px-6 py-2.5 rounded-xl font-semibold text-sm transition-opacity"
            style={{ background: "var(--gold)", color: "#000", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Salvando..." : "Salvar perfil"}
          </button>
        </form>
      )}

      {tab === "senha" && (
        <form onSubmit={saveSenha} className="rounded-2xl p-6 space-y-4 max-w-sm"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div>
            <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Senha atual</label>
            <input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} required className={inp} style={inpStyle}
              onFocus={e => (e.target.style.borderColor = "var(--gold)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Nova senha</label>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required minLength={6} className={inp} style={inpStyle}
              onFocus={e => (e.target.style.borderColor = "var(--gold)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Confirmar nova senha</label>
            <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required className={inp} style={inpStyle}
              onFocus={e => (e.target.style.borderColor = "var(--gold)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")} />
          </div>

          {msg && (
            <div className="text-sm px-4 py-2.5 rounded-lg"
              style={{
                background: msg.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${msg.type === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                color: msg.type === "ok" ? "#4ade80" : "#f87171",
              }}>
              {msg.text}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="px-6 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: "var(--gold)", color: "#000", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Salvando..." : "Alterar senha"}
          </button>
        </form>
      )}
    </div>
  );
}
