import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import * as publicacoesRepo from "@/lib/repo/publicacoes";
import { publicacaoUpdateSchema } from "@/lib/validation/publicacoes";
import { parseBody } from "@/lib/validation/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id } = await params;
  const { data: body, error } = parseBody(publicacaoUpdateSchema, await req.json());
  if (error) return error;

  const atualizado = await publicacoesRepo.update(tid, id, {
    ...body,
    processoId: body.processoId === null ? undefined : body.processoId,
  });
  if (!atualizado) return NextResponse.json({ error: "Publicação não encontrada" }, { status: 404 });
  return NextResponse.json(atualizado);
}
