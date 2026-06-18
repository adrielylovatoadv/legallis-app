import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync } from "@/lib/controle-data";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const data = await getDataAsync(tid);
  return NextResponse.json({
    sem_honor: data.finalizados_externos_sem_honor || [],
    acordos: data.finalizados_externos_acordos || [],
    execucao: data.finalizados_execucao || [],
  });
}
