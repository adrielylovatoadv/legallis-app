import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getControleData } from "@/lib/controle-data";
import { getDataAsync as getFinanceiroData } from "@/lib/financeiro-data";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;

  const controle = await getControleData(tid);
  const processo = controle.processos.find(p => p.id === id);
  if (!processo) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });

  const fin = await getFinanceiroData(tid);
  // Casa por processoId (vínculo novo) ou, pra lançamentos antigos, pelo número do processo
  const belongsTo = (processoId: string | undefined, processoNumero: string | undefined) =>
    processoId === id || (!!processo.numero_processo && processoNumero === processo.numero_processo);

  return NextResponse.json({
    acordos: fin.acordos.filter(a => belongsTo(a.processoId, a.processo)),
    execucoes: fin.execucoes.filter(e => belongsTo(e.processoId, e.processo)),
    honorarios_iniciais: fin.honorarios_iniciais.filter(h => belongsTo(h.processoId, h.processo)),
    timesheets: fin.timesheets.filter(t => belongsTo(t.processoId, t.processo)),
  });
}
