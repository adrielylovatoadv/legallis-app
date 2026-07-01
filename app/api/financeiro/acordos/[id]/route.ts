import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData, calcAcordo } from "@/lib/financeiro-data";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const body = await req.json();
  if (body.valor_acordo !== undefined && !(body.valor_acordo > 0)) {
    return NextResponse.json({ error: "Valor do acordo deve ser maior que zero" }, { status: 400 });
  }
  const d = await getData(tid);
  const idx = d.acordos.findIndex(a => a.id === id);
  if (idx === -1) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (body.valor_acordo !== undefined) body.honorarios = calcAcordo(body.valor_acordo);
  d.acordos[idx] = { ...d.acordos[idx], ...body };
  await saveData(d, tid);
  return NextResponse.json(d.acordos[idx]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const d = await getData(tid);
  d.acordos = d.acordos.filter(a => a.id !== id);
  await saveData(d, tid);
  return NextResponse.json({ ok: true });
}
