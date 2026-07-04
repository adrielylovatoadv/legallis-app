import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasFinanceiroAccess } from "@/lib/acl";
import { getDataAsync as getData, saveDataAsync as saveData } from "@/lib/financeiro-data";
import { fixaUpdateSchema } from "@/lib/validation/financeiro";
import { parseBody } from "@/lib/validation/helpers";

type Params = { params: Promise<{ categoria: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { categoria } = await params;
  const cat = decodeURIComponent(categoria);
  const { data: body, error } = parseBody(fixaUpdateSchema, await req.json());
  if (error) return error;
  const d = await getData(tid);
  if (!d.fixas[cat] && d.fixas[cat] !== undefined ? false : !Object.keys(d.fixas).includes(cat)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const targetCat = body.nova_categoria && body.nova_categoria !== cat ? body.nova_categoria : cat;

  if (targetCat !== cat) {
    d.fixas[targetCat] = d.fixas[cat];
    d.fixas_quem[targetCat] = body.quem ?? d.fixas_quem[cat];
    d.fixas_status[targetCat] = d.fixas_status[cat] || {};
    d.fixas_valor_fixo[targetCat] = body.valor_fixo !== undefined ? Number(body.valor_fixo) : (d.fixas_valor_fixo[cat] || 0);
    delete d.fixas[cat];
    delete d.fixas_quem[cat];
    delete d.fixas_status[cat];
    delete d.fixas_valor_fixo[cat];
  } else {
    if (body.quem !== undefined) d.fixas_quem[cat] = body.quem;
    if (body.valores !== undefined) d.fixas[cat] = body.valores;
    if (body.valor_fixo !== undefined) {
      const vf = Number(body.valor_fixo);
      if (vf > 0) d.fixas_valor_fixo[cat] = vf;
      else delete d.fixas_valor_fixo[cat];
    }
  }

  await saveData(d, tid);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!hasFinanceiroAccess(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para o módulo financeiro" }, { status: 403 });
  const tid = session.user.tenantId;
  const { categoria } = await params;
  const cat = decodeURIComponent(categoria);
  const d = await getData(tid);
  delete d.fixas[cat];
  delete d.fixas_quem[cat];
  delete d.fixas_status[cat];
  delete d.fixas_valor_fixo[cat];
  await saveData(d, tid);
  return NextResponse.json({ ok: true });
}
