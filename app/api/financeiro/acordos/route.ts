import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import { calcAcordo } from "@/lib/financeiro-data";
import * as acordosRepo from "@/lib/repo/acordos";
import { acordoCreateSchema } from "@/lib/validation/financeiro";
import { parseBody } from "@/lib/validation/helpers";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const lista = await acordosRepo.list(tid);
  const acordos = lista.map(a => ({ ...a, honorarios: a.honorarios || calcAcordo(a.valor_acordo || 0, a.pct_honorarios) }));
  return NextResponse.json(acordos);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { data: body, error } = parseBody(acordoCreateSchema, await req.json());
  if (error) return error;
  const acordo = await acordosRepo.create(tid, { ...body, honorarios: calcAcordo(body.valor_acordo, body.pct_honorarios) });
  return NextResponse.json(acordo, { status: 201 });
}
