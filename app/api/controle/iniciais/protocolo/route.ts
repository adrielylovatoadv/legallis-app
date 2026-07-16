import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDb, getSql } from "@/lib/db";
import { newId } from "@/lib/controle-data";
import * as iniciaisRepo from "@/lib/repo/iniciais";
import * as processosRepo from "@/lib/repo/processos";
import { addSystemMessage } from "@/lib/chat";
import { logEvent } from "@/lib/audit";

// POST /api/controle/iniciais/protocolo  { id, numero_processo, data_protocolo, observacoes }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id, numero_processo, data_protocolo, observacoes } = await req.json();
  const tid = session.user.tenantId;
  const inicialAnterior = await iniciaisRepo.get(tid, id);
  if (!inicialAnterior) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  // Marca a inicial como protocolada (sai da lista de pendentes)
  const inicialMerged = {
    ...inicialAnterior,
    andamento: "PROTOCOLADO",
    numero_processo: numero_processo || inicialAnterior.numero_processo,
    protocolo: {
      numero_processo, data_protocolo, observacoes,
      registrado_por: session.user.name ?? "?", registrado_em: new Date().toISOString(),
    },
  };

  // Processo criado automaticamente a partir da inicial
  const novoProcessoInput = {
    autor: inicialMerged.cliente || "",
    reu: inicialMerged.reu || "",
    objeto: inicialMerged.objeto || "",
    numero_processo: numero_processo || "",
    data: data_protocolo || "",
    hora: "",
    andamento: "AGUARDANDO DESPACHO",
    responsavel: inicialMerged.responsavel || "",
    observacoes: observacoes || inicialMerged.observacoes || "",
    atencao: false,
    finalizado: false,
  };

  let inicial, novoProcesso;
  // No modo banco, marcar a inicial como protocolada e criar o processo viram uma única
  // transação — nunca fica uma inicial "protocolada" sem o processo correspondente.
  if (hasDb()) {
    const sql = getSql()!;
    const novoProcessoRow = { ...novoProcessoInput, id: newId(), criado_em: new Date().toISOString() };
    await sql.transaction([
      iniciaisRepo.buildUpdateStatement(tid, inicialMerged),
      processosRepo.buildCreateStatement(tid, novoProcessoRow),
    ]);
    inicial = inicialMerged;
    novoProcesso = novoProcessoRow;
  } else {
    inicial = await iniciaisRepo.update(tid, id, {
      andamento: inicialMerged.andamento,
      numero_processo: inicialMerged.numero_processo,
      protocolo: inicialMerged.protocolo,
    });
    if (!inicial) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    novoProcesso = await processosRepo.create(tid, novoProcessoInput);
  }

  const msg = `${session.user.name} protocolou: ${inicial.cliente} x ${inicial.reu}. Nº ${numero_processo}. Processo criado com status: AGUARDANDO DESPACHO.`;
  await addSystemMessage(msg, "system", tid);
  logEvent({ tenantId: tid, tipo: "Protocolo", descricao: msg, usuario: session.user.name ?? "?", usuarioId: session.user.id });

  return NextResponse.json({ inicial, processo: novoProcesso });
}
