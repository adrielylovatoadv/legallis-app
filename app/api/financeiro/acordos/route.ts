import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import { getDataAsync as getData, saveDataAsync as saveData, newId, calcAcordo } from "@/lib/financeiro-data";
import { acordoCreateSchema } from "@/lib/validation/financeiro";
import { parseBody } from "@/lib/validation/helpers";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const d = await getData(tid);
  const acordos = d.acordos.map(a => ({ ...a, honorarios: a.honorarios || calcAcordo(a.valor_acordo || 0) }));
  return NextResponse.json(acordos);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { data: body, error } = parseBody(acordoCreateSchema, await req.json());
  if (error) return error;
  const d = await getData(tid);
  const acordo = { ...body, id: newId(), honorarios: calcAcordo(body.valor_acordo) };
  d.acordos.push(acordo);
  await saveData(d, tid);
  return NextResponse.json(acordo, { status: 201 });
}
