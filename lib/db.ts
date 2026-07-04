import { neon } from "@neondatabase/serverless";
import { initSchema } from "./schema";

let _sql: ReturnType<typeof neon> | null = null;

export function getSql() {
  if (!process.env.POSTGRES_URL) return null;
  if (!_sql) _sql = neon(process.env.POSTGRES_URL);
  return _sql;
}

export async function dbInit() {
  const sql = getSql();
  if (!sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await initSchema(sql);
}

// Returns null quando a chave não existe. Propaga (throw) qualquer erro de conexão/consulta —
// nunca deve ser confundido com "chave não encontrada", pois isso levaria quem chama a
// tratar uma falha transitória do banco como se fosse a primeira execução (dado vazio) e
// sobrescrever o registro real no Neon com um estado vazio/desatualizado.
export async function dbGet<T>(key: string): Promise<T | null> {
  const sql = getSql();
  if (!sql) return null;
  const rows = await sql`SELECT value FROM kv_store WHERE key = ${key}` as Array<{value: T}>;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0].value as T;
}

// Lança exceção em caso de falha — quem chama não deve interpretar retorno como sucesso
// silencioso quando o banco está configurado (hasDb() === true).
export async function dbSet<T>(key: string, value: T): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  await sql`
    INSERT INTO kv_store (key, value) VALUES (${key}, ${JSON.stringify(value) as unknown as object})
    ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(value) as unknown as object}, updated_at = NOW()
  `;
  return true;
}

export function hasDb(): boolean {
  return !!process.env.POSTGRES_URL;
}
