import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getFinanceiroData } from "@/lib/financeiro-data";

// Usado por telas que não têm um Processo.id real pra vincular (ex.: registros
// de "Finalizados" importados ou lançados manualmente) — casa só pelo número.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const numero = searchParams.get("numero") || "";
  if (!numero) return NextResponse.json({ error: "Parâmetro 'numero' é obrigatório" }, { status: 400 });

  const fin = await getFinanceiroData(tid);
  return NextResponse.json({
    acordos: fin.acordos.filter(a => a.processo === numero),
    execucoes: fin.execucoes.filter(e => e.processo === numero),
    honorarios_iniciais: fin.honorarios_iniciais.filter(h => h.processo === numero),
    timesheets: fin.timesheets.filter(t => t.processo === numero),
  });
}
