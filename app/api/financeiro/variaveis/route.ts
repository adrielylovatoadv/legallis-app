import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import * as variaveis from "@/lib/repo/variaveis";
import { variavelCreateSchema } from "@/lib/validation/financeiro";
import { parseBody } from "@/lib/validation/helpers";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const lista = await variaveis.list(tid);
  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { data: body, error } = parseBody(variavelCreateSchema, await req.json());
  if (error) return error;
  const v = await variaveis.create(tid, body);
  return NextResponse.json(v, { status: 201 });
}
