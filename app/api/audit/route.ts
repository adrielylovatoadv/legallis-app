import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuditLog, logEvent } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  return NextResponse.json(getAuditLog());
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const body = await req.json();
  const event = logEvent({
    tipo: body.tipo,
    descricao: body.descricao,
    usuario: session.user.name ?? "?",
    usuarioId: session.user.id,
    detalhe: body.detalhe,
  });
  return NextResponse.json(event, { status: 201 });
}
