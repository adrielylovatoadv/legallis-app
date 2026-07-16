import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasControleRestrito } from "@/lib/acl";
import { isFinalizado } from "@/lib/controle-data";
import { normalizeData, normText } from "@/lib/controle";
import * as processosRepo from "@/lib/repo/processos";
import { processoCreateSchema } from "@/lib/validation/controle";
import { parseBody } from "@/lib/validation/helpers";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (hasControleRestrito(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para este módulo" }, { status: 403 });
  const tid = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const busca = searchParams.get("busca") || "";
  const andamento = searchParams.get("andamento") || "";
  const responsavel = searchParams.get("responsavel") || "";
  const tipo = searchParams.get("tipo") || "";

  let lista = await processosRepo.list(tid);

  if (busca) {
    const b = normText(busca);
    lista = lista.filter(p =>
      normText(p.autor).includes(b) ||
      normText(p.reu).includes(b) ||
      normText(p.numero_processo).includes(b) ||
      normText(p.objeto).includes(b)
    );
  }
  if (andamento) lista = lista.filter(p => (p.andamento || "").toUpperCase().includes(andamento.toUpperCase()));
  if (responsavel) lista = lista.filter(p => (p.responsavel || "").toLowerCase() === responsavel.toLowerCase());

  if (tipo === "ativos") lista = lista.filter(p => !isFinalizado(p));
  else if (tipo === "finalizados") lista = lista.filter(p => isFinalizado(p));
  else if (tipo === "audiencias") {
    const hoje = new Date().toISOString().split("T")[0];
    lista = lista.filter(p => {
      const a = (p.andamento || "").toUpperCase();
      return (a.includes("AIJ") || a.startsWith("AC")) && normalizeData(p.data) >= hoje && !isFinalizado(p);
    });
  } else if (tipo === "standby") {
    lista = lista.filter(p => !p.data && !isFinalizado(p));
  }

  lista = lista.sort((a, b) => {
    if (a.atencao && !b.atencao) return -1;
    if (!a.atencao && b.atencao) return 1;
    return (normalizeData(a.data) || "9999").localeCompare(normalizeData(b.data) || "9999");
  });

  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (hasControleRestrito(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para este módulo" }, { status: 403 });
  const tid = session.user.tenantId;
  const { data: body, error } = parseBody(processoCreateSchema, await req.json());
  if (error) return error;
  const novo = await processosRepo.create(tid, body);
  return NextResponse.json(novo, { status: 201 });
}
