import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import { getDataAsync as getData, saveDataAsync as saveData } from "@/lib/financeiro-data";

type Params = { params: Promise<{ categoria: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { categoria } = await params;
  const cat = decodeURIComponent(categoria);
  const { col, status } = await req.json();
  const d = await getData(tid);
  if (!d.fixas_status) d.fixas_status = {};
  if (!d.fixas_status[cat]) d.fixas_status[cat] = {};
  d.fixas_status[cat][col] = status;
  await saveData(d, tid);
  return NextResponse.json({ ok: true });
}
