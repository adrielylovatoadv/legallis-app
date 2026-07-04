import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import * as acordosRepo from "@/lib/repo/acordos";
import * as execucoesRepo from "@/lib/repo/execucoes";
import * as honorariosRepo from "@/lib/repo/honorarios-iniciais";
import * as timesheetsRepo from "@/lib/repo/timesheets";

// Usado por telas que não têm um Processo.id real pra vincular (ex.: registros
// de "Finalizados" importados ou lançados manualmente) — casa só pelo número.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const numero = searchParams.get("numero") || "";
  if (!numero) return NextResponse.json({ error: "Parâmetro 'numero' é obrigatório" }, { status: 400 });

  const [acordos, execucoes, honorarios_iniciais, timesheets] = await Promise.all([
    acordosRepo.list(tid), execucoesRepo.list(tid), honorariosRepo.list(tid), timesheetsRepo.list(tid),
  ]);
  return NextResponse.json({
    acordos: acordos.filter(a => a.processo === numero),
    execucoes: execucoes.filter(e => e.processo === numero),
    honorarios_iniciais: honorarios_iniciais.filter(h => h.processo === numero),
    timesheets: timesheets.filter(t => t.processo === numero),
  });
}
