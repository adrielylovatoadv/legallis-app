import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import { fixaUpdateSchema } from "@/lib/validation/financeiro";
import { parseBody } from "@/lib/validation/helpers";
import * as fixasRepo from "@/lib/repo/fixas";

type Params = { params: Promise<{ categoria: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { categoria } = await params;
  const cat = decodeURIComponent(categoria);
  const { data: body, error } = parseBody(fixaUpdateSchema, await req.json());
  if (error) return error;

  const atual = await fixasRepo.get(tid, cat);
  if (!atual) return NextResponse.json({ error: "not found" }, { status: 404 });

  const targetCat = body.nova_categoria && body.nova_categoria !== cat ? body.nova_categoria : cat;
  if (targetCat !== cat) await fixasRepo.rename(tid, cat, targetCat);

  await fixasRepo.upsert(tid, targetCat, {
    quem: body.quem ?? atual.quem,
    valores: body.valores ?? atual.valores,
    valor_fixo: body.valor_fixo !== undefined ? Number(body.valor_fixo) : atual.valor_fixo,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { categoria } = await params;
  await fixasRepo.remove(tid, decodeURIComponent(categoria));
  return NextResponse.json({ ok: true });
}
