import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, newId, type Acordo } from "@/lib/financeiro-data";

function rowToAcordo(r: Record<string, unknown>): Acordo {
  return {
    id: r.id as string,
    mes: r.mes as string,
    data_pagamento: r.data_pagamento as string,
    cliente: r.cliente as string,
    reu: r.reu as string,
    objeto: r.objeto as string,
    processo: r.processo as string,
    processoId: (r.processo_id as string) ?? undefined,
    valor_acordo: Number(r.valor_acordo),
    honorarios: Number(r.honorarios),
    status: r.status as Acordo["status"],
  };
}

export async function list(tenantId: string): Promise<Acordo[]> {
  if (!hasDb()) return (await getDataAsync(tenantId)).acordos;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM acordos WHERE tenant_id = ${tenantId} ORDER BY mes` as Record<string, unknown>[];
  return rows.map(rowToAcordo);
}

export async function get(tenantId: string, id: string): Promise<Acordo | null> {
  if (!hasDb()) return (await getDataAsync(tenantId)).acordos.find(a => a.id === id) ?? null;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM acordos WHERE tenant_id = ${tenantId} AND id = ${id}` as Record<string, unknown>[];
  return rows[0] ? rowToAcordo(rows[0]) : null;
}

export async function create(tenantId: string, input: Omit<Acordo, "id">): Promise<Acordo> {
  const row: Acordo = { ...input, id: newId() };
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.acordos.push(row);
    await saveDataAsync(data, tenantId);
    return row;
  }
  const sql = getSql()!;
  await sql`
    INSERT INTO acordos (tenant_id, id, mes, data_pagamento, cliente, reu, objeto, processo, processo_id,
                          valor_acordo, honorarios, status)
    VALUES (${tenantId}, ${row.id}, ${row.mes}, ${row.data_pagamento}, ${row.cliente}, ${row.reu}, ${row.objeto},
            ${row.processo}, ${row.processoId ?? null}, ${row.valor_acordo}, ${row.honorarios}, ${row.status})
  `;
  return row;
}

export async function update(tenantId: string, id: string, patch: Partial<Acordo>): Promise<Acordo | null> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const idx = data.acordos.findIndex(a => a.id === id);
    if (idx === -1) return null;
    data.acordos[idx] = { ...data.acordos[idx], ...patch };
    await saveDataAsync(data, tenantId);
    return data.acordos[idx];
  }
  const current = await get(tenantId, id);
  if (!current) return null;
  const merged = { ...current, ...patch };
  const sql = getSql()!;
  await sql`
    UPDATE acordos SET mes = ${merged.mes}, data_pagamento = ${merged.data_pagamento}, cliente = ${merged.cliente},
      reu = ${merged.reu}, objeto = ${merged.objeto}, processo = ${merged.processo},
      processo_id = ${merged.processoId ?? null}, valor_acordo = ${merged.valor_acordo},
      honorarios = ${merged.honorarios}, status = ${merged.status}
    WHERE tenant_id = ${tenantId} AND id = ${id}
  `;
  return merged;
}

export async function remove(tenantId: string, id: string): Promise<boolean> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const before = data.acordos.length;
    data.acordos = data.acordos.filter(a => a.id !== id);
    await saveDataAsync(data, tenantId);
    return data.acordos.length < before;
  }
  const sql = getSql()!;
  const rows = await sql`DELETE FROM acordos WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING id` as unknown[];
  return rows.length > 0;
}

// Constrói (sem executar) os upserts em lote (ids já existentes nas linhas, diferente de
// create(), que sempre gera um id novo) — usado por upsertMany() e por
// controle/importar/route.ts, que agrupa os statements de todas as entidades importadas
// numa única transação (Fase 6 da migração).
export function buildUpsertManyStatements(tenantId: string, rows: Acordo[]) {
  const sql = getSql()!;
  return rows.map(row => sql`
    INSERT INTO acordos (tenant_id, id, mes, data_pagamento, cliente, reu, objeto, processo, processo_id,
                          valor_acordo, honorarios, status)
    VALUES (${tenantId}, ${row.id}, ${row.mes}, ${row.data_pagamento}, ${row.cliente}, ${row.reu}, ${row.objeto},
            ${row.processo}, ${row.processoId ?? null}, ${row.valor_acordo}, ${row.honorarios}, ${row.status})
    ON CONFLICT (tenant_id, id) DO UPDATE SET mes = EXCLUDED.mes, data_pagamento = EXCLUDED.data_pagamento,
      cliente = EXCLUDED.cliente, reu = EXCLUDED.reu, objeto = EXCLUDED.objeto, processo = EXCLUDED.processo,
      processo_id = EXCLUDED.processo_id, valor_acordo = EXCLUDED.valor_acordo,
      honorarios = EXCLUDED.honorarios, status = EXCLUDED.status
  `);
}

// Upsert em lote preservando os ids já existentes nas linhas.
export async function upsertMany(tenantId: string, rows: Acordo[]): Promise<void> {
  if (!hasDb() || rows.length === 0) return;
  const sql = getSql()!;
  const statements = buildUpsertManyStatements(tenantId, rows);
  for (let i = 0; i < statements.length; i += 200) {
    await sql.transaction(statements.slice(i, i + 200));
  }
}
