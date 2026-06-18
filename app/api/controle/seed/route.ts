import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveDataAsync, type ControleData } from "@/lib/controle-data";

// POST /api/controle/seed — admin only
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const body = await req.json() as ControleData;
  if (!body || !Array.isArray(body.processos))
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });

  const tid = session.user.tenantId;

  const safeData: ControleData = {
    processos: body.processos || [],
    clientes: body.clientes || [],
    iniciais: body.iniciais || [],
    finalizados_externos_sem_honor: body.finalizados_externos_sem_honor || [],
    finalizados_externos_acordos: body.finalizados_externos_acordos || [],
    finalizados_execucao: body.finalizados_execucao || [],
  };

  await saveDataAsync(safeData, tid);

  return NextResponse.json({
    ok: true,
    stats: {
      processos: safeData.processos.length,
      clientes: safeData.clientes.length,
      iniciais: safeData.iniciais.length,
      sem_honor: safeData.finalizados_externos_sem_honor.length,
      acordos: safeData.finalizados_externos_acordos.length,
    },
  });
}
