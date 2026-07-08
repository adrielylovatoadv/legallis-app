import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import * as feriadosRepo from "@/lib/repo/feriados";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  await feriadosRepo.remove(tid, id);
  return NextResponse.json({ ok: true });
}
