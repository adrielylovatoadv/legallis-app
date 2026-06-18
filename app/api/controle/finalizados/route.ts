import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync, saveDataAsync, type FinalizadoSemHonor } from "@/lib/controle-data";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const data = await getDataAsync(tid);

  // Migra acordos antigos (com dados financeiros) para o novo formato simples
  const acordosMigrados: FinalizadoSemHonor[] = (data.finalizados_externos_acordos || []).map((a) => ({
    cliente: a.cliente || "",
    reu: a.reu || "",
    processo: a.processo || "",
    objeto: a.objeto || "",
    data_fin: a.data_pagamento || "",
    motivo: "Acordo",
  }));

  const finalizados = [...(data.finalizados_externos_sem_honor || []), ...acordosMigrados];
  return NextResponse.json({ finalizados });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const body: FinalizadoSemHonor = await req.json();
  const data = await getDataAsync(tid);
  data.finalizados_externos_sem_honor = [...(data.finalizados_externos_sem_honor || []), body];
  await saveDataAsync(data, tid);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { index, entry }: { index: number; entry: FinalizadoSemHonor } = await req.json();
  const data = await getDataAsync(tid);
  const list = [...(data.finalizados_externos_sem_honor || [])];
  if (index < 0 || index >= list.length) return NextResponse.json({ error: "Índice inválido" }, { status: 400 });
  list[index] = entry;
  data.finalizados_externos_sem_honor = list;
  await saveDataAsync(data, tid);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { index }: { index: number } = await req.json();
  const data = await getDataAsync(tid);
  const list = [...(data.finalizados_externos_sem_honor || [])];
  if (index < 0 || index >= list.length) return NextResponse.json({ error: "Índice inválido" }, { status: 400 });
  list.splice(index, 1);
  data.finalizados_externos_sem_honor = list;
  await saveDataAsync(data, tid);
  return NextResponse.json({ ok: true });
}
