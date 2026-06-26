import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData } from "@/lib/controle-data";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const data = await getData(tid);
  const cliente = data.clientes.find(x => x.id === id);
  if (!cliente) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ senha_gov: cliente.senha_gov || "", senha_serasa: cliente.senha_serasa || "" });
}
