import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasControleRestrito } from "@/lib/acl";
import { getDataAsync as getData, saveDataAsync as saveData } from "@/lib/controle-data";
import * as processosRepo from "@/lib/repo/processos";
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
  const atualizado = await processosRepo.update(tid, id, body);
  if (!atualizado) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const novoAndamento = (body.andamento || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // Se andamento virou finalizado, adiciona em finalizados_externos_sem_honor (se ainda não existir).
  // finalizados_externos_sem_honor ainda vive só no blob (Fase 5) — grava por fora, sem tocar em processos.
  if (ANDAMENTOS_FINAIS.includes(novoAndamento)) {
    const data = await getData(tid);
    const jaExiste = (data.finalizados_externos_sem_honor || []).some(
      f => f.processo === atualizado.numero_processo
    );
    if (!jaExiste) {
      data.finalizados_externos_sem_honor = [
        ...(data.finalizados_externos_sem_honor || []),
        {
          cliente: atualizado.autor,
          reu: atualizado.reu,
          processo: atualizado.numero_processo,
          objeto: atualizado.objeto,
          data_fin: new Date().toISOString().slice(0, 10),
          motivo: body.andamento || anterior.andamento,
        },
      ];
      await saveData(data, tid);
    }
  }

  return NextResponse.json(atualizado);
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
