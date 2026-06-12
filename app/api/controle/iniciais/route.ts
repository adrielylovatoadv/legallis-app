import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData, newId } from "@/lib/controle-data";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const busca = searchParams.get("busca") || "";
  const andamento = searchParams.get("andamento") || "";
  const responsavel = searchParams.get("responsavel") || "";

  const data = await getData(tid);
  let lista = data.iniciais;

  if (busca) {
    const b = busca.toLowerCase();
    lista = lista.filter(i =>
      (i.cliente || "").toLowerCase().includes(b) ||
      (i.reu || "").toLowerCase().includes(b) ||
      (i.objeto || "").toLowerCase().includes(b)
    );
  }
  if (andamento) lista = lista.filter(i => i.andamento === andamento);
  if (responsavel) lista = lista.filter(i => (i.responsavel || "").toLowerCase() === responsavel.toLowerCase());

  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const body = await req.json();
  const data = await getData(tid);
  const novo = {
    id: newId(), cliente: body.cliente || "", reu: body.reu || "",
    objeto: body.objeto || "", andamento: body.andamento || "FAZER INICIAL",
    responsavel: body.responsavel || "", observacoes: body.observacoes || "",
    criado_em: new Date().toISOString(),
  };
  data.iniciais.push(novo);
  await saveData(data, tid);
  return NextResponse.json(novo, { status: 201 });
}
