import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData, newId, calcAcordo } from "@/lib/financeiro-data";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const d = await getData(tid);
  const acordos = d.acordos.map(a => ({ ...a, honorarios: a.honorarios || calcAcordo(a.valor_acordo || 0) }));
  return NextResponse.json(acordos);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const body = await req.json();
  if (!(body.valor_acordo > 0)) {
    return NextResponse.json({ error: "Valor do acordo deve ser maior que zero" }, { status: 400 });
  }
  const d = await getData(tid);
  const acordo = { ...body, id: newId(), honorarios: calcAcordo(body.valor_acordo || 0) };
  d.acordos.push(acordo);
  await saveData(d, tid);
  return NextResponse.json(acordo, { status: 201 });
}
