import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasControleRestrito } from "@/lib/acl";
import { hasDb, getSql } from "@/lib/db";
import { newId } from "@/lib/controle-data";
import * as processosRepo from "@/lib/repo/processos";
import * as finalizadosRepo from "@/lib/repo/finalizados-sem-honor";
import { processoUpdateSchema } from "@/lib/validation/controle";
import { parseBody } from "@/lib/validation/helpers";

const ANDAMENTOS_FINAIS = ["ACORDO", "ARQUIVADO", "DESISTÊNCIA", "DESISTENCIA", "IMPROCEDÊNCIA", "IMPROCEDENCIA", "EXTINÇÃO", "EXTINCAO", "CANCELADO"];

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (hasControleRestrito(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para este módulo" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const p = await processosRepo.get(tid, id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(p);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (hasControleRestrito(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para este módulo" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const { data: body, error } = parseBody(processoUpdateSchema, await req.json());
  if (error) return error;
  const anterior = await processosRepo.get(tid, id);
  if (!anterior) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const novoAndamento = (body.andamento || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const merged = { ...anterior, ...body };

  // Se andamento virou finalizado, adiciona em finalizados_sem_honor (se ainda não existir).
  let novoFinalizado: Parameters<typeof finalizadosRepo.create>[1] | null = null;
  if (ANDAMENTOS_FINAIS.includes(novoAndamento)) {
    const existentes = await finalizadosRepo.list(tid);
    const jaExiste = existentes.some(f => f.processo === merged.numero_processo);
    if (!jaExiste) {
      novoFinalizado = {
        cliente: merged.autor,
        reu: merged.reu,
        processo: merged.numero_processo,
        objeto: merged.objeto,
        data_fin: new Date().toISOString().slice(0, 10),
        motivo: body.andamento || anterior.andamento,
      };
    }
  }

  // No modo banco, as duas escritas (processo + finalizado) viram uma única transação: nunca
  // fica um processo marcado como finalizado sem o registro correspondente em finalizados, nem
  // vice-versa, mesmo se a segunda escrita falhar no meio do caminho.
  if (hasDb() && novoFinalizado) {
    const sql = getSql()!;
    await sql.transaction([
      processosRepo.buildUpdateStatement(tid, merged),
      finalizadosRepo.buildCreateStatement(tid, { ...novoFinalizado, id: newId() }),
    ]);
  } else {
    const atualizado = await processosRepo.update(tid, id, body);
    if (!atualizado) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (novoFinalizado) await finalizadosRepo.create(tid, novoFinalizado);
  }

  return NextResponse.json(merged);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (hasControleRestrito(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para este módulo" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  await processosRepo.remove(tid, id);
  return NextResponse.json({ ok: true });
}
