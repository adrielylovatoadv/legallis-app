import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import * as variaveis from "@/lib/repo/variaveis";
import { variavelUpdateSchema } from "@/lib/validation/financeiro";
import { parseBody } from "@/lib/validation/helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const { data: body, error } = parseBody(variavelUpdateSchema, await req.json());
  if (error) return error;
  const v = await variaveis.update(tid, id, body);
  if (!v) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(v);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  await variaveis.remove(tid, id);
  return NextResponse.json({ ok: true });
}
