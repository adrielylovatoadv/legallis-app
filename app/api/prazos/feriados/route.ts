import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import * as feriadosRepo from "@/lib/repo/feriados";
import { feriadoMunicipalCreateSchema } from "@/lib/validation/controle";
import { parseBody } from "@/lib/validation/helpers";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const lista = await feriadosRepo.list(tid);
  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { data: body, error } = parseBody(feriadoMunicipalCreateSchema, await req.json());
  if (error) return error;
  const novo = await feriadosRepo.create(tid, body);
  return NextResponse.json(novo, { status: 201 });
}
