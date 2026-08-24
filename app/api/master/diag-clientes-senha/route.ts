import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isOwner } from "@/lib/users";
import { getSql, hasDb, dbInit } from "@/lib/db";

// Rota de diagnóstico TEMPORÁRIA — somente leitura, nunca retorna o valor de nenhuma senha,
// só tamanho e se o valor já está criptografado (prefixo "enc:"). Usada para investigar
// relato de senha_gov aparecendo como "—" na tela. Remover depois de resolvido.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const ownerOk = isOwner({ id: session.user.id, tenantId: session.user.tenantId });
  if (!ownerOk && session.user.plan !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  if (!hasDb()) return NextResponse.json({ error: "Sem banco configurado" }, { status: 400 });

  await dbInit();
  const sql = getSql()!;
  const tid = session.user.tenantId;
  const rows = await sql`
    SELECT id, nome,
      LENGTH(senha_gov) AS senha_gov_len, senha_gov LIKE 'enc:%' AS senha_gov_enc,
      LENGTH(senha_serasa) AS senha_serasa_len, senha_serasa LIKE 'enc:%' AS senha_serasa_enc,
      LENGTH(conta) AS conta_len, conta LIKE 'enc:%' AS conta_enc
    FROM clientes WHERE tenant_id = ${tid} ORDER BY nome
  ` as Record<string, unknown>[];

  return NextResponse.json({
    tenantId: tid,
    cargoAtual: session.user.cargo ?? null,
    roleAtual: session.user.role ?? null,
    planAtual: session.user.plan ?? null,
    totalClientes: rows.length,
    clientes: rows,
  });
}
