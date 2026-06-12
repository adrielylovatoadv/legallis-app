import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData } from "@/lib/controle-data";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const data = await getData(tid);
  const idx = data.processos.findIndex(x => x.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  data.processos[idx] = {
    ...data.processos[idx],
    data: "", hora: "", andamento: "AGUARDANDO DESPACHO", responsavel: "", dashboard_ok: true,
  };
  await saveData(data, tid);
  return NextResponse.json(data.processos[idx]);
}
