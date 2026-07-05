import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasControleRestrito } from "@/lib/acl";
import { hasDb, getSql } from "@/lib/db";
import * as processosRepo from "@/lib/repo/processos";
import * as finalizadosRepo from "@/lib/repo/finalizados-sem-honor";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (hasControleRestrito(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para este módulo" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id }: { id: string } = await req.json();
  const entry = await finalizadosRepo.get(tid, id);
  if (!entry) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const processos = entry.processo ? await processosRepo.list(tid) : [];
  const proc = processos.find(p => p.numero_processo === entry.processo);

  // No modo banco, apagar o finalizado e reabrir o processo viram uma única transação —
  // nunca fica o finalizado removido sem o processo voltar a aparecer como ativo.
  if (hasDb()) {
    const sql = getSql()!;
    const statements = [finalizadosRepo.buildRemoveStatement(tid, id)];
    if (proc) statements.push(processosRepo.buildUpdateStatement(tid, { ...proc, andamento: "", finalizado: false }));
    await sql.transaction(statements);
  } else {
    if (proc) await processosRepo.update(tid, proc.id, { andamento: "", finalizado: false });
    await finalizadosRepo.remove(tid, id);
  }

  return NextResponse.json({ ok: true, processoReaberto: !!proc });
}
