"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { getConfig, saveConfig, type ConfigEscritorio, type Socio } from "@/lib/financeiro";

export function ConfiguracaoView() {
  const [config, setConfig] = useState<ConfigEscritorio>({ tipo: "individual", socios: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok"|"err"; text: string } | null>(null);

  useEffect(() => { getConfig().then(c => { setConfig(c); setLoading(false); }); }, []);

  const addSocio = () => {
    const id = Math.random().toString(36).slice(2, 8);
    setConfig(c => ({ ...c, socios: [...c.socios, { id, nome: "", percentual: 0 }] }));
  };

  const removeSocio = (id: string) => setConfig(c => ({ ...c, socios: c.socios.filter(s => s.id !== id) }));

  const updateSocio = (id: string, field: keyof Socio, value: string | number) =>
    setConfig(c => ({ ...c, socios: c.socios.map(s => s.id === id ? { ...s, [field]: value } : s) }));

  const totalPct = config.socios.reduce((s, so) => s + (so.percentual || 0), 0);

  const save = async () => {
    setSaving(true);
    try {
      await saveConfig(config);
      setMsg({ type: "ok", text: "Configuração salva com sucesso." });
    } catch {
      setMsg({ type: "err", text: "Erro ao salvar." });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="py-8 text-center" style={{ color: "var(--text3)" }}>Carregando...</div>;

  const inpStyle = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" };

  return (
    <div className="space-y-6 max-w-2xl">
      {msg && (
        <div className="px-4 py-2.5 rounded-lg text-sm"
          style={{ background: msg.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.type === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, color: msg.type === "ok" ? "#4ade80" : "#f87171" }}>
          {msg.text}
        </div>
      )}

      <Card>
        <h2 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Tipo de Escritório</h2>
        <div className="flex gap-3">
          {([["individual","Escritório Individual"],["socios","Escritório com Sócios"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => setConfig(c => ({ ...c, tipo: val }))}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all"
              style={{ background: config.tipo === val ? "rgba(201,168,76,0.15)" : "var(--surface2)", border: `2px solid ${config.tipo === val ? "var(--gold)" : "var(--border)"}`, color: config.tipo === val ? "var(--gold)" : "var(--text2)" }}>
              {val === "individual" ? "👤" : "👥"} {label}
            </button>
          ))}
        </div>
      </Card>

      {config.tipo === "socios" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>Sócias / Sócios</h2>
            <button onClick={addSocio} className="px-3 py-1.5 rounded-lg text-sm font-semibold"
              style={{ background: "var(--gold)", color: "#000" }}>+ Adicionar</button>
          </div>

          {config.socios.length === 0 && (
            <p className="text-sm py-4 text-center" style={{ color: "var(--text3)" }}>Nenhum sócio cadastrado.</p>
          )}

          <div className="space-y-3">
            {config.socios.map(s => (
              <div key={s.id} className="flex gap-3 items-center">
                <input value={s.nome} onChange={e => updateSocio(s.id, "nome", e.target.value)}
                  placeholder="Nome do sócio" className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={inpStyle} />
                <div className="flex items-center gap-1.5 shrink-0">
                  <input type="number" value={s.percentual} onChange={e => updateSocio(s.id, "percentual", parseFloat(e.target.value) || 0)}
                    min="0" max="100" step="0.5" placeholder="%" className="w-20 px-3 py-2 rounded-lg text-sm outline-none" style={inpStyle} />
                  <span className="text-sm" style={{ color: "var(--text3)" }}>%</span>
                </div>
                <button onClick={() => removeSocio(s.id)} className="p-2 rounded-lg hover:bg-red-500/10" style={{ color: "#f87171" }}>🗑</button>
              </div>
            ))}
          </div>

          {config.socios.length > 0 && (
            <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm" style={{ color: "var(--text3)" }}>Total de participação:</span>
              <span className="font-semibold text-sm" style={{ color: totalPct === 100 ? "#4ade80" : "#f87171" }}>
                {totalPct.toFixed(1)}% {totalPct !== 100 && "(deve ser 100%)"}
              </span>
            </div>
          )}
        </Card>
      )}

      {config.tipo === "socios" && config.socios.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-3" style={{ color: "var(--text)" }}>📊 Demonstrativo de distribuição</h2>
          <p className="text-xs mb-4" style={{ color: "var(--text3)" }}>
            Com base na configuração atual, os honorários serão distribuídos da seguinte forma:
          </p>
          <div className="space-y-2">
            {config.socios.filter(s => s.nome).map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-lg"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <span className="flex-1 text-sm font-medium" style={{ color: "var(--text)" }}>{s.nome}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 rounded-full" style={{ width: `${s.percentual * 1.5}px`, maxWidth: "120px", background: "var(--gold)", minWidth: "4px" }} />
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--gold)" }}>{s.percentual}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <button onClick={save} disabled={saving}
        className="px-6 py-2.5 rounded-xl font-semibold text-sm"
        style={{ background: saving ? "var(--surface2)" : "var(--gold)", color: saving ? "var(--text3)" : "#000" }}>
        {saving ? "Salvando..." : "Salvar configuração"}
      </button>
    </div>
  );
}
