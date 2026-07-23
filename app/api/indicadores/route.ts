import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isFinalizado } from "@/lib/controle-data";
import { calcAcordo, MESES } from "@/lib/financeiro-data";
import * as acordosRepo from "@/lib/repo/acordos";
import * as execucoesRepo from "@/lib/repo/execucoes";
import * as honorariosRepo from "@/lib/repo/honorarios-iniciais";
import * as processosRepo from "@/lib/repo/processos";
import * as clientesRepo from "@/lib/repo/clientes";
import * as iniciaisRepo from "@/lib/repo/iniciais";

function countBy<T>(items: T[], keyFn: (i: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = keyFn(item) || "—";
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function topNComOutros(counts: Record<string, number>, n: number) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, n);
  const outros = entries.slice(n).reduce((s, [, v]) => s + v, 0);
  const result = top.map(([nome, valor]) => ({ nome, valor }));
  if (outros > 0) result.push({ nome: "Outros", valor: outros });
  return result;
}

function mesAno(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;

  const [processos, clientes, iniciais, acordosRaw, execucoes, honorarios_iniciais] = await Promise.all([
    processosRepo.list(tid), clientesRepo.list(tid), iniciaisRepo.list(tid),
    acordosRepo.list(tid), execucoesRepo.list(tid), honorariosRepo.list(tid),
  ]);

  const ativos = processos.filter(p => !isFinalizado(p));
  const iniciaisPendentes = iniciais.filter(
    i => !["PROTOCOLADO", "ARQUIVADO"].includes((i.andamento || "").toUpperCase().trim())
  );

  const processos_por_responsavel = Object.entries(countBy(ativos, p => p.responsavel || "Sem responsável"))
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);

  const iniciais_por_responsavel = Object.entries(countBy(iniciaisPendentes, i => i.responsavel || "Sem responsável"))
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);

  const processos_por_andamento = topNComOutros(countBy(ativos, p => p.andamento || "Sem andamento"), 6);

  // Casos criados por mês (últimos 6 meses), Processo + Inicial
  const hoje = new Date();
  const meses6: { chave: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses6.push({ chave: `${d.getFullYear()}-${d.getMonth()}`, label: mesAno(d.toISOString()) });
  }
  const chaveDe = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${d.getMonth()}`;
  };
  const criadosPorChave = countBy(
    [...processos.map(p => p.criado_em), ...iniciais.map(i => i.criado_em)].filter(Boolean),
    chaveDe
  );
  const casos_criados_por_mes = meses6.map(m => ({ mes: m.label, valor: criadosPorChave[m.chave] || 0 }));

  // Honorários recebidos por mês (mesma fonte usada em /api/financeiro/dashboard)
  const acordos = acordosRaw.map(a => ({ ...a, honorarios: a.honorarios || calcAcordo(a.valor_acordo || 0, a.pct_honorarios) }));
  const honorariosPorMes: Record<string, number> = {};
  const soma = (mes: string | undefined, valor: number, status: string) => {
    if (!mes || status === "pendente") return;
    honorariosPorMes[mes] = (honorariosPorMes[mes] || 0) + valor;
  };
  for (const a of acordos) soma(a.mes, a.honorarios, a.status);
  for (const e of execucoes) soma(e.mes, e.honorarios, e.status);
  for (const h of honorarios_iniciais) soma(h.mes, h.valor, h.status === "pago" ? "pago" : "pendente");
  const financeiro_por_mes = MESES.filter(m => honorariosPorMes[m] !== undefined)
    .map(m => ({ mes: m, valor: Math.round((honorariosPorMes[m] || 0) * 100) / 100 }));

  return NextResponse.json({
    total_processos_ativos: ativos.length,
    total_clientes: clientes.length,
    processos_por_responsavel,
    iniciais_por_responsavel,
    processos_por_andamento,
    casos_criados_por_mes,
    financeiro_por_mes,
  });
}
