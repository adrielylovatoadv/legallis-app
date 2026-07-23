import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import { calcAcordo } from "@/lib/financeiro-data";
import * as acordosRepo from "@/lib/repo/acordos";
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
  const current = await acordosRepo.get(tid, id);
  if (!current) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const patch: typeof body & { honorarios?: number } = { ...body };
  if (patch.valor_acordo !== undefined || patch.pct_honorarios !== undefined) {
    const valor = patch.valor_acordo ?? current.valor_acordo;
    const pct = patch.pct_honorarios ?? current.pct_honorarios;
    patch.honorarios = calcAcordo(valor, pct);
  }
  const acordo = await acordosRepo.update(tid, id, patch);
  if (!acordo) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(acordo);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  await acordosRepo.remove(tid, id);
  return NextResponse.json({ ok: true });
}
