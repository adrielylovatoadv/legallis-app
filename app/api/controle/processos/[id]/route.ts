import { NextRequest, NextResponse } from "next/server";
import { getData, saveData } from "@/lib/controle-data";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getData();
  const p = data.processos.find(x => x.id === id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(p);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data = getData();
  const idx = data.processos.findIndex(x => x.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  data.processos[idx] = { ...data.processos[idx], ...body };
  saveData(data);
  return NextResponse.json(data.processos[idx]);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getData();
  data.processos = data.processos.filter(x => x.id !== id);
  saveData(data);
  return NextResponse.json({ ok: true });
}
