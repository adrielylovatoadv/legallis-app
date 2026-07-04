import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import * as honorariosRepo from "@/lib/repo/honorarios-iniciais";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const { status } = await req.json();
  const h = await honorariosRepo.update(tid, id, { status });
  if (!h) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(h);
}
