import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | null = null;

function getSql() {
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
}

// Returns null when key not found, throws on DB error
export async function dbGet<T>(key: string): Promise<T | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    const rows = await sql`SELECT value FROM kv_store WHERE key = ${key}` as Array<{value: T}>;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows[0].value as T;
  } catch (e) {
    console.error("dbGet error:", e);
    return null;
  }
}

export async function dbSet<T>(key: string, value: T): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  try {
    await sql`
      INSERT INTO kv_store (key, value) VALUES (${key}, ${JSON.stringify(value) as unknown as object})
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(value) as unknown as object}, updated_at = NOW()
    `;
    return true;
  } catch (e) {
    console.error("dbSet error:", e);
    return false;
  }
}

export function hasDb(): boolean {
  return !!process.env.POSTGRES_URL;
}
