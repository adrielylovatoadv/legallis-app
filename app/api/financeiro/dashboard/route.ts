import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import { COLS, COL_TO_MES, MESES, calcAcordo, getCurrentColIndex } from "@/lib/financeiro-data";
import * as acordosRepo from "@/lib/repo/acordos";
import * as execucoesRepo from "@/lib/repo/execucoes";
import * as honorariosRepo from "@/lib/repo/honorarios-iniciais";
import * as variaveisRepo from "@/lib/repo/variaveis";
import * as fixasRepo from "@/lib/repo/fixas";

function r2(v: number) { return Math.round(v * 100) / 100; }

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const [fixas, acordosRaw, execucoes, honorarios_iniciais, variaveis] = await Promise.all([
    fixasRepo.list(tid), acordosRepo.list(tid), execucoesRepo.list(tid), honorariosRepo.list(tid), variaveisRepo.list(tid),
  ]);
  // Alguns acordos antigos têm "honorarios" zerado mesmo com valor_acordo preenchido —
  // recalcula na hora, igual a rota /api/financeiro/acordos já faz.
  const acordos = acordosRaw.map(a => ({ ...a, honorarios: a.honorarios || calcAcordo(a.valor_acordo || 0, a.pct_honorarios) }));

  // Receitas recebidas (não pendentes)
  const receitasPagas = [
    ...acordos.filter(a => a.status !== "pendente").map(a => ({ mes: a.mes, valor: a.honorarios })),
    ...execucoes.filter(e => e.status !== "pendente").map(e => ({ mes: e.mes, valor: e.honorarios })),
    ...honorarios_iniciais.filter(h => h.status === "pago").map(h => ({ mes: h.mes || "", valor: h.valor })),
  ];

  // Receitas pendentes
  const receitasPendentes = [
    ...acordos.filter(a => a.status === "pendente").map(a => ({ tipo: "acordo", cliente: a.cliente, mes: a.mes, valor: a.honorarios, processo: a.processo })),
    ...execucoes.filter(e => e.status === "pendente").map(e => ({ tipo: "execucao", cliente: e.cliente, mes: e.mes, valor: e.honorarios, processo: e.processo })),
    ...honorarios_iniciais.filter(h => h.status === "pendente").map(h => ({ tipo: "inicial", cliente: h.cliente, mes: h.mes || "", valor: h.valor, observacao: h.observacao })),
  ];

  const total_recebido = r2(receitasPagas.reduce((s, r) => s + r.valor, 0));
  const total_pendente = r2(receitasPendentes.reduce((s, r) => s + r.valor, 0));

  // COLS agora se estende bem à frente (nunca mais fica sem coluna), mas uma despesa fixa
  // *recorrente* (valor_fixo) não deve projetar meses futuros ainda não incorridos — só conta até
  // o mês corrente. Um valor lançado explicitamente para um mês específico (mesmo futuro) sempre conta.
  const idxAtual = getCurrentColIndex();
  const mesesAteHoje = COLS.reduce((n, _c, i) => n + (i <= idxAtual ? 1 : 0), 0);
  let total_fixas = 0;
  for (const f of fixas) {
    if (f.valor_fixo > 0) total_fixas += f.valor_fixo * mesesAteHoje;
    else for (const col of COLS) total_fixas += f.valores[col] || 0;
  }
  total_fixas = r2(total_fixas);

  const total_variaveis = r2(variaveis.reduce((s, v) => s + v.valor, 0));
  const saldo = r2(total_recebido - total_fixas - total_variaveis);

  // Balanço por mês — inclui TODOS os registros (recebidos + pendentes)
  type MesRow = { honorarios_recebido: number; honorarios_pendente: number; fixas: number; variaveis: number };
  const mesMap: Record<string, MesRow> = {};
  const ensureMes = (m: string) => {
    if (m && !mesMap[m]) mesMap[m] = { honorarios_recebido: 0, honorarios_pendente: 0, fixas: 0, variaveis: 0 };
  };

  for (const a of acordos) {
    if (!a.mes) continue;
    ensureMes(a.mes);
    if (a.status !== "pendente") mesMap[a.mes].honorarios_recebido += a.honorarios;
    else mesMap[a.mes].honorarios_pendente += a.honorarios;
  }
  for (const e of execucoes) {
    if (!e.mes) continue;
    ensureMes(e.mes);
    if (e.status !== "pendente") mesMap[e.mes].honorarios_recebido += e.honorarios;
    else mesMap[e.mes].honorarios_pendente += e.honorarios;
  }
  for (const h of honorarios_iniciais) {
    const mes = h.mes || "";
    if (!mes) continue;
    ensureMes(mes);
    if (h.status === "pago") mesMap[mes].honorarios_recebido += h.valor;
    else mesMap[mes].honorarios_pendente += h.valor;
  }

  for (const f of fixas) {
    if (f.valor_fixo > 0) {
      for (let i = 0; i <= idxAtual && i < COLS.length; i++) {
        const mes = COL_TO_MES[COLS[i]];
        if (mes) { ensureMes(mes); mesMap[mes].fixas += f.valor_fixo; }
      }
    } else {
      for (const col of COLS) {
        const val = f.valores[col] || 0;
        if (val > 0) {
          const mes = COL_TO_MES[col];
          if (mes) { ensureMes(mes); mesMap[mes].fixas += val; }
        }
      }
    }
  }

  for (const v of variaveis) {
    for (const [col, val] of Object.entries(v.meses || {})) {
      if (val > 0) {
        const mes = COL_TO_MES[col];
        if (mes) { ensureMes(mes); mesMap[mes].variaveis += val; }
      }
    }
  }

  const resumo_mes = MESES
    .filter(m => mesMap[m])
    .map(m => {
      const r = mesMap[m];
      const honorarios = r2(r.honorarios_recebido);
      const honorarios_pendente = r2(r.honorarios_pendente);
      const fixasMes = r2(r.fixas);
      const variaveisVal = r2(r.variaveis);
      return {
        mes: m,
        honorarios,
        honorarios_pendente,
        fixas: fixasMes,
        variaveis: variaveisVal,
        saldo: r2(honorarios - fixasMes - variaveisVal),
      };
    });

  return NextResponse.json({
    total_recebido, total_pendente, total_fixas, total_variaveis, saldo,
    resumo_mes, pendentes: receitasPendentes,
  });
}
