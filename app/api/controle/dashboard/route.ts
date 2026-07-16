import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isFinalizado } from "@/lib/controle-data";
import { normalizeData } from "@/lib/controle";
import * as processosRepo from "@/lib/repo/processos";
import * as clientesRepo from "@/lib/repo/clientes";
import * as atendimentosRepo from "@/lib/repo/atendimentos";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const [processos, clientes, atendimentos] = await Promise.all([
    processosRepo.list(tid), clientesRepo.list(tid), atendimentosRepo.list(tid),
  ]);
  const hoje = new Date().toISOString().split("T")[0];
  const em3 = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];

  const ativos = processos.filter(p => !isFinalizado(p));
  const prazos_hoje = ativos.filter(p => normalizeData(p.data) === hoje);
  const prazos_3dias = ativos.filter(p => { const d = normalizeData(p.data); return d > hoje && d <= em3; });

  const atendimentos_agendados = atendimentos
    .filter(a => a.status !== "Cancelado" && normalizeData(a.data) >= hoje)
    .sort((a, b) => (normalizeData(a.data) + a.hora).localeCompare(normalizeData(b.data) + b.hora));

  return NextResponse.json({
    prazos_hoje,
    prazos_3dias,
    atendimentos_agendados,
    total_clientes: clientes.length,
    total_processos_ativos: ativos.length,
  });
}
