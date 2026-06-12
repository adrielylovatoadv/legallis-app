import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData, newId } from "@/lib/financeiro-data";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const d = await getData(tid); return NextResponse.json(d.honorarios_iniciais);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const body = await req.json();
  const d = await getData(tid);
  const h = { ...body, id: newId() };
  d.honorarios_iniciais.push(h);
  await saveData(d, tid);
  return NextResponse.json(h, { status: 201 });
}
