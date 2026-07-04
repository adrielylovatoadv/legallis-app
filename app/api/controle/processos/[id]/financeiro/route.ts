import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasControleRestrito } from "@/lib/acl";
import * as processosRepo from "@/lib/repo/processos";
import * as acordosRepo from "@/lib/repo/acordos";
import * as execucoesRepo from "@/lib/repo/execucoes";
import * as honorariosRepo from "@/lib/repo/honorarios-iniciais";
import * as timesheetsRepo from "@/lib/repo/timesheets";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (hasControleRestrito(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para este módulo" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;

  const processo = await processosRepo.get(tid, id);
  if (!processo) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });

  const [acordos, execucoes, honorarios_iniciais, timesheets] = await Promise.all([
    acordosRepo.list(tid),
    execucoesRepo.list(tid),
    honorariosRepo.list(tid),
    timesheetsRepo.list(tid),
  ]);

  // Casa por processoId (vínculo novo) ou, pra lançamentos antigos, pelo número do processo
  const belongsTo = (processoId: string | undefined, processoNumero: string | undefined) =>
    processoId === id || (!!processo.numero_processo && processoNumero === processo.numero_processo);

  return NextResponse.json({
    acordos: acordos.filter(a => belongsTo(a.processoId, a.processo)),
    execucoes: execucoes.filter(e => belongsTo(e.processoId, e.processo)),
    honorarios_iniciais: honorarios_iniciais.filter(h => belongsTo(h.processoId, h.processo)),
    timesheets: timesheets.filter(t => belongsTo(t.processoId, t.processo)),
  });
}
