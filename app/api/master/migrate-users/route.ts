import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbGet, dbInit, hasDb, getSql } from "@/lib/db";
import { initSchema } from "@/lib/schema";
import { USERS_DB_KEY, upsertUserRow, type User } from "@/lib/users";

// Rota de migração TEMPORÁRIA — copia kv_store.users_global (blob único, todos os tenants)
// para a tabela relacional `users` (lib/schema.ts), linha por linha, via upsertUserRow
// (idempotente: ON CONFLICT DO UPDATE, seguro rodar mais de uma vez). NUNCA apaga nem altera
// o blob original — ele continua intacto em kv_store como rede de segurança. Remover esta
// rota depois de confirmar a migração (comparar blobCount com tableCountAfter).
export async function GET() {
  const session = await auth();
  if (!session || session.user.plan !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  if (!hasDb()) {
    return NextResponse.json({ error: "Sem banco configurado (POSTGRES_URL ausente)" }, { status: 400 });
  }

  const sql = getSql()!;
  await dbInit();
  await initSchema(sql);

  const before = await sql`SELECT COUNT(*) FROM users` as { count: string }[];
  const tableCountBefore = Number(before[0].count);

  const blobUsers = (await dbGet<User[]>(USERS_DB_KEY)) ?? [];
  for (const u of blobUsers) await upsertUserRow(u);

  const after = await sql`SELECT COUNT(*) FROM users` as { count: string }[];
  const tableCountAfter = Number(after[0].count);

  return NextResponse.json({
    blobCount: blobUsers.length,
    tableCountBefore,
    tableCountAfter,
    ok: tableCountAfter >= blobUsers.length,
  });
}
