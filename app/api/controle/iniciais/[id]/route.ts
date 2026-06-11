import { NextRequest, NextResponse } from "next/server";
import { getData, saveData } from "@/lib/controle-data";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data = getData();
  const idx = data.iniciais.findIndex(x => x.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  data.iniciais[idx] = { ...data.iniciais[idx], ...body };
  saveData(data);
  return NextResponse.json(data.iniciais[idx]);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getData();
  data.iniciais = data.iniciais.filter(x => x.id !== id);
  saveData(data);
  return NextResponse.json({ ok: true });
}
