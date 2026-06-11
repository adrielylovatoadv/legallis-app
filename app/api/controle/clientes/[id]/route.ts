import { NextRequest, NextResponse } from "next/server";
import { getData, saveData } from "@/lib/controle-data";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data = getData();
  const idx = data.clientes.findIndex(x => x.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  data.clientes[idx] = { ...data.clientes[idx], ...body };
  saveData(data);
  return NextResponse.json(data.clientes[idx]);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getData();
  data.clientes = data.clientes.filter(x => x.id !== id);
  saveData(data);
  return NextResponse.json({ ok: true });
}
