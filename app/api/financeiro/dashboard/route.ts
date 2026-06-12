import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, COLS, MESES } from "@/lib/financeiro-data";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const d = await getData(tid);

  const receitasPagas = [
    ...d.acordos.filter(a => a.status !== "pendente").map(a => ({ mes: a.mes, valor: a.honorarios })),
    ...d.execucoes.filter(e => e.status !== "pendente").map(e => ({ mes: e.mes, valor: e.honorarios })),
    ...d.honorarios_iniciais.filter(h => h.status === "pago").map(h => ({ mes: "Hon.Iniciais", valor: h.valor })),
  ];
  const receitasPendentes = [
    ...d.acordos.filter(a => a.status === "pendente").map(a => ({ tipo: "acordo", cliente: a.cliente, mes: a.mes, valor: a.honorarios })),
    ...d.execucoes.filter(e => e.status === "pendente").map(e => ({ tipo: "execucao", cliente: e.cliente, mes: e.mes, valor: e.honorarios })),
    ...d.honorarios_iniciais.filter(h => h.status === "pendente").map(h => ({ tipo: "inicial", cliente: h.cliente, mes: "", valor: h.valor, observacao: h.observacao })),
  ];

  const total_recebido = receitasPagas.reduce((s, r) => s + r.valor, 0);
  const total_pendente = receitasPendentes.reduce((s, r) => s + r.valor, 0);

  let total_fixas = 0;
  for (const cat of Object.keys(d.fixas)) {
    for (const col of COLS) {
      total_fixas += d.fixas[cat]?.[col] || 0;
    }
  }

  const total_variaveis = d.variaveis.reduce((s, v) => s + v.valor, 0);
  const saldo = total_recebido - total_fixas - total_variaveis;

  const mesMap: Record<string, { honorarios: number; fixas: number; variaveis: number }> = {};
  const ensureMes = (m: string) => {
    if (!mesMap[m]) mesMap[m] = { honorarios: 0, fixas: 0, variaveis: 0 };
  };

  for (const a of d.acordos) {
    ensureMes(a.mes);
    if (a.status !== "pendente") mesMap[a.mes].honorarios += a.honorarios;
  }
  for (const e of d.execucoes) {
    ensureMes(e.mes);
    if (e.status !== "pendente") mesMap[e.mes].honorarios += e.honorarios;
  }

  const COL_TO_MES: Record<string, string> = {
    "Out":"Out/2025","Nov":"Nov/2025","Dez":"Dez/2025",
    "Jan":"Jan/2026","Fev":"Fev/2026","Mar":"Mar/2026","Abr":"Abr/2026",
    "Mai":"Mai/2026","Jun":"Jun/2026","Jul":"Jul/2026","Ago":"Ago/2026",
    "Set":"Set/2026","Out2":"Out/2026","Nov2":"Nov/2026","Dez2":"Dez/2026",
  };

  for (const cat of Object.keys(d.fixas)) {
    for (const col of COLS) {
      const val = d.fixas[cat]?.[col] || 0;
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
      return { mes: m, honorarios: r.honorarios, fixas: r.fixas, variaveis: r.variaveis, saldo: r.honorarios - r.fixas - r.variaveis };
    });

  return NextResponse.json({ total_recebido, total_pendente, total_fixas, total_variaveis, saldo, resumo_mes, pendentes: receitasPendentes });
}
