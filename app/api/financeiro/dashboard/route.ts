import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, COLS, MESES } from "@/lib/financeiro-data";

const COL_TO_MES: Record<string, string> = {
  "Out":"Out/2025","Nov":"Nov/2025","Dez":"Dez/2025",
  "Jan":"Jan/2026","Fev":"Fev/2026","Mar":"Mar/2026","Abr":"Abr/2026",
  "Mai":"Mai/2026","Jun":"Jun/2026","Jul":"Jul/2026","Ago":"Ago/2026",
  "Set":"Set/2026","Out2":"Out/2026","Nov2":"Nov/2026","Dez2":"Dez/2026",
};

function r2(v: number) { return Math.round(v * 100) / 100; }

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const d = await getData(tid);

  // Receitas recebidas (não pendentes)
  const receitasPagas = [
    ...d.acordos.filter(a => a.status !== "pendente").map(a => ({ mes: a.mes, valor: a.honorarios })),
    ...d.execucoes.filter(e => e.status !== "pendente").map(e => ({ mes: e.mes, valor: e.honorarios })),
    ...d.honorarios_iniciais.filter(h => h.status === "pago").map(h => ({ mes: h.mes || "", valor: h.valor })),
  ];

  // Receitas pendentes
  const receitasPendentes = [
    ...d.acordos.filter(a => a.status === "pendente").map(a => ({ tipo: "acordo", cliente: a.cliente, mes: a.mes, valor: a.honorarios, processo: a.processo })),
    ...d.execucoes.filter(e => e.status === "pendente").map(e => ({ tipo: "execucao", cliente: e.cliente, mes: e.mes, valor: e.honorarios, processo: e.processo })),
    ...d.honorarios_iniciais.filter(h => h.status === "pendente").map(h => ({ tipo: "inicial", cliente: h.cliente, mes: h.mes || "", valor: h.valor, observacao: h.observacao })),
  ];

  const total_recebido = r2(receitasPagas.reduce((s, r) => s + r.valor, 0));
  const total_pendente = r2(receitasPendentes.reduce((s, r) => s + r.valor, 0));

  let total_fixas = 0;
  for (const cat of Object.keys(d.fixas)) {
    for (const col of COLS) {
      const fixo = d.fixas_valor_fixo?.[cat] || 0;
      total_fixas += fixo > 0 ? fixo : (d.fixas[cat]?.[col] || 0);
    }
  }
  total_fixas = r2(total_fixas);

  const total_variaveis = r2(d.variaveis.reduce((s, v) => s + v.valor, 0));
  const saldo = r2(total_recebido - total_fixas - total_variaveis);

  // Balanço por mês — inclui TODOS os registros (recebidos + pendentes)
  type MesRow = { honorarios_recebido: number; honorarios_pendente: number; fixas: number; variaveis: number };
  const mesMap: Record<string, MesRow> = {};
  const ensureMes = (m: string) => {
    if (m && !mesMap[m]) mesMap[m] = { honorarios_recebido: 0, honorarios_pendente: 0, fixas: 0, variaveis: 0 };
  };

  for (const a of d.acordos) {
    if (!a.mes) continue;
    ensureMes(a.mes);
    if (a.status !== "pendente") mesMap[a.mes].honorarios_recebido += a.honorarios;
    else mesMap[a.mes].honorarios_pendente += a.honorarios;
  }
  for (const e of d.execucoes) {
    if (!e.mes) continue;
    ensureMes(e.mes);
    if (e.status !== "pendente") mesMap[e.mes].honorarios_recebido += e.honorarios;
    else mesMap[e.mes].honorarios_pendente += e.honorarios;
  }
  for (const h of d.honorarios_iniciais) {
    const mes = h.mes || "";
    if (!mes) continue;
    ensureMes(mes);
    if (h.status === "pago") mesMap[mes].honorarios_recebido += h.valor;
    else mesMap[mes].honorarios_pendente += h.valor;
  }

  for (const cat of Object.keys(d.fixas)) {
    const fixo = d.fixas_valor_fixo?.[cat] || 0;
    for (const col of COLS) {
      const val = fixo > 0 ? fixo : (d.fixas[cat]?.[col] || 0);
      if (val > 0) {
        const mes = COL_TO_MES[col];
        if (mes) { ensureMes(mes); mesMap[mes].fixas += val; }
      }
    }
  }

  for (const v of d.variaveis) {
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
      const fixas = r2(r.fixas);
      const variaveis = r2(r.variaveis);
      return {
        mes: m,
        honorarios,
        honorarios_pendente,
        fixas,
        variaveis,
        saldo: r2(honorarios - fixas - variaveis),
      };
    });

  return NextResponse.json({
    total_recebido, total_pendente, total_fixas, total_variaveis, saldo,
    resumo_mes, pendentes: receitasPendentes,
  });
}
