import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import { getDataAsync as getData, saveDataAsync as saveData, newId, COLS } from "@/lib/financeiro-data";
import { fixaCreateSchema } from "@/lib/validation/financeiro";
import { parseBody } from "@/lib/validation/helpers";

function buildFixas(d: Awaited<ReturnType<typeof getData>>) {
  return Object.entries(d.fixas).map(([categoria, valores]) => {
    const vf = d.fixas_valor_fixo?.[categoria] || 0;
    const totalCols = vf > 0 ? COLS.length * vf : COLS.reduce((s, c) => s + (valores[c] || 0), 0);
    return {
      categoria,
      quem: d.fixas_quem?.[categoria] || "dividido",
      valores,
      status: d.fixas_status?.[categoria] || {},
      valor_fixo: vf,
      total: totalCols,
    };
  });
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const d = await getData(tid);
  return NextResponse.json(buildFixas(d));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { data: body, error } = parseBody(fixaCreateSchema, await req.json());
  if (error) return error;
  const d = await getData(tid);
  const cat = body.categoria || `Despesa ${newId()}`;
  d.fixas[cat] = body.valores;
  d.fixas_quem[cat] = body.quem;
  if (!d.fixas_status[cat]) d.fixas_status[cat] = {};
  if (body.valor_fixo) d.fixas_valor_fixo[cat] = body.valor_fixo;
  await saveData(d, tid);
  return NextResponse.json({ categoria: cat });
}
