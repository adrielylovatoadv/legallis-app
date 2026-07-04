import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import * as timesheets from "@/lib/repo/timesheets";
import { timesheetCreateSchema } from "@/lib/validation/financeiro";
import { parseBody } from "@/lib/validation/helpers";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const lista = await timesheets.list(tid);
  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { data: body, error } = parseBody(timesheetCreateSchema, await req.json());
  if (error) return error;
  const item = await timesheets.create(tid, body);
  return NextResponse.json(item, { status: 201 });
}
