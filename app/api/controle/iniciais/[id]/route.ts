import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import * as iniciaisRepo from "@/lib/repo/iniciais";
import { inicialUpdateSchema } from "@/lib/validation/controle";
import { parseBody } from "@/lib/validation/helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const { data: body, error } = parseBody(inicialUpdateSchema, await req.json());
  if (error) return error;
  const inicial = await iniciaisRepo.update(tid, id, body);
  if (!inicial) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(inicial);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  await iniciaisRepo.remove(tid, id);
  return NextResponse.json({ ok: true });
}
