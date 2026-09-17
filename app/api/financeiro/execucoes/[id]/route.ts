import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import { calcExecucao, calcSucumbencia, calcRepasseExecucao } from "@/lib/financeiro-data";
import * as execucoesRepo from "@/lib/repo/execucoes";
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
  const current = await execucoesRepo.get(tid, id);
  if (!current) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const patch: typeof body & { honorarios?: number; repasse_cliente?: number; sucumbencia?: number } = { ...body };
  if (patch.valor_percebido !== undefined || patch.sucumbencia !== undefined || patch.pct_sucumbencia !== undefined
    || patch.tipo_execucao !== undefined || patch.pct_honorarios !== undefined) {
    const p = patch.valor_percebido ?? current.valor_percebido;
    const tipo = patch.tipo_execucao ?? current.tipo_execucao;
    const pct = patch.pct_honorarios ?? current.pct_honorarios;
    const pctSuc = patch.pct_sucumbencia ?? current.pct_sucumbencia;
    const s = tipo === "honorarios_somente"
      ? (patch.sucumbencia ?? current.sucumbencia)
      : calcSucumbencia(p, pctSuc);
    patch.sucumbencia = s;
    patch.honorarios = calcExecucao(p, s, tipo, pct);
    if (tipo !== "honorarios_somente" && p > 0) {
      patch.repasse_cliente = calcRepasseExecucao(p, s, pct);
    }
  }
  const exec = await execucoesRepo.update(tid, id, patch);
  return NextResponse.json(exec);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  await execucoesRepo.remove(tid, id);
  return NextResponse.json({ ok: true });
}
