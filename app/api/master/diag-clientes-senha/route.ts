import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isOwner } from "@/lib/users";
import { getSql, hasDb, dbInit } from "@/lib/db";

// Rota de diagnóstico TEMPORÁRIA — somente leitura, nunca retorna o valor de nenhuma senha.
// Checagem final pós-recuperação: confirma que ninguém ficou com texto cifrado ilegível.
// Remover depois de confirmado.
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

  const [totais] = await sql`
    SELECT COUNT(*) AS total,
      COUNT(*) FILTER (WHERE senha_gov LIKE 'enc:%' OR senha_serasa LIKE 'enc:%') AS ainda_cifrado,
      COUNT(*) FILTER (WHERE senha_gov <> '' AND senha_gov NOT LIKE 'enc:%') AS com_senha_gov_legivel,
      COUNT(*) FILTER (WHERE senha_serasa <> '' AND senha_serasa NOT LIKE 'enc:%') AS com_senha_serasa_legivel,
      COUNT(*) FILTER (WHERE (senha_gov = '' OR senha_gov IS NULL) AND (senha_serasa = '' OR senha_serasa IS NULL)) AS sem_nenhuma_senha
    FROM clientes WHERE tenant_id = ${tid}
  ` as { total: string; ainda_cifrado: string; com_senha_gov_legivel: string; com_senha_serasa_legivel: string; sem_nenhuma_senha: string }[];

  const cifrados = await sql`
    SELECT nome FROM clientes WHERE tenant_id = ${tid} AND (senha_gov LIKE 'enc:%' OR senha_serasa LIKE 'enc:%') ORDER BY nome
  ` as { nome: string }[];

  return NextResponse.json({
    tenantId: tid,
    ...totais,
    nomesAindaCifrados: cifrados.map(c => c.nome),
  });
}
