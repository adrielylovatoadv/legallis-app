import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, isFinalizado } from "@/lib/controle-data";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const data = await getData(tid);
  const hoje = new Date().toISOString().split("T")[0];
  const em3 = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];

  const ativos = data.processos.filter(p => !isFinalizado(p));
  const prazos_hoje = ativos.filter(p => p.data?.slice(0, 10) === hoje);
  const prazos_3dias = ativos.filter(p => p.data > hoje && p.data <= em3);
  const iniciais_pendentes = data.iniciais.filter(
    i => !["PROTOCOLADO", "ARQUIVADO"].includes((i.andamento || "").toUpperCase())
  );

  return NextResponse.json({
    prazos_hoje,
    prazos_3dias,
    iniciais_pendentes,
    total_clientes: data.clientes.length,
    total_processos_ativos: ativos.length,
  });
}
