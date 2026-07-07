import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import * as tarefasRepo from "@/lib/repo/tarefas";
import { tarefaCreateSchema } from "@/lib/validation/controle";
import { parseBody } from "@/lib/validation/helpers";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const lista = await tarefasRepo.list(tid);
  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { data: body, error } = parseBody(tarefaCreateSchema, await req.json());
  if (error) return error;
  const nova = await tarefasRepo.create(tid, body);
  return NextResponse.json(nova, { status: 201 });
}
