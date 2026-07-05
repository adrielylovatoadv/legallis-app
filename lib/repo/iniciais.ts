import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, newId, type Inicial } from "@/lib/controle-data";

function rowToInicial(r: Record<string, unknown>): Inicial {
  return {
    id: r.id as string,
    cliente: r.cliente as string,
    reu: r.reu as string,
    objeto: r.objeto as string,
    andamento: r.andamento as string,
    responsavel: r.responsavel as string,
    observacoes: r.observacoes as string,
    criado_em: r.criado_em instanceof Date ? r.criado_em.toISOString() : (r.criado_em as string),
    data: (r.data as string) ?? undefined,
    hora: (r.hora as string) ?? undefined,
    numero_processo: (r.numero_processo as string) ?? undefined,
    protocolo: (r.protocolo as Inicial["protocolo"]) ?? undefined,
  };
}

export async function list(tenantId: string): Promise<Inicial[]> {
  if (!hasDb()) return (await getDataAsync(tenantId)).iniciais;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM iniciais WHERE tenant_id = ${tenantId}` as Record<string, unknown>[];
  return rows.map(rowToInicial);
}

export async function get(tenantId: string, id: string): Promise<Inicial | null> {
  if (!hasDb()) return (await getDataAsync(tenantId)).iniciais.find(i => i.id === id) ?? null;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM iniciais WHERE tenant_id = ${tenantId} AND id = ${id}` as Record<string, unknown>[];
  return rows[0] ? rowToInicial(rows[0]) : null;
}

export async function create(tenantId: string, input: Omit<Inicial, "id" | "criado_em">): Promise<Inicial> {
  const row: Inicial = { ...input, id: newId(), criado_em: new Date().toISOString() };
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.iniciais.push(row);
    await saveDataAsync(data, tenantId);
    return row;
  }
  const sql = getSql()!;
  await sql`
    INSERT INTO iniciais (tenant_id, id, cliente, reu, objeto, andamento, responsavel, observacoes,
                           data, hora, numero_processo, protocolo, criado_em)
    VALUES (${tenantId}, ${row.id}, ${row.cliente}, ${row.reu}, ${row.objeto}, ${row.andamento}, ${row.responsavel},
            ${row.observacoes}, ${row.data ?? null}, ${row.hora ?? null}, ${row.numero_processo ?? null},
            ${row.protocolo ? JSON.stringify(row.protocolo) : null}, ${row.criado_em})
  `;
  return row;
}

// Constrói (sem executar) o UPDATE — usado por update() e por rotas que precisam agrupar
// essa escrita com a de outra entidade numa única transação (ex.: iniciais/protocolo, que
// marca a inicial como protocolada e cria o processo correspondente ao mesmo tempo).
export function buildUpdateStatement(tenantId: string, merged: Inicial) {
  const sql = getSql()!;
  return sql`
    UPDATE iniciais SET cliente = ${merged.cliente}, reu = ${merged.reu}, objeto = ${merged.objeto},
      andamento = ${merged.andamento}, responsavel = ${merged.responsavel}, observacoes = ${merged.observacoes},
      data = ${merged.data ?? null}, hora = ${merged.hora ?? null}, numero_processo = ${merged.numero_processo ?? null},
      protocolo = ${merged.protocolo ? JSON.stringify(merged.protocolo) : null}
    WHERE tenant_id = ${tenantId} AND id = ${merged.id}
  `;
}

export async function update(tenantId: string, id: string, patch: Partial<Inicial>): Promise<Inicial | null> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const idx = data.iniciais.findIndex(i => i.id === id);
    if (idx === -1) return null;
    data.iniciais[idx] = { ...data.iniciais[idx], ...patch };
    await saveDataAsync(data, tenantId);
    return data.iniciais[idx];
  }
  const current = await get(tenantId, id);
  if (!current) return null;
  const merged = { ...current, ...patch };
  await buildUpdateStatement(tenantId, merged);
  return merged;
}

export async function remove(tenantId: string, id: string): Promise<boolean> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const before = data.iniciais.length;
    data.iniciais = data.iniciais.filter(i => i.id !== id);
    await saveDataAsync(data, tenantId);
    return data.iniciais.length < before;
  }
  const sql = getSql()!;
  const rows = await sql`DELETE FROM iniciais WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING id` as unknown[];
  return rows.length > 0;
}

// Upsert em lote preservando ids existentes — usado por controle/importar/route.ts.
export async function upsertMany(tenantId: string, rows: Inicial[]): Promise<void> {
  if (!hasDb() || rows.length === 0) return;
  const sql = getSql()!;
  const statements = rows.map(row => sql`
    INSERT INTO iniciais (tenant_id, id, cliente, reu, objeto, andamento, responsavel, observacoes,
                           data, hora, numero_processo, protocolo, criado_em)
    VALUES (${tenantId}, ${row.id}, ${row.cliente}, ${row.reu}, ${row.objeto}, ${row.andamento}, ${row.responsavel},
            ${row.observacoes}, ${row.data ?? null}, ${row.hora ?? null}, ${row.numero_processo ?? null},
            ${row.protocolo ? JSON.stringify(row.protocolo) : null}, ${row.criado_em})
    ON CONFLICT (tenant_id, id) DO UPDATE SET cliente = EXCLUDED.cliente, reu = EXCLUDED.reu, objeto = EXCLUDED.objeto,
      andamento = EXCLUDED.andamento, responsavel = EXCLUDED.responsavel, observacoes = EXCLUDED.observacoes,
      data = EXCLUDED.data, hora = EXCLUDED.hora, numero_processo = EXCLUDED.numero_processo,
      protocolo = EXCLUDED.protocolo
  `);
  for (let i = 0; i < statements.length; i += 200) {
    await sql.transaction(statements.slice(i, i + 200));
  }
}
