import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import { calcExecucao, resolveSucumbencia, calcRepasseExecucao } from "@/lib/financeiro-data";
import * as execucoesRepo from "@/lib/repo/execucoes";
import { execucaoCreateSchema } from "@/lib/validation/financeiro";
import { parseBody } from "@/lib/validation/helpers";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const lista = await execucoesRepo.list(tid);
  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { data: body, error } = parseBody(execucaoCreateSchema, await req.json());
  if (error) return error;
  // Sucumbência: em % arbitrado pelo juiz (incide sobre o valor percebido) ou em R$ fixado por equidade.
  // O honorário contratual incide sobre o valor percebido e a sucumbência entra por cima.
  const sucumbencia = resolveSucumbencia(body.tipo_execucao, body.valor_percebido, body.pct_sucumbencia, body.sucumbencia);
  const exec = await execucoesRepo.create(tid, {
    ...body,
    sucumbencia,
    honorarios: calcExecucao(body.valor_percebido, sucumbencia, body.tipo_execucao, body.pct_honorarios),
    repasse_cliente: body.tipo_execucao !== "honorarios_somente" && body.valor_percebido > 0
      ? calcRepasseExecucao(body.valor_percebido, body.pct_honorarios)
      : 0,
  });
  return NextResponse.json(exec, { status: 201 });
}
