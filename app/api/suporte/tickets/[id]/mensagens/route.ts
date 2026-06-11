import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTicketById, addMessage } from "@/lib/suporte";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const ticket = getTicketById(id);
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.userId !== session.user.id && session.user.role !== "admin" && session.user.plan !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });

  const msg = addMessage(id, {
    authorId: session.user.id,
    authorName: session.user.name ?? "",
    authorRole: session.user.role === "admin" ? "admin" : "user",
    content: content.trim(),
  });

  return NextResponse.json(msg, { status: 201 });
}
