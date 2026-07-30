"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { fmtBRL, COLS, statusBadge, statusLabel } from "@/lib/financeiro";
import { MetricCard as MetricCardBase, Card, Input as Inp } from "@/components/ui";
import { exportarReciboRepasse } from "@/lib/export-recibo";

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
// Chave normalizada (minúsculo/sem espaços) — registros lançados por campo de texto livre
// (ex.: painel financeiro dentro de Controle Processual) podem ter "mes" com caixa diferente
// da lista fixa (ex.: "jul/2026" em vez de "Jul/2026") e não podem virar órfãos no fim da lista.
const normMes = (m: string) => (m || "").trim().toLowerCase();
const MESES_IDX = Object.fromEntries(MESES.map((m, i) => [normMes(m), i]));
export function sortByMesDesc<T extends { mes: string; data_pagamento?: string; criado_em?: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const mi = (MESES_IDX[normMes(b.mes)] ?? -1) - (MESES_IDX[normMes(a.mes)] ?? -1);
    if (mi !== 0) return mi;
    // Prioriza o momento em que o registro foi feito (mais recente primeiro) — cai para
    // data_pagamento só em tipos que ainda não guardam criado_em (execuções, honorários).
    if (a.criado_em || b.criado_em) return (b.criado_em || "").localeCompare(a.criado_em || "");
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

// ── recibo de repasse ao cliente (acordos e execuções) ──────────────────────
interface EmpresaPerfil {
  name?: string;
  oab?: Array<{ state: string; number: string }>;
  company?: { name?: string; cnpj?: string; address?: string };
}

function cidadeDoEndereco(endereco?: string): string {
  if (!endereco) return "";
  const antesDoUf = endereco.split("-")[0];
  const partes = antesDoUf.split(",").map(p => p.trim()).filter(Boolean);
  return partes[partes.length - 1] || "";
}

export function ReciboRepasseModal({ cliente, processo, referente, valorSugerido, onClose }: {
  cliente: string; processo?: string; referente: string; valorSugerido: number; onClose: () => void;
}) {
  const { data: session } = useSession();
  const [perfil, setPerfil] = useState<EmpresaPerfil | null>(null);
  const [valor, setValor] = useState(valorSugerido);
  const [data, setData] = useState(() => new Date().toLocaleDateString("pt-BR"));
  const [local, setLocal] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [refText, setRefText] = useState(referente);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/usuarios/${session.user.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setPerfil(d); setLocal(cidadeDoEndereco(d.company?.address)); } })
      .catch(() => {});
  }, [session?.user?.id]);

  const gerar = async () => {
    if (!(valor > 0)) { setErro("Informe o valor repassado."); return; }
    setGerando(true); setErro("");
    try {
      const oab = perfil?.oab?.map(o => `OAB/${o.state} ${o.number}`).join(" · ");
      await exportarReciboRepasse({
        empresa: { nome: perfil?.company?.name, cnpj: perfil?.company?.cnpj, endereco: perfil?.company?.address },
        advogado: perfil?.name ? { nome: perfil.name, oab } : undefined,
        cliente, cpfCnpj: cpfCnpj || undefined, valor, referente: refText,
        processo, formaPagamento: formaPagamento || undefined, local, data,
      }, `recibo_repasse_${cliente.replace(/\s+/g, "_").toLowerCase()}`);
      onClose();
    } catch { setErro("Erro ao gerar recibo."); }
    finally { setGerando(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <Card>
          <h2 className="font-semibold text-base mb-1" style={{ color: "var(--text)" }}>🧾 Emitir recibo de repasse</h2>
          <p className="text-xs mb-4" style={{ color: "var(--text3)" }}>
            Gera um PDF com 2 vias idênticas (escritório e cliente) para assinatura na entrega do valor.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Cliente</span>
              <Inp value={cliente} disabled />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Valor repassado (R$)</span>
              <Inp type="number" step="0.01" min="0" value={valor || ""} onChange={e => setValor(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Data</span>
              <Inp value={data} onChange={e => setData(e.target.value)} placeholder="DD/MM/AAAA" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Local</span>
              <Inp value={local} onChange={e => setLocal(e.target.value)} placeholder="Cidade" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Forma de pagamento</span>
              <Inp value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} placeholder="PIX, transferência..." />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>CPF/CNPJ do cliente</span>
              <Inp value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)} placeholder="opcional" />
            </div>
            <div className="col-span-2">
              <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>Referente a</span>
              <Inp value={refText} onChange={e => setRefText(e.target.value)} />
            </div>
          </div>
          {erro && <p className="text-xs mt-2" style={{ color: "#f87171" }}>{erro}</p>}
          <div className="flex gap-3 mt-4">
            <button onClick={gerar} disabled={gerando}
              className="px-5 py-2 rounded-lg font-semibold text-sm disabled:opacity-60"
              style={{ background: "var(--gold)", color: "#000" }}>
              {gerando ? "Gerando..." : "Gerar recibo (2 vias)"}
            </button>
            <button onClick={onClose} className="px-5 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>
              Cancelar
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
