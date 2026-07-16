import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTicketById, updateTicketStatus } from "@/lib/suporte";
import type { TicketStatus } from "@/lib/suporte";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ticket = getTicketById(id);
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Só a própria escritora que abriu o chamado ou a equipe da Legallis (plan="admin") pode ver —
  // ver nota de segurança em app/api/usuarios/[id]/route.ts sobre não usar `role` aqui.
  if (ticket.userId !== session.user.id && session.user.plan !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(ticket);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.plan !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const { status } = await req.json();
  const ok = updateTicketStatus(id, status as TicketStatus);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
