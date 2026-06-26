import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData, newId } from "@/lib/controle-data";
import { addSystemMessage } from "@/lib/chat";
import { logEvent } from "@/lib/audit";

// POST /api/controle/iniciais/protocolo  { id, numero_processo, data_protocolo, observacoes }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id, numero_processo, data_protocolo, observacoes } = await req.json();
  const tid = session.user.tenantId;
  const data = await getData(tid);
  const inicial = data.iniciais.find(i => i.id === id) as (typeof data.iniciais[0] & { protocolo?: object; numero_processo?: string });
  if (!inicial) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  // Marca a inicial como protocolada (sai da lista de pendentes)
  inicial.andamento = "PROTOCOLADO";
  if (numero_processo) inicial.numero_processo = numero_processo;
  inicial.protocolo = { numero_processo, data_protocolo, observacoes, registrado_por: session.user.name, registrado_em: new Date().toISOString() };

  // Cria o processo automaticamente a partir da inicial
  const novoProcesso = {
    id: newId(),
    autor: inicial.cliente || "",
    reu: inicial.reu || "",
    objeto: inicial.objeto || "",
    numero_processo: numero_processo || "",
    data: data_protocolo || "",
    hora: "",
    andamento: "AGUARDANDO DESPACHO",
    responsavel: inicial.responsavel || "",
    observacoes: observacoes || inicial.observacoes || "",
    atencao: false,
    finalizado: false,
    criado_em: new Date().toISOString(),
  };
  data.processos.push(novoProcesso);

  await saveData(data, tid);

  const msg = `${session.user.name} protocolou: ${inicial.cliente} x ${inicial.reu}. Nº ${numero_processo}. Processo criado com status: AGUARDANDO DESPACHO.`;
  await addSystemMessage(msg, "system", tid);
  logEvent({ tipo: "Protocolo", descricao: msg, usuario: session.user.name ?? "?", usuarioId: session.user.id });

  return NextResponse.json({ inicial, processo: novoProcesso });
}
