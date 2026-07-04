import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import { getDataAsync as getData, saveDataAsync as saveData, calcAcordo } from "@/lib/financeiro-data";
import { acordoUpdateSchema } from "@/lib/validation/financeiro";
import { parseBody } from "@/lib/validation/helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const { data: body, error } = parseBody(acordoUpdateSchema, await req.json());
  if (error) return error;
  const d = await getData(tid);
  const idx = d.acordos.findIndex(a => a.id === id);
  if (idx === -1) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const patch: typeof body & { honorarios?: number } = { ...body };
  if (patch.valor_acordo !== undefined) patch.honorarios = calcAcordo(patch.valor_acordo);
  d.acordos[idx] = { ...d.acordos[idx], ...patch };
  await saveData(d, tid);
  return NextResponse.json(d.acordos[idx]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const d = await getData(tid);
  d.acordos = d.acordos.filter(a => a.id !== id);
  await saveData(d, tid);
  return NextResponse.json({ ok: true });
}
