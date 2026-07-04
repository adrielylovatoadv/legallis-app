import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import { getDataAsync as getData, saveDataAsync as saveData } from "@/lib/financeiro-data";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const { status } = await req.json();
  const d = await getData(tid);
  const v = d.variaveis.find(v => v.id === id);
  if (!v) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  v.status = status;
  await saveData(d, tid);
  return NextResponse.json(v);
}
