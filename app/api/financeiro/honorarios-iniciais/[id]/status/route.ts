import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData } from "@/lib/financeiro-data";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const { status } = await req.json();
  const d = await getData(tid);
  const h = d.honorarios_iniciais.find(h => h.id === id);
  if (!h) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  h.status = status;
  await saveData(d, tid);
  return NextResponse.json(h);
}
