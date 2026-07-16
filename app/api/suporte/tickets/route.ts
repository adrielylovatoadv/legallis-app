import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTickets, getTicketsByUser, createTicket } from "@/lib/suporte";
import type { TicketCategory, TicketPriority } from "@/lib/suporte";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Suporte é centralizado na Legallis: só a equipe da Legallis (plan="admin", painel master)
  // vê chamados de todos os escritórios. `role` é um papel interno de cada escritório e NÃO
  // deve conceder visibilidade de chamados de OUTROS escritórios — ver nota de segurança em
  // app/api/usuarios/[id]/route.ts.
  const tickets = session.user.plan === "admin"
    ? getTickets()
    : getTicketsByUser(session.user.id);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  return NextResponse.json(status ? tickets.filter(t => t.status === status) : tickets);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject, category, priority, message } = await req.json();
  if (!subject || !category || !message) {
    return NextResponse.json({ error: "Campos obrigatórios faltando." }, { status: 400 });
  }

  const ticket = createTicket({
    userId: session.user.id,
    userName: session.user.name ?? "",
    userEmail: session.user.email ?? "",
    subject,
    category: category as TicketCategory,
    priority: (priority ?? "media") as TicketPriority,
    status: "aberto",
  });

  // Add first message
  const { addMessage } = await import("@/lib/suporte");
  addMessage(ticket.id, {
    authorId: session.user.id,
    authorName: session.user.name ?? "",
    authorRole: session.user.plan === "admin" ? "admin" : "user",
    content: message,
  });

  return NextResponse.json(ticket, { status: 201 });
}
