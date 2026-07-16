import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasDb, getSql } from "@/lib/db";
import { newId } from "@/lib/controle-data";
import * as atendimentosRepo from "@/lib/repo/atendimentos";
import * as clientesRepo from "@/lib/repo/clientes";
import { logEvent } from "@/lib/audit";

type Body =
  | { acao: "cadastrar_cliente"; nome?: string; telefone?: string }
  | { acao: "vincular_cliente"; clienteId: string }
  | { acao: "nenhum" };

// POST /api/controle/atendimentos/[id]/concluir
// Finaliza um atendimento e, opcionalmente, cadastra um novo cliente ou vincula um
// existente — o resumo do atendimento vira a "Observação Inicial" do cliente.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const body = (await req.json()) as Body;

  const atendimento = await atendimentosRepo.get(tid, id);
  if (!atendimento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  let clienteVinculado = null;

  if (body.acao === "cadastrar_cliente") {
    const novoClienteInput = {
      nome: body.nome?.trim() || atendimento.cliente,
      telefone: body.telefone || atendimento.telefone || "",
      cpf: "", email: "", endereco: "", tipo_aposentadoria: "",
      informacoes: atendimento.observacoes || "",
      senha_gov: "", senha_serasa: "",
      tipo_pessoa: "fisica" as const,
    };
    const atendimentoMerged = { ...atendimento, status: "Concluído" };

    if (hasDb()) {
      const sql = getSql()!;
      const novoClienteRow = { ...novoClienteInput, id: newId(), criado_em: new Date().toISOString() };
      atendimentoMerged.cliente_id = novoClienteRow.id;
      await sql.transaction([
        clientesRepo.buildCreateStatement(tid, novoClienteRow),
        atendimentosRepo.buildUpdateStatement(tid, atendimentoMerged),
      ]);
      clienteVinculado = novoClienteRow;
    } else {
      clienteVinculado = await clientesRepo.create(tid, novoClienteInput);
      atendimentoMerged.cliente_id = clienteVinculado.id;
      await atendimentosRepo.update(tid, id, { status: "Concluído", cliente_id: clienteVinculado.id });
    }
  } else if (body.acao === "vincular_cliente") {
    clienteVinculado = await clientesRepo.get(tid, body.clienteId);
    await atendimentosRepo.update(tid, id, { status: "Concluído", cliente_id: body.clienteId });
  } else {
    await atendimentosRepo.update(tid, id, { status: "Concluído" });
  }

  const msg = `${session.user.name} finalizou o atendimento de ${atendimento.cliente}` +
    (clienteVinculado ? ` — vinculado ao cliente ${clienteVinculado.nome}.` : ".");
  logEvent({ tipo: "Atendimento", descricao: msg, usuario: session.user.name ?? "?", usuarioId: session.user.id });

  const atualizado = await atendimentosRepo.get(tid, id);
  return NextResponse.json({ atendimento: atualizado, cliente: clienteVinculado });
}
