import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData } from "@/lib/controle-data";
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

  inicial.andamento = "AGUARDANDO DESPACHO";
  if (numero_processo) inicial.numero_processo = numero_processo;
  inicial.protocolo = { numero_processo, data_protocolo, observacoes, registrado_por: session.user.name, registrado_em: new Date().toISOString() };

  await saveData(data, tid);

  const msg = `${session.user.name} protocolou: ${inicial.cliente} x ${inicial.reu}. Nº ${numero_processo}. Status: AGUARDANDO DESPACHO.`;
  await addSystemMessage(msg, "system", tid);
  logEvent({ tipo: "Protocolo", descricao: msg, usuario: session.user.name ?? "?", usuarioId: session.user.id });

  return NextResponse.json(inicial);
}
