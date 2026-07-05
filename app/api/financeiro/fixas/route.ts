import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import { newId } from "@/lib/financeiro-data";
import { fixaCreateSchema } from "@/lib/validation/financeiro";
import { parseBody } from "@/lib/validation/helpers";
import * as fixasRepo from "@/lib/repo/fixas";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  return NextResponse.json(await fixasRepo.list(tid));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { data: body, error } = parseBody(fixaCreateSchema, await req.json());
  if (error) return error;
  const cat = body.categoria || `Despesa ${newId()}`;
  await fixasRepo.create(tid, { categoria: cat, quem: body.quem, valores: body.valores, valor_fixo: body.valor_fixo });
  return NextResponse.json({ categoria: cat });
}
