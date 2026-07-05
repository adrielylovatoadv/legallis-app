import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasControleRestrito } from "@/lib/acl";
import { getDataAsync, type FinalizadoSemHonor } from "@/lib/controle-data";
import * as finalizadosRepo from "@/lib/repo/finalizados-sem-honor";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (hasControleRestrito(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para este módulo" }, { status: 403 });
  const tid = session.user.tenantId;
  const [semHonor, data] = await Promise.all([finalizadosRepo.list(tid), getDataAsync(tid)]);

  // Migra acordos antigos (com dados financeiros) para o novo formato simples
  const acordosMigrados = (data.finalizados_externos_acordos || []).map((a) => ({
    cliente: a.cliente || "",
    reu: a.reu || "",
    processo: a.processo || "",
    objeto: a.objeto || "",
    data_fin: a.data_pagamento || "",
    motivo: "Acordo",
    _migrado: true, // somente leitura — edição/exclusão via aba Financeiro
  }));

  const finalizados = [...semHonor, ...acordosMigrados];
  return NextResponse.json({ finalizados });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (hasControleRestrito(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para este módulo" }, { status: 403 });
  const tid = session.user.tenantId;
  const body: Omit<FinalizadoSemHonor, "id"> = await req.json();
  await finalizadosRepo.create(tid, body);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (hasControleRestrito(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para este módulo" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id, entry }: { id: string; entry: FinalizadoSemHonor } = await req.json();
  const atualizado = await finalizadosRepo.update(tid, id, entry);
  if (!atualizado) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (hasControleRestrito(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para este módulo" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id }: { id: string } = await req.json();
  const ok = await finalizadosRepo.remove(tid, id);
  if (!ok) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
