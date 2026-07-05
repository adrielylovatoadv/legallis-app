import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDb, getSql } from "@/lib/db";
import * as redesignacoesRepo from "@/lib/repo/redesignacoes";
import * as processosRepo from "@/lib/repo/processos";
import * as iniciaisRepo from "@/lib/repo/iniciais";
import { addSystemMessage, getOrCreateDM, addMessage } from "@/lib/chat";
import { logEvent } from "@/lib/audit";
import { getUserByIdAsync } from "@/lib/users";

// GET /api/designacoes -> solicitações de redesignação pendentes recebidas pelo usuário logado
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const todas = await redesignacoesRepo.list(tid);
  const recebidas = todas.filter(r => r.paraUserId === session.user.id && r.status === "pendente");
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

  if (action === "responder_redesignacao") {
    const pedido = await redesignacoesRepo.get(tid, redesignacaoId);
    if (!pedido) return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
    if (pedido.paraUserId !== userId) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    if (pedido.status !== "pendente") return NextResponse.json({ error: "Solicitação já respondida" }, { status: 400 });

    const redesignacaoMerged = {
      ...pedido,
      status: (aceitar ? "aceita" : "recusada") as typeof pedido.status,
      respondido_em: new Date().toISOString(),
    };
    // Aceita: transfere para quem respondeu. Recusa: volta sem responsável,
    // pra não ficar "esquecido" com quem já pediu pra se livrar da tarefa.
    const novoResponsavel = aceitar ? pedido.paraUserName : "";

    // No modo banco, gravar a resposta da redesignação e atualizar o responsável do
    // processo/inicial viram uma única transação — nunca fica uma respondida sem o outro lado atualizado.
    if (hasDb()) {
      const sql = getSql()!;
      const statements = [redesignacoesRepo.buildUpdateStatement(tid, redesignacaoMerged)];
      if (pedido.tipo === "processo") {
        const item = await processosRepo.get(tid, pedido.itemId);
        if (item) statements.push(processosRepo.buildUpdateStatement(tid, { ...item, responsavel: novoResponsavel }));
      } else {
        const item = await iniciaisRepo.get(tid, pedido.itemId);
        if (item) statements.push(iniciaisRepo.buildUpdateStatement(tid, { ...item, responsavel: novoResponsavel }));
      }
      await sql.transaction(statements);
    } else {
      await redesignacoesRepo.update(tid, redesignacaoId, {
        status: redesignacaoMerged.status,
        respondido_em: redesignacaoMerged.respondido_em,
      });
      if (pedido.tipo === "processo") await processosRepo.update(tid, pedido.itemId, { responsavel: novoResponsavel });
      else await iniciaisRepo.update(tid, pedido.itemId, { responsavel: novoResponsavel });
    }

    const msg = aceitar
      ? `${userName} aceitou a redesignação de "${pedido.label}" solicitada por ${pedido.deUserName}.`
      : `${userName} recusou a redesignação de "${pedido.label}" solicitada por ${pedido.deUserName}. O item voltou sem responsável.`;
    const conv = await getOrCreateDM(userId, pedido.deUserId, tid);
    await addMessage({ conversationId: conv.id, from: userId, fromName: userName, text: msg, type: "user" }, tid);
    logEvent({ tipo: "Redesignação", descricao: msg, usuario: userName, usuarioId: userId, detalhe: `${pedido.tipo} ID ${pedido.itemId}` });

    return NextResponse.json({ ok: true });
  }

  if (tipo === "processo") {
    const item = await processosRepo.get(tid, id);
    if (!item) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    if (action === "concluir") {
      await processosRepo.update(tid, id, { andamento: "AGUARDANDO DESPACHO", data: "", hora: "", responsavel: "" });
      const msg = `${userName} concluiu prazo do processo ${item.autor} x ${item.reu}. Status: AGUARDANDO DESPACHO.`;
      await addSystemMessage(msg, "system", tid);
      logEvent({ tipo: "Conclusão de Tarefa", descricao: msg, usuario: userName, usuarioId: userId, detalhe: `Processo ID ${id}` });
    } else if (action === "redesignacao") {
      if (!motivo?.trim()) return NextResponse.json({ error: "Motivo obrigatório" }, { status: 400 });
      if (!adminId) return NextResponse.json({ error: "Selecione um administrador" }, { status: 400 });
      const admin = await getUserByIdAsync(adminId).catch(() => null);
      const label = `${item.autor} × ${item.reu}`;
      await redesignacoesRepo.create(tid, {
        tipo: "processo", itemId: id, label,
        deUserId: userId, deUserName: userName,
        paraUserId: adminId, paraUserName: admin?.name || "?",
        motivo, status: "pendente",
      });
      const msg = `Solicitação de redesignação de ${userName}: Processo ${label}. Motivo: ${motivo}`;
      const conv = await getOrCreateDM(userId, adminId, tid);
      await addMessage({ conversationId: conv.id, from: userId, fromName: userName, text: msg, type: "user" }, tid);
      logEvent({ tipo: "Redesignação", descricao: msg, usuario: userName, usuarioId: userId, detalhe: `Processo ID ${id}` });
    }
  } else if (tipo === "inicial") {
    const item = await iniciaisRepo.get(tid, id);
    if (!item) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    if (action === "concluir") {
      await iniciaisRepo.update(tid, id, { andamento: "PROTOCOLADO", responsavel: "" });
      const msg = `${userName} concluiu tarefa de petição inicial: ${item.cliente} x ${item.reu}. Status: PROTOCOLADO.`;
      await addSystemMessage(msg, "system", tid);
      logEvent({ tipo: "Conclusão de Tarefa", descricao: msg, usuario: userName, usuarioId: userId, detalhe: `Inicial ID ${id}` });
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
      await redesignacoesRepo.create(tid, {
        tipo: "inicial", itemId: id, label,
        deUserId: userId, deUserName: userName,
        paraUserId: adminId, paraUserName: admin?.name || "?",
        motivo, status: "pendente",
      });
      const msg = `Solicitação de redesignação de ${userName}: Petição Inicial ${label}. Motivo: ${motivo}`;
      const conv = await getOrCreateDM(userId, adminId, tid);
      await addMessage({ conversationId: conv.id, from: userId, fromName: userName, text: msg, type: "user" }, tid);
      logEvent({ tipo: "Redesignação", descricao: msg, usuario: userName, usuarioId: userId, detalhe: `Inicial ID ${id}` });
    }
  }

  return NextResponse.json({ ok: true });
}
