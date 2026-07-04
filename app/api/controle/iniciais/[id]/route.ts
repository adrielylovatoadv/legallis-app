import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData } from "@/lib/controle-data";
import { inicialUpdateSchema } from "@/lib/validation/controle";
import { parseBody } from "@/lib/validation/helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const { data: body, error } = parseBody(inicialUpdateSchema, await req.json());
  if (error) return error;
  const data = await getData(tid);
  const idx = data.iniciais.findIndex(x => x.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  data.iniciais[idx] = { ...data.iniciais[idx], ...body };
  await saveData(data, tid);
  return NextResponse.json(data.iniciais[idx]);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const data = await getData(tid);
  data.iniciais = data.iniciais.filter(x => x.id !== id);
  await saveData(data, tid);
  return NextResponse.json({ ok: true });
}
