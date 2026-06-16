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
  if (body.valor_percebido !== undefined || body.sucumbencia !== undefined || body.tipo_execucao !== undefined) {
    const p = body.valor_percebido ?? d.execucoes[idx].valor_percebido;
    const s = body.sucumbencia ?? d.execucoes[idx].sucumbencia;
    const tipo = body.tipo_execucao ?? d.execucoes[idx].tipo_execucao;
    const pct = body.pct_honorarios ?? d.execucoes[idx].pct_honorarios;
    body.honorarios = calcExecucao(p, s, tipo, pct);
    if (tipo !== "honorarios_somente" && p > 0) {
      body.repasse_cliente = Math.round(p * (1 - (pct ?? 35) / 100) * 100) / 100;
    }
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
