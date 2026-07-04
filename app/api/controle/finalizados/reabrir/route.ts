import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasControleRestrito } from "@/lib/acl";
import { getDataAsync, saveDataAsync } from "@/lib/controle-data";
import * as processosRepo from "@/lib/repo/processos";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (hasControleRestrito(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para este módulo" }, { status: 403 });
  const tid = session.user.tenantId;
  const { index }: { index: number } = await req.json();
  const data = await getDataAsync(tid);
  const list = [...(data.finalizados_externos_sem_honor || [])];
  if (index < 0 || index >= list.length) return NextResponse.json({ error: "Índice inválido" }, { status: 400 });
  const entry = list[index];

  // processos já vive nas tabelas relacionais — busca e atualiza por fora do blob.
  const processos = entry.processo ? await processosRepo.list(tid) : [];
  const proc = processos.find(p => p.numero_processo === entry.processo);
  if (proc) await processosRepo.update(tid, proc.id, { andamento: "", finalizado: false });

  list.splice(index, 1);
  data.finalizados_externos_sem_honor = list;
  await saveDataAsync(data, tid);
  return NextResponse.json({ ok: true, processoReaberto: !!proc });
}
