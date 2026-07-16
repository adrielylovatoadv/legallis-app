import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasControleRestrito } from "@/lib/acl";
import * as processosRepo from "@/lib/repo/processos";
import { addSystemMessage } from "@/lib/chat";
import { logEvent } from "@/lib/audit";

// POST /api/controle/processos/prazo-concluido  { id }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (hasControleRestrito(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para este módulo" }, { status: 403 });

  const { id } = await req.json();
  const tid = session.user.tenantId;
  const anterior = await processosRepo.get(tid, id);
  if (!anterior) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const processo = await processosRepo.update(tid, id, {
    andamento: "AGUARDANDO DESPACHO", data: "", hora: "", responsavel: "",
  });
  if (!processo) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const msg = `${session.user.name} concluiu prazo do processo ${processo.autor} x ${processo.reu} (${processo.numero_processo}). Status: AGUARDANDO DESPACHO.`;
  await addSystemMessage(msg, "system", tid);
  logEvent({ tenantId: tid, tipo: "Prazo Concluído", descricao: msg, usuario: session.user.name ?? "?", usuarioId: session.user.id });

  return NextResponse.json(processo);
}
