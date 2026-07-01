import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync, saveDataAsync } from "@/lib/controle-data";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { index }: { index: number } = await req.json();
  const data = await getDataAsync(tid);
  const list = [...(data.finalizados_externos_sem_honor || [])];
  if (index < 0 || index >= list.length) return NextResponse.json({ error: "Índice inválido" }, { status: 400 });
  const entry = list[index];

  const proc = entry.processo
    ? data.processos.find(p => p.numero_processo === entry.processo)
    : undefined;
  if (proc) {
    proc.andamento = "";
    proc.finalizado = false;
  }

  list.splice(index, 1);
  data.finalizados_externos_sem_honor = list;
  await saveDataAsync(data, tid);
  return NextResponse.json({ ok: true, processoReaberto: !!proc });
}
