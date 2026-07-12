import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { auth } from "@/auth";
import * as certificadosRepo from "@/lib/repo/certificados";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { id } = await params;

  const removido = await certificadosRepo.remove(session.user.tenantId, id);
  if (!removido) return NextResponse.json({ error: "Certificado não encontrado" }, { status: 404 });

  if (removido.blobPath) {
    try {
      await del(removido.blobPath);
    } catch (e) {
      console.error("Erro ao excluir arquivo do certificado no Blob:", e);
    }
  }

  return NextResponse.json({ ok: true });
}
