import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import * as publicacoesRepo from "@/lib/repo/publicacoes";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const tratadaParam = searchParams.get("tratada");
  const filtro = tratadaParam === null ? undefined : { tratada: tratadaParam === "true" };
  const lista = await publicacoesRepo.list(tid, filtro);
  return NextResponse.json(lista);
}
