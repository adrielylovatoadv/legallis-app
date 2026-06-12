import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData } from "@/lib/controle-data";
import { addSystemMessage, getOrCreateDM, addMessage } from "@/lib/chat";
import { logEvent } from "@/lib/audit";

// POST /api/designacoes  { action: "concluir"|"redesignacao", tipo: "processo"|"inicial", id, motivo? }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { action, tipo, id, motivo, adminId } = await req.json();
  const userName = session.user.name ?? "?";
  const userId = session.user.id;
  const tid = session.user.tenantId;
  const data = await getData(tid);

  if (tipo === "processo") {
    const item = data.processos.find(p => p.id === id);
    if (!item) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    if (action === "concluir") {
      item.andamento = "AGUARDANDO DESPACHO";
      item.data = "";
      item.hora = "";
      item.responsavel = "";
      const msg = `${userName} concluiu prazo do processo ${item.autor} x ${item.reu}. Status: AGUARDANDO DESPACHO.`;
      await addSystemMessage(msg, "system", tid);
      logEvent({ tipo: "Conclusão de Tarefa", descricao: msg, usuario: userName, usuarioId: userId, detalhe: `Processo ID ${id}` });
    } else if (action === "redesignacao") {
      if (!motivo?.trim()) return NextResponse.json({ error: "Motivo obrigatório" }, { status: 400 });
      if (!adminId) return NextResponse.json({ error: "Selecione um administrador" }, { status: 400 });
      const msg = `Solicitação de redesignação de ${userName}: Processo ${item.autor} x ${item.reu}. Motivo: ${motivo}`;
      const conv = await getOrCreateDM(userId, adminId, tid);
      await addMessage({ conversationId: conv.id, from: userId, fromName: userName, text: msg, type: "user" }, tid);
      logEvent({ tipo: "Redesignação", descricao: msg, usuario: userName, usuarioId: userId, detalhe: `Processo ID ${id}` });
    }
  } else if (tipo === "inicial") {
    const item = data.iniciais.find(i => i.id === id);
    if (!item) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    if (action === "concluir") {
      item.andamento = "AGUARDANDO DESPACHO";
      item.responsavel = "";
      const msg = `${userName} concluiu tarefa de petição inicial: ${item.cliente} x ${item.reu}. Status: AGUARDANDO DESPACHO.`;
      await addSystemMessage(msg, "system", tid);
      logEvent({ tipo: "Conclusão de Tarefa", descricao: msg, usuario: userName, usuarioId: userId, detalhe: `Inicial ID ${id}` });
      await saveData(data, tid);
      return NextResponse.json({
        ok: true,
        openCadastro: true,
        initialData: {
          autor: item.cliente,
          reu: item.reu,
          objeto: item.objeto || "",
        },
      });
    } else if (action === "redesignacao") {
      if (!motivo?.trim()) return NextResponse.json({ error: "Motivo obrigatório" }, { status: 400 });
      if (!adminId) return NextResponse.json({ error: "Selecione um administrador" }, { status: 400 });
      const msg = `Solicitação de redesignação de ${userName}: Petição Inicial ${item.cliente} x ${item.reu}. Motivo: ${motivo}`;
      const conv = await getOrCreateDM(userId, adminId, tid);
      await addMessage({ conversationId: conv.id, from: userId, fromName: userName, text: msg, type: "user" }, tid);
      logEvent({ tipo: "Redesignação", descricao: msg, usuario: userName, usuarioId: userId, detalhe: `Inicial ID ${id}` });
    }
  }

  await saveData(data, tid);
  return NextResponse.json({ ok: true });
}
