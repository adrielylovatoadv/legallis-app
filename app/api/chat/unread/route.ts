import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUnreadCounts } from "@/lib/chat";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  return NextResponse.json(await getUnreadCounts(session.user.id, session.user.tenantId));
}
