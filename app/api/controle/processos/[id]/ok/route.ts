import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasControleRestrito } from "@/lib/acl";
import * as processosRepo from "@/lib/repo/processos";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (hasControleRestrito(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para este módulo" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const atualizado = await processosRepo.update(tid, id, {
    data: "", hora: "", andamento: "AGUARDANDO DESPACHO", responsavel: "", dashboard_ok: true,
  });
  if (!atualizado) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(atualizado);
}
