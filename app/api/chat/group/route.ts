import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createGroup } from "@/lib/chat";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { name, members } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  const memberIds: string[] = members || [];
  if (!memberIds.includes(session.user.id)) memberIds.push(session.user.id);
  const conv = await createGroup(name.trim(), memberIds, session.user.id, session.user.tenantId);
  return NextResponse.json(conv);
}
