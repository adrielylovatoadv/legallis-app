import { Card } from "@/components/ui";
import { fmtBRL, type DashFinanceiro } from "@/lib/financeiro";
import { MetricCard } from "./_shared";

export function DashView({ data }: { data: DashFinanceiro }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Honorários Recebidos" value={data.total_recebido} color="#22c55e" />
        <MetricCard label="Pendente de Recebimento" value={data.total_pendente} color="#ef4444" />
        <MetricCard label="Desp. Fixas" value={data.total_fixas} color="#f97316" />
        <MetricCard label="Desp. Variáveis" value={data.total_variaveis} color="#a78bfa" />
        <MetricCard label="Saldo Líquido" value={data.saldo} color={data.saldo >= 0 ? "#C9A84C" : "#ef4444"} />
      </div>

      {data.resumo_mes.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-4 text-sm uppercase tracking-wider" style={{ color: "var(--text3)" }}>Resumo por mês</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Mês","Hon. Recebidos","Hon. Pendentes","Desp. Fixas","Desp. Variáveis","Saldo"].map(h => (
                    <th key={h} className="pb-2 text-left pr-4 text-xs uppercase tracking-wider" style={{ color: "var(--text3)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.resumo_mes.map(r => (
                  <tr key={r.mes} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2 pr-4 font-medium" style={{ color: "var(--text)" }}>{r.mes}</td>
                    <td className="py-2 pr-4 tabular-nums" style={{ color: "#22c55e" }}>{fmtBRL(r.honorarios)}</td>
                    <td className="py-2 pr-4 tabular-nums" style={{ color: (r.honorarios_pendente ?? 0) > 0 ? "#f87171" : "var(--text3)" }}>
                      {(r.honorarios_pendente ?? 0) > 0 ? fmtBRL(r.honorarios_pendente!) : "—"}
                    </td>
                    <td className="py-2 pr-4 tabular-nums" style={{ color: "#f97316" }}>{fmtBRL(r.fixas)}</td>
                    <td className="py-2 pr-4 tabular-nums" style={{ color: "#a78bfa" }}>{fmtBRL(r.variaveis)}</td>
                    <td className="py-2 tabular-nums font-semibold" style={{ color: r.saldo >= 0 ? "#C9A84C" : "#ef4444" }}>
                      {r.saldo >= 0 ? "🟢" : "🔴"} {fmtBRL(r.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data.pendentes.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-4" style={{ color: "#ef4444" }}>⚠️ Pendentes de Recebimento</h2>
          <div className="space-y-2">
            {data.pendentes.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg"
                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <div>
                  <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{p.cliente}</span>
                  {p.mes && <span className="ml-2 text-xs" style={{ color: "var(--text3)" }}>{p.mes}</span>}
                  {p.observacao && <span className="ml-2 text-xs" style={{ color: "var(--text3)" }}>{p.observacao}</span>}
                </div>
                <span className="tabular-nums font-semibold text-sm" style={{ color: "#ef4444" }}>{fmtBRL(p.valor)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
