import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMessages, addMessage, markRead } from "@/lib/chat";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const msgs = getMessages();
  // Mark as read
  markRead(session.user.id, new Date().toISOString());
  return NextResponse.json(msgs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { text, to } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  const msg = addMessage({
    from: session.user.id,
    fromName: session.user.name ?? "?",
    to: to ?? null,
    text: text.trim(),
  });
  return NextResponse.json(msg, { status: 201 });
}
