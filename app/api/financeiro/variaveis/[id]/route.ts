import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import { getDataAsync as getData, saveDataAsync as saveData } from "@/lib/financeiro-data";
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
  const d = await getData(tid);
  const idx = d.variaveis.findIndex(v => v.id === id);
  if (idx === -1) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  d.variaveis[idx] = { ...d.variaveis[idx], ...body };
  await saveData(d, tid);
  return NextResponse.json(d.variaveis[idx]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const d = await getData(tid);
  d.variaveis = d.variaveis.filter(v => v.id !== id);
  await saveData(d, tid);
  return NextResponse.json({ ok: true });
}
