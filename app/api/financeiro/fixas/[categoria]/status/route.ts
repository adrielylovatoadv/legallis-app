import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import * as fixasRepo from "@/lib/repo/fixas";

type Params = { params: Promise<{ categoria: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { categoria } = await params;
  const cat = decodeURIComponent(categoria);
  const { col, status } = await req.json();
  await fixasRepo.setStatus(tid, cat, col, status);
  return NextResponse.json({ ok: true });
}
