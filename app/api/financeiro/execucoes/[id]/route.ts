import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import { getDataAsync as getData, saveDataAsync as saveData, calcExecucao } from "@/lib/financeiro-data";
import { execucaoUpdateSchema } from "@/lib/validation/financeiro";
import { parseBody } from "@/lib/validation/helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const { data: body, error } = parseBody(execucaoUpdateSchema, await req.json());
  if (error) return error;
  const d = await getData(tid);
  const idx = d.execucoes.findIndex(e => e.id === id);
  if (idx === -1) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const patch: typeof body & { honorarios?: number; repasse_cliente?: number } = { ...body };
  if (patch.valor_percebido !== undefined || patch.sucumbencia !== undefined || patch.tipo_execucao !== undefined) {
    const p = patch.valor_percebido ?? d.execucoes[idx].valor_percebido;
    const s = patch.sucumbencia ?? d.execucoes[idx].sucumbencia;
    const tipo = patch.tipo_execucao ?? d.execucoes[idx].tipo_execucao;
    const pct = patch.pct_honorarios ?? d.execucoes[idx].pct_honorarios;
    patch.honorarios = calcExecucao(p, s, tipo, pct);
    if (tipo !== "honorarios_somente" && p > 0) {
      patch.repasse_cliente = Math.round(p * (1 - (pct ?? 35) / 100) * 100) / 100;
    }
  }
  d.execucoes[idx] = { ...d.execucoes[idx], ...patch };
  await saveData(d, tid);
  return NextResponse.json(d.execucoes[idx]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const d = await getData(tid);
  d.execucoes = d.execucoes.filter(e => e.id !== id);
  await saveData(d, tid);
  return NextResponse.json({ ok: true });
}
