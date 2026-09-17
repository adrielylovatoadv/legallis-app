"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { fmtBRL, type DashFinanceiro } from "@/lib/financeiro";
import { MetricCard } from "./_shared";

type ResumoMesRow = DashFinanceiro["resumo_mes"][number];

function anoDoMes(mes: string): number {
  const ano = parseInt(mes.split("/")[1], 10);
  return Number.isFinite(ano) ? ano : 0;
}

function ResumoMesTable({ rows }: { rows: ResumoMesRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ borderBottom: "1px solid var(--border)" }}>
          {["Mês","Hon. Recebidos","Hon. Pendentes","Desp. Fixas","Desp. Variáveis","Saldo"].map(h => (
            <th key={h} className="pb-2 text-left pr-4 text-xs uppercase tracking-wider" style={{ color: "var(--text3)" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
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
  );
}

// Anos fora do ano corrente ficam minimizados por padrão — evita que o resumo cresça pra sempre
// conforme o histórico acumula (só o ano atual é aberto automaticamente).
function AnoColapsavel({ ano, rows }: { ano: number; rows: ResumoMesRow[] }) {
  const [aberto, setAberto] = useState(false);
  const saldoAno = rows.reduce((s, r) => s + r.saldo, 0);
  return (
    <div className="rounded-lg overflow-hidden mb-2" style={{ border: "1px solid var(--border)" }}>
      <button onClick={() => setAberto(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold"
        style={{ background: "var(--surface2)", color: "var(--text2)" }}>
        <span>{aberto ? "▲" : "▼"} {ano} ({rows.length} {rows.length === 1 ? "mês" : "meses"})</span>
        <span className="tabular-nums" style={{ color: saldoAno >= 0 ? "#C9A84C" : "#ef4444" }}>
          {saldoAno >= 0 ? "🟢" : "🔴"} {fmtBRL(saldoAno)}
        </span>
      </button>
      {aberto && (
        <div className="overflow-x-auto px-1 pb-1" style={{ background: "var(--surface)" }}>
          <ResumoMesTable rows={rows} />
        </div>
      )}
    </div>
  );
}

export function DashView({ data }: { data: DashFinanceiro }) {
  const anoAtual = new Date().getFullYear();
  const porAno = new Map<number, ResumoMesRow[]>();
  for (const r of data.resumo_mes) {
    const ano = anoDoMes(r.mes);
    if (!porAno.has(ano)) porAno.set(ano, []);
    porAno.get(ano)!.push(r);
  }
  const anosOrdenados = [...porAno.keys()].sort((a, b) => a - b);
  const anosAnteriores = anosOrdenados.filter(a => a < anoAtual);
  const anosFuturos = anosOrdenados.filter(a => a > anoAtual);
  const rowsAnoAtual = porAno.get(anoAtual) || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Honorários Recebidos" value={data.total_recebido} color="var(--success)" />
        <MetricCard label="Pendente de Recebimento" value={data.total_pendente} color="var(--danger)" />
        <MetricCard label="Desp. Fixas" value={data.total_fixas} color="var(--warning)" />
        <MetricCard label="Desp. Variáveis" value={data.total_variaveis} color="#a78bfa" />
        <MetricCard label="Saldo Líquido" value={data.saldo} color={data.saldo >= 0 ? "var(--gold)" : "var(--danger)"} />
      </div>

      {data.resumo_mes.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-4 text-sm uppercase tracking-wider" style={{ color: "var(--text3)" }}>Resumo por mês</h2>

          {anosAnteriores.length > 0 && (
            <div className="mb-3">
              {anosAnteriores.map(ano => <AnoColapsavel key={ano} ano={ano} rows={porAno.get(ano)!} />)}
            </div>
          )}

          {rowsAnoAtual.length > 0 && (
            <div className="overflow-x-auto">
              <ResumoMesTable rows={rowsAnoAtual} />
            </div>
          )}

          {anosFuturos.length > 0 && (
            <div className="mt-3">
              {anosFuturos.map(ano => <AnoColapsavel key={ano} ano={ano} rows={porAno.get(ano)!} />)}
            </div>
          )}
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
