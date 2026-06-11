"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function EmpresaPage() {
  const { data: session } = useSession();
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/usuarios/${session?.user?.id}`);
      if (res.ok) {
        const u = await res.json();
        setCompanyName(u.company?.name ?? "");
        setCnpj(u.company?.cnpj ?? "");
        setAddress(u.company?.address ?? "");
      }
    };
    if (session?.user?.id) load();
  }, [session?.user?.id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    const res = await fetch(`/api/usuarios/${session?.user?.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: { name: companyName, cnpj, address } }),
    });
    setLoading(false);
    if (res.ok) setMsg({ type: "ok", text: "Dados da empresa salvos." });
    else setMsg({ type: "err", text: "Erro ao salvar." });
  };

  const inp = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors";
  const inpStyle = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" };

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="rounded-2xl p-6 space-y-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold" style={{ color: "var(--text)" }}>Dados da Empresa</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Nome da empresa / escritório</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)}
              placeholder="Lovato & Estevão Advocacia" className={inp} style={inpStyle}
              onFocus={e => (e.target.style.borderColor = "var(--gold)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>
              CNPJ <span style={{ color: "var(--text3)" }}>(opcional)</span>
            </label>
            <input value={cnpj} onChange={e => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00" className={inp} style={inpStyle}
              onFocus={e => (e.target.style.borderColor = "var(--gold)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Endereço</label>
            <input value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Rua, número, cidade - UF" className={inp} style={inpStyle}
              onFocus={e => (e.target.style.borderColor = "var(--gold)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")} />
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
          className="px-6 py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: "var(--gold)", color: "#000", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Salvando..." : "Salvar empresa"}
        </button>
      </form>
    </div>
  );
}
