import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData } from "@/lib/controle-data";
import { addSystemMessage } from "@/lib/chat";
import { logEvent } from "@/lib/audit";

// POST /api/controle/processos/prazo-concluido  { id }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id } = await req.json();
  const tid = session.user.tenantId;
  const data = await getData(tid);
  const processo = data.processos.find(p => p.id === id);
  if (!processo) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  processo.andamento = "AGUARDANDO DESPACHO";
  processo.data = "";
  processo.hora = "";
  processo.responsavel = "";
  await saveData(data, tid);

  const msg = `${session.user.name} concluiu prazo do processo ${processo.autor} x ${processo.reu} (${processo.numero_processo}). Status: AGUARDANDO DESPACHO.`;
  await addSystemMessage(msg, "system", tid);
  logEvent({ tipo: "Prazo Concluído", descricao: msg, usuario: session.user.name ?? "?", usuarioId: session.user.id });

  return NextResponse.json(processo);
}
