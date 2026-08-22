import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Rota de diagnóstico temporária — não expõe o valor da chave, só tamanho/formato.
// Remover depois de confirmar a configuração de FIELD_ENCRYPT_KEY em produção.
export async function GET() {
  const session = await auth();
  if (!session || session.user.plan !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const key = process.env.FIELD_ENCRYPT_KEY;
  return NextResponse.json({
    configured: !!key,
    length: key?.length ?? 0,
    isValidHex64: !!key && /^[0-9a-fA-F]{64}$/.test(key),
  });
}
