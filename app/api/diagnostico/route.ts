import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbInit, dbGet, dbSet, hasDb, getSql } from "@/lib/db";
import { initSchema } from "@/lib/schema";

// Ferramenta de infra (status do banco, roda migração de schema) — só para o super-admin da
// Legallis (plan="admin"). `role` é um papel interno de cada escritório, autoatribuível — ver
// nota de segurança em app/api/usuarios/[id]/route.ts.
export async function GET() {
  const session = await auth();
  if (!session || session.user.plan !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const result: Record<string, unknown> = {
    banco: hasDb() ? "Neon Postgres" : "Arquivos locais (sem POSTGRES_URL)",
    timestamp: new Date().toISOString(),
  };

  if (hasDb()) {
    try {
      await dbInit();
      result.schema = "✓ Tabela kv_store OK";

      // Teste de escrita e leitura
      const testKey = "__diagnostico__";
      await dbSet(testKey, { ok: true, ts: Date.now() });
      const val = await dbGet<{ ok: boolean }>(testKey);
      result.escrita = val?.ok ? "✓ Gravação OK" : "✗ Falha na leitura";

      // Verificar quais chaves existem
      const chaves = ["financeiro", "controle", "chat", "audit"];
      const presentes: string[] = [];
      for (const k of chaves) {
        const v = await dbGet(k);
        if (v) presentes.push(k);
      }
      result.dados_presentes = presentes.length > 0 ? presentes : ["nenhum (primeira vez)"];
      result.status = "✓ Banco conectado e funcionando";
    } catch (e) {
      result.status = "✗ Erro ao conectar";
      result.erro = String(e);
    }
  } else {
    result.status = "⚠ Usando arquivos locais — dados não persistem no Vercel";
  }

  return NextResponse.json(result);
}

// Roda as CREATE TABLE/ADD COLUMN IF NOT EXISTS de lib/schema.ts — idempotente e aditivo,
// não altera nem apaga nenhuma tabela ou linha já existente. Passo explícito e sob demanda
// (não roda a cada request) para não repetir o problema de lentidão que motivou tirar o
// initSchema() de dbInit() — ver comentário em lib/db.ts.
export async function POST() {
  const session = await auth();
  if (!session || session.user.plan !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "Sem banco configurado (POSTGRES_URL ausente)" }, { status: 400 });
  try {
    await initSchema(sql);
    return NextResponse.json({ ok: true, mensagem: "Tabelas criadas/atualizadas com sucesso." });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
