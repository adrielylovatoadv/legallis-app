import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import * as atendimentosRepo from "@/lib/repo/atendimentos";
import { atendimentoUpdateSchema } from "@/lib/validation/controle";
import { parseBody } from "@/lib/validation/helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const { data: body, error } = parseBody(atendimentoUpdateSchema, await req.json());
  if (error) return error;
  const atendimento = await atendimentosRepo.update(tid, id, body);
  if (!atendimento) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(atendimento);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  await atendimentosRepo.remove(tid, id);
  return NextResponse.json({ ok: true });
}
