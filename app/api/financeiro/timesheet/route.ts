import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData, newId } from "@/lib/financeiro-data";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const d = await getData(tid);
  return NextResponse.json(d.timesheets);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const body = await req.json();
  if (!body.data || !(body.minutos > 0)) {
    return NextResponse.json({ error: "Data e minutos são obrigatórios" }, { status: 400 });
  }
  const d = await getData(tid);
  const item = { ...body, id: newId() };
  d.timesheets.push(item);
  await saveData(d, tid);
  return NextResponse.json(item, { status: 201 });
}
