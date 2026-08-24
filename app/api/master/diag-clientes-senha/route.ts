import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isOwner } from "@/lib/users";
import { getSql, hasDb, dbInit } from "@/lib/db";
import { decryptField } from "@/lib/crypto";

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
    SELECT id, nome, senha_gov,
      LENGTH(senha_gov) AS senha_gov_len, senha_gov LIKE 'enc:%' AS senha_gov_enc
    FROM clientes WHERE tenant_id = ${tid} AND senha_gov LIKE 'enc:%' ORDER BY nome LIMIT 3
  ` as { id: string; nome: string; senha_gov: string; senha_gov_len: number; senha_gov_enc: boolean }[];

  // Tenta decriptar com a chave ATUAL — nunca retorna o resultado, só se deu certo ou não.
  const testes = rows.map(r => {
    const decrypted = decryptField(r.senha_gov);
    return { nome: r.nome, len_criptografado: r.senha_gov_len, decriptou_com_chave_atual: decrypted !== "" };
  });

  return NextResponse.json({
    tenantId: tid,
    cargoAtual: session.user.cargo ?? null,
    roleAtual: session.user.role ?? null,
    planAtual: session.user.plan ?? null,
    testes_decriptacao: testes,
  });
}
