import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbInit, dbGet, dbSet, hasDb } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
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
