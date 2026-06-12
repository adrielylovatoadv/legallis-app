"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Diag {
  banco: string;
  timestamp: string;
  schema?: string;
  escrita?: string;
  dados_presentes?: string[];
  status: string;
  erro?: string;
}

export default function DiagnosticoPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [diag, setDiag] = useState<Diag | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || session?.user?.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/diagnostico");
      setDiag(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { run(); }, []);

  if (status === "loading" || session?.user?.role !== "admin") return null;

  const ok = diag?.status?.startsWith("✓");

  return (
    <div className="max-w-xl mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Diagnóstico do Sistema</h1>
        <button onClick={run} disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--gold)", color: "#000", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Verificando..." : "↺ Testar novamente"}
        </button>
      </div>

      {diag && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {/* Status geral */}
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>
            <span className="text-2xl">{ok ? "✅" : "❌"}</span>
            <span className="font-semibold text-sm" style={{ color: ok ? "#4ade80" : "#f87171" }}>{diag.status}</span>
          </div>

          {/* Detalhes */}
          <div className="space-y-3">
            <Row label="Armazenamento" value={diag.banco} />
            {diag.schema && <Row label="Estrutura" value={diag.schema} />}
            {diag.escrita && <Row label="Leitura/Escrita" value={diag.escrita} />}
            {diag.dados_presentes && (
              <Row label="Dados no banco" value={diag.dados_presentes.join(", ")} />
            )}
            <Row label="Verificado em" value={new Date(diag.timestamp).toLocaleString("pt-BR")} />
            {diag.erro && (
              <div className="p-3 rounded-lg text-xs font-mono" style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                {diag.erro}
              </div>
            )}
          </div>
        </div>
      )}

      {loading && !diag && (
        <div className="text-center py-10 text-sm" style={{ color: "var(--text3)" }}>Verificando conexão...</div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const isOk = value.startsWith("✓");
  const isFail = value.startsWith("✗");
  return (
    <div className="flex items-start justify-between gap-4 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
      <span className="text-sm" style={{ color: "var(--text3)" }}>{label}</span>
      <span className="text-sm font-medium text-right" style={{ color: isOk ? "#4ade80" : isFail ? "#f87171" : "var(--text2)" }}>{value}</span>
    </div>
  );
}
