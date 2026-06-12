import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreateDM } from "@/lib/chat";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { targetUserId } = await req.json();
  if (!targetUserId) return NextResponse.json({ error: "targetUserId obrigatório" }, { status: 400 });
  const conv = await getOrCreateDM(session.user.id, targetUserId, session.user.tenantId);
  return NextResponse.json(conv);
}
