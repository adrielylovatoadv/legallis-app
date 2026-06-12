import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData } from "@/lib/financeiro-data";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const d = await getData(tid);
  return NextResponse.json(d.config_escritorio || { tipo: "individual", socios: [] });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const body = await req.json();
  const d = await getData(tid);
  d.config_escritorio = body;
  await saveData(d, tid);
  return NextResponse.json(d.config_escritorio);
}
