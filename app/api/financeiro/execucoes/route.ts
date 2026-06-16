import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData, newId, calcExecucao } from "@/lib/financeiro-data";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const d = await getData(tid); return NextResponse.json(d.execucoes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const body = await req.json();
  const d = await getData(tid);
  const exec = {
    ...body,
    id: newId(),
    honorarios: calcExecucao(
      body.valor_percebido || 0,
      body.sucumbencia || 0,
      body.tipo_execucao,
      body.pct_honorarios
    ),
    repasse_cliente: body.tipo_execucao !== "honorarios_somente" && body.valor_percebido > 0
      ? Math.round(body.valor_percebido * (1 - (body.pct_honorarios ?? 35) / 100) * 100) / 100
      : 0,
  };
  d.execucoes.push(exec);
  await saveData(d, tid);
  return NextResponse.json(exec, { status: 201 });
}
