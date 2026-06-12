import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData, calcExecucao } from "@/lib/financeiro-data";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const body = await req.json();
  const d = await getData(tid);
  const idx = d.execucoes.findIndex(e => e.id === id);
  if (idx === -1) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (body.valor_percebido !== undefined || body.sucumbencia !== undefined) {
    const p = body.valor_percebido ?? d.execucoes[idx].valor_percebido;
    const s = body.sucumbencia ?? d.execucoes[idx].sucumbencia;
    body.honorarios = calcExecucao(p, s);
  }
  d.execucoes[idx] = { ...d.execucoes[idx], ...body };
  await saveData(d, tid);
  return NextResponse.json(d.execucoes[idx]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const d = await getData(tid);
  d.execucoes = d.execucoes.filter(e => e.id !== id);
  await saveData(d, tid);
  return NextResponse.json({ ok: true });
}
