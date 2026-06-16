import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Stub: os índices são atualizados manualmente no arquivo data/indices_juridicos.json
// Em produção, pode-se integrar com a API do Banco Central para atualização automática
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  return NextResponse.json({ ok: true, message: "Índices atualizados." });
}
