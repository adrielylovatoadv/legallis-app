import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import { getDataAsync as getData, saveDataAsync as saveData, newId, calcExecucao } from "@/lib/financeiro-data";
import { execucaoCreateSchema } from "@/lib/validation/financeiro";
import { parseBody } from "@/lib/validation/helpers";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const d = await getData(tid); return NextResponse.json(d.execucoes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { data: body, error } = parseBody(execucaoCreateSchema, await req.json());
  if (error) return error;
  const d = await getData(tid);
  const exec = {
    ...body,
    id: newId(),
    honorarios: calcExecucao(
      body.valor_percebido,
      body.sucumbencia,
      body.tipo_execucao,
      body.pct_honorarios
    ),
    repasse_cliente: body.tipo_execucao !== "honorarios_somente" && body.valor_percebido > 0
      ? Math.round(body.valor_percebido * (1 - body.pct_honorarios / 100) * 100) / 100
      : 0,
  };
  d.execucoes.push(exec);
  await saveData(d, tid);
  return NextResponse.json(exec, { status: 201 });
}
