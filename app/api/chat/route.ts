import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMessages, addMessage, markRead, getConversations, getUnreadCounts } from "@/lib/chat";
import { getUserByIdAsync } from "@/lib/users";
import { sendNovaMensagem } from "@/lib/email";

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
  const trimmed = text.trim();

  // E-mail só pra DM/grupo (avisar o canal geral inteiro a cada mensagem seria pior spam ainda),
  // e só se o destinatário ainda não tinha mensagem não lida nessa conversa — ou seja, só a
  // primeira de uma leva dispara e-mail, não cada mensagem de um vai-e-vem.
  const conversas = await getConversations(tid);
  const conv = conversas.find(c => c.id === conversationId);
  const destinatarios = conv && (conv.type === "dm" || conv.type === "group")
    ? (conv.members ?? []).filter(m => m !== session.user.id)
    : [];
  const unreadAntes = new Map<string, number>();
  for (const uid of destinatarios) {
    const counts = await getUnreadCounts(uid, tid);
    unreadAntes.set(uid, counts[conversationId] ?? 0);
  }

  const msg = await addMessage({
    conversationId,
    from: session.user.id,
    fromName: session.user.name ?? "?",
    text: trimmed,
    type: "user",
  }, tid);

  for (const uid of destinatarios) {
    if (unreadAntes.get(uid) !== 0) continue;
    const destinatario = await getUserByIdAsync(uid).catch(() => null);
    if (destinatario?.email) {
      await sendNovaMensagem(destinatario.name, destinatario.email, session.user.name ?? "?", trimmed.slice(0, 140));
    }
  }

  return NextResponse.json(msg, { status: 201 });
}
