import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData, newId } from "@/lib/controle-data";

const ANDAMENTOS_FINAIS = ["ACORDO", "ARQUIVADO", "DESISTÊNCIA", "DESISTENCIA", "IMPROCEDÊNCIA", "IMPROCEDENCIA", "EXTINÇÃO", "EXTINCAO", "CANCELADO"];

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const data = await getData(tid);
  const p = data.processos.find(x => x.id === id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(p);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const body = await req.json();
  const data = await getData(tid);
  const idx = data.processos.findIndex(x => x.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const anterior = data.processos[idx];
  data.processos[idx] = { ...anterior, ...body };
  const novoAndamento = (body.andamento || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // Se andamento virou finalizado, adiciona em finalizados_externos_sem_honor (se ainda não existir)
  if (ANDAMENTOS_FINAIS.includes(novoAndamento)) {
    const proc = data.processos[idx];
    const jaExiste = (data.finalizados_externos_sem_honor || []).some(
      f => f.processo === proc.numero_processo
    );
    if (!jaExiste) {
      data.finalizados_externos_sem_honor = [
        ...(data.finalizados_externos_sem_honor || []),
        {
          cliente: proc.autor,
          reu: proc.reu,
          processo: proc.numero_processo,
          objeto: proc.objeto,
          data_fin: new Date().toISOString().slice(0, 10),
          motivo: body.andamento || anterior.andamento,
        },
      ];
    }
  }

  await saveData(data, tid);
  return NextResponse.json(data.processos[idx]);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const data = await getData(tid);
  data.processos = data.processos.filter(x => x.id !== id);
  await saveData(data, tid);
  return NextResponse.json({ ok: true });
}
