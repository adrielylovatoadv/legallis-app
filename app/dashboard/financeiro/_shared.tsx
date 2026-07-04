import { fmtBRL, COLS, statusBadge, statusLabel } from "@/lib/financeiro";
import { MetricCard as MetricCardBase } from "@/components/ui";

export function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return <MetricCardBase label={label} value={fmtBRL(value)} color={color} />;
}

// ── botão de status cíclico ───────────────────────────────────────────────────
export function StatusBtn({ status, onClick, receita = true }: {
  status: string; onClick: () => void; receita?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${statusBadge(status)}`}>
      {statusLabel(status)}
    </button>
  );
}

// ── helpers de ordenação por mês ─────────────────────────────────────────────
import { MESES } from "@/lib/financeiro";
const MESES_IDX = Object.fromEntries(MESES.map((m, i) => [m, i]));
export function sortByMesDesc<T extends { mes: string; data_pagamento?: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const mi = (MESES_IDX[b.mes] ?? -1) - (MESES_IDX[a.mes] ?? -1);
    if (mi !== 0) return mi;
    return (b.data_pagamento || "").localeCompare(a.data_pagamento || "");
  });
}

// ── detectar mês atual no array COLS ─────────────────────────────────────────
export function getCurrentCol(): string {
  const now = new Date();
  const MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return MONTH_SHORT[now.getMonth()];
}

export function getColIndex(): number {
  const now = new Date();
  return now.getFullYear() * 12 + now.getMonth() - (2025 * 12 + 9);
}

// Fatura do cartão fecha no dia 11: compras a partir desse dia caem na fatura do mês seguinte
export function getBillingColIndex(): number {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (now.getDate() >= 11) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  return year * 12 + month - (2025 * 12 + 9);
}

export function getBillingCol(): string {
  const idx = getBillingColIndex();
  return idx >= 0 && idx < COLS.length ? COLS[idx] : "";
}

export function getCurrentMes(): string {
  const now = new Date();
  const M = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${M[now.getMonth()]}/${now.getFullYear()}`;
}

export function getNextMes(): string {
  const d = new Date(); d.setMonth(d.getMonth() + 1);
  const M = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${M[d.getMonth()]}/${d.getFullYear()}`;
}
