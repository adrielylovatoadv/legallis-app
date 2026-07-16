import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import * as atendimentosRepo from "@/lib/repo/atendimentos";
import { normText } from "@/lib/controle";
import { atendimentoCreateSchema } from "@/lib/validation/controle";
import { parseBody } from "@/lib/validation/helpers";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const busca = searchParams.get("busca") || "";
  const status = searchParams.get("status") || "";
  const forma = searchParams.get("forma") || "";
  const responsavel = searchParams.get("responsavel") || "";
  const data = searchParams.get("data") || "";

  let lista = await atendimentosRepo.list(tid);

  if (busca) {
    const b = normText(busca);
    lista = lista.filter(a => normText(a.cliente).includes(b));
  }
  if (status) lista = lista.filter(a => a.status === status);
  if (forma) lista = lista.filter(a => a.forma === forma);
  if (responsavel) lista = lista.filter(a => (a.responsavel || "").toLowerCase() === responsavel.toLowerCase());
  if (data) lista = lista.filter(a => a.data === data);

  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { data: body, error } = parseBody(atendimentoCreateSchema, await req.json());
  if (error) return error;
  const novo = await atendimentosRepo.create(tid, body);
  return NextResponse.json(novo, { status: 201 });
}
