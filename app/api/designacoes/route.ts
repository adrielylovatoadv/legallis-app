import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData, newId } from "@/lib/controle-data";
import { addSystemMessage, getOrCreateDM, addMessage } from "@/lib/chat";
import { logEvent } from "@/lib/audit";
import { getUserByIdAsync } from "@/lib/users";

// GET /api/designacoes -> solicitações de redesignação pendentes recebidas pelo usuário logado
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const data = await getData(tid);
  const recebidas = (data.redesignacoes || []).filter(
    r => r.paraUserId === session.user.id && r.status === "pendente"
  );
  return NextResponse.json({ recebidas });
}

// POST /api/designacoes  { action: "concluir"|"redesignacao"|"responder_redesignacao", tipo, id, motivo?, adminId?, redesignacaoId?, aceitar? }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { action, tipo, id, motivo, adminId, redesignacaoId, aceitar } = await req.json();
  const userName = session.user.name ?? "?";
  const userId = session.user.id;
  const tid = session.user.tenantId;
  const data = await getData(tid);

  if (action === "responder_redesignacao") {
    const pedido = (data.redesignacoes || []).find(r => r.id === redesignacaoId);
    if (!pedido) return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
    if (pedido.paraUserId !== userId) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    if (pedido.status !== "pendente") return NextResponse.json({ error: "Solicitação já respondida" }, { status: 400 });

    pedido.status = aceitar ? "aceita" : "recusada";
    pedido.respondido_em = new Date().toISOString();

    if (aceitar) {
      if (pedido.tipo === "processo") {
        const item = data.processos.find(p => p.id === pedido.itemId);
        if (item) item.responsavel = pedido.paraUserName;
      } else {
        const item = data.iniciais.find(i => i.id === pedido.itemId);
        if (item) item.responsavel = pedido.paraUserName;
      }
    }

    const msg = aceitar
      ? `${userName} aceitou a redesignação de "${pedido.label}" solicitada por ${pedido.deUserName}.`
      : `${userName} recusou a redesignação de "${pedido.label}" solicitada por ${pedido.deUserName}.`;
    const conv = await getOrCreateDM(userId, pedido.deUserId, tid);
    await addMessage({ conversationId: conv.id, from: userId, fromName: userName, text: msg, type: "user" }, tid);
    logEvent({ tipo: "Redesignação", descricao: msg, usuario: userName, usuarioId: userId, detalhe: `${pedido.tipo} ID ${pedido.itemId}` });

    await saveData(data, tid);
    return NextResponse.json({ ok: true });
  }

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
      const admin = await getUserByIdAsync(adminId).catch(() => null);
      const label = `${item.autor} × ${item.reu}`;
      data.redesignacoes = [
        ...(data.redesignacoes || []),
        {
          id: newId(), tipo: "processo", itemId: id, label,
          deUserId: userId, deUserName: userName,
          paraUserId: adminId, paraUserName: admin?.name || "?",
          motivo, status: "pendente", criado_em: new Date().toISOString(),
        },
      ];
      const msg = `Solicitação de redesignação de ${userName}: Processo ${label}. Motivo: ${motivo}`;
      const conv = await getOrCreateDM(userId, adminId, tid);
      await addMessage({ conversationId: conv.id, from: userId, fromName: userName, text: msg, type: "user" }, tid);
      logEvent({ tipo: "Redesignação", descricao: msg, usuario: userName, usuarioId: userId, detalhe: `Processo ID ${id}` });
    }
  } else if (tipo === "inicial") {
    const item = data.iniciais.find(i => i.id === id);
    if (!item) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    if (action === "concluir") {
      item.andamento = "PROTOCOLADO";
      item.responsavel = "";
      const msg = `${userName} concluiu tarefa de petição inicial: ${item.cliente} x ${item.reu}. Status: PROTOCOLADO.`;
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
      const admin = await getUserByIdAsync(adminId).catch(() => null);
      const label = `${item.cliente} × ${item.reu}`;
      data.redesignacoes = [
        ...(data.redesignacoes || []),
        {
          id: newId(), tipo: "inicial", itemId: id, label,
          deUserId: userId, deUserName: userName,
          paraUserId: adminId, paraUserName: admin?.name || "?",
          motivo, status: "pendente", criado_em: new Date().toISOString(),
        },
      ];
      const msg = `Solicitação de redesignação de ${userName}: Petição Inicial ${label}. Motivo: ${motivo}`;
      const conv = await getOrCreateDM(userId, adminId, tid);
      await addMessage({ conversationId: conv.id, from: userId, fromName: userName, text: msg, type: "user" }, tid);
      logEvent({ tipo: "Redesignação", descricao: msg, usuario: userName, usuarioId: userId, detalhe: `Inicial ID ${id}` });
    }
  }

  await saveData(data, tid);
  return NextResponse.json({ ok: true });
}
