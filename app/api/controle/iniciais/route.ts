import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import * as iniciaisRepo from "@/lib/repo/iniciais";
import { normText } from "@/lib/controle";
import { inicialCreateSchema } from "@/lib/validation/controle";
import { parseBody } from "@/lib/validation/helpers";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const busca = searchParams.get("busca") || "";
  const andamento = searchParams.get("andamento") || "";
  const responsavel = searchParams.get("responsavel") || "";

  let lista = await iniciaisRepo.list(tid);

  if (busca) {
    const b = normText(busca);
    lista = lista.filter(i =>
      normText(i.cliente).includes(b) ||
      normText(i.reu).includes(b) ||
      normText(i.objeto).includes(b)
    );
  }
  if (andamento) lista = lista.filter(i => i.andamento === andamento);
  if (responsavel) lista = lista.filter(i => (i.responsavel || "").toLowerCase() === responsavel.toLowerCase());

  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { data: body, error } = parseBody(inicialCreateSchema, await req.json());
  if (error) return error;
  const novo = await iniciaisRepo.create(tid, body);
  return NextResponse.json(novo, { status: 201 });
}
