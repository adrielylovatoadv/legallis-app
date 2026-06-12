import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMessages, addMessage, markRead, getConversations, getUnreadCounts } from "@/lib/chat";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversationId") || "general";
  const type = url.searchParams.get("type");

  if (type === "conversations") {
    const convs = await getConversations(tid);
    const unread = await getUnreadCounts(session.user.id, tid);
    return NextResponse.json({ conversations: convs, unread });
  }

  await markRead(session.user.id, conversationId, tid);
  return NextResponse.json(await getMessages(conversationId, tid));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { text, conversationId = "general" } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  const msg = await addMessage({
    conversationId,
    from: session.user.id,
    fromName: session.user.name ?? "?",
    text: text.trim(),
    type: "user",
  }, tid);
  return NextResponse.json(msg, { status: 201 });
}
