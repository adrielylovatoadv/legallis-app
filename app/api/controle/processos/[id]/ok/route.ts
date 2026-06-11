import { NextRequest, NextResponse } from "next/server";
import { getData, saveData } from "@/lib/controle-data";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getData();
  const idx = data.processos.findIndex(x => x.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  data.processos[idx] = {
    ...data.processos[idx],
    data: "", hora: "", andamento: "AGUARDANDO DESPACHO", responsavel: "", dashboard_ok: true,
  };
  saveData(data);
  return NextResponse.json(data.processos[idx]);
}
