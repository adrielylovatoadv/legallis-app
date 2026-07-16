import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDb, getSql } from "@/lib/db";
import { newId } from "@/lib/controle-data";
import * as atendimentosRepo from "@/lib/repo/atendimentos";
import * as clientesRepo from "@/lib/repo/clientes";
import * as processosRepo from "@/lib/repo/processos";
import { logEvent } from "@/lib/audit";

// POST /api/controle/atendimentos/[id]/criar-processo
// Cria um processo a partir de um atendimento já vinculado a um cliente cadastrado.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const { reu, objeto } = await req.json().catch(() => ({ reu: "", objeto: "" }));

  const atendimento = await atendimentosRepo.get(tid, id);
  if (!atendimento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (!atendimento.cliente_id) {
    return NextResponse.json({ error: "Vincule o atendimento a um cliente antes de criar o processo" }, { status: 400 });
  }
  const cliente = await clientesRepo.get(tid, atendimento.cliente_id);
  if (!cliente) return NextResponse.json({ error: "Cliente vinculado não encontrado" }, { status: 404 });

  const novoProcessoInput = {
    autor: cliente.nome, reu: reu || "", objeto: objeto || "",
    numero_processo: "", data: "", hora: "",
    andamento: "", responsavel: atendimento.responsavel || "",
    observacoes: atendimento.observacoes || "", atencao: false, finalizado: false,
  };
  const atendimentoMerged = { ...atendimento };

  let novoProcesso;
  if (hasDb()) {
    const sql = getSql()!;
    const novoProcessoRow = { ...novoProcessoInput, id: newId(), criado_em: new Date().toISOString() };
    atendimentoMerged.processo_id = novoProcessoRow.id;
    await sql.transaction([
      processosRepo.buildCreateStatement(tid, novoProcessoRow),
      atendimentosRepo.buildUpdateStatement(tid, atendimentoMerged),
    ]);
    novoProcesso = novoProcessoRow;
  } else {
    novoProcesso = await processosRepo.create(tid, novoProcessoInput);
    await atendimentosRepo.update(tid, id, { processo_id: novoProcesso.id });
  }

  const msg = `${session.user.name} criou um processo a partir do atendimento de ${cliente.nome}.`;
  logEvent({ tipo: "Atendimento", descricao: msg, usuario: session.user.name ?? "?", usuarioId: session.user.id });

  return NextResponse.json({ processo: novoProcesso });
}
