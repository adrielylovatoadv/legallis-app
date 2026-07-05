import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import * as clientesRepo from "@/lib/repo/clientes";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const cliente = await clientesRepo.get(tid, id);
  if (!cliente) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    banco: cliente.banco || "",
    agencia: cliente.agencia || "",
    conta: cliente.conta || "",
    tipo_conta: cliente.tipo_conta || "corrente",
    chave_pix: cliente.chave_pix || "",
  });
}
