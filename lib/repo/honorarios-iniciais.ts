import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, newId, type HonorarioInicial } from "@/lib/financeiro-data";

function rowToHonorarioInicial(r: Record<string, unknown>): HonorarioInicial {
  return {
    id: r.id as string,
    mes: (r.mes as string) ?? undefined,
    cliente: r.cliente as string,
    processo: r.processo as string,
    valor: Number(r.valor),
    data_pagamento: r.data_pagamento as string,
    observacao: r.observacao as string,
    status: r.status as HonorarioInicial["status"],
    processoId: (r.processo_id as string) ?? undefined,
  };
}

export async function list(tenantId: string): Promise<HonorarioInicial[]> {
  if (!hasDb()) return (await getDataAsync(tenantId)).honorarios_iniciais;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM honorarios_iniciais WHERE tenant_id = ${tenantId} ORDER BY mes` as Record<string, unknown>[];
  return rows.map(rowToHonorarioInicial);
}

export async function get(tenantId: string, id: string): Promise<HonorarioInicial | null> {
  if (!hasDb()) return (await getDataAsync(tenantId)).honorarios_iniciais.find(h => h.id === id) ?? null;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM honorarios_iniciais WHERE tenant_id = ${tenantId} AND id = ${id}` as Record<string, unknown>[];
  return rows[0] ? rowToHonorarioInicial(rows[0]) : null;
}

export async function create(tenantId: string, input: Omit<HonorarioInicial, "id">): Promise<HonorarioInicial> {
  const row: HonorarioInicial = { ...input, id: newId() };
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.honorarios_iniciais.push(row);
    await saveDataAsync(data, tenantId);
    return row;
  }
  const sql = getSql()!;
  await sql`
    INSERT INTO honorarios_iniciais (tenant_id, id, mes, cliente, processo, processo_id, valor,
                                      data_pagamento, observacao, status)
    VALUES (${tenantId}, ${row.id}, ${row.mes ?? null}, ${row.cliente}, ${row.processo}, ${row.processoId ?? null},
            ${row.valor}, ${row.data_pagamento}, ${row.observacao}, ${row.status})
  `;
  return row;
}

export async function update(tenantId: string, id: string, patch: Partial<HonorarioInicial>): Promise<HonorarioInicial | null> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const idx = data.honorarios_iniciais.findIndex(h => h.id === id);
    if (idx === -1) return null;
    data.honorarios_iniciais[idx] = { ...data.honorarios_iniciais[idx], ...patch };
    await saveDataAsync(data, tenantId);
    return data.honorarios_iniciais[idx];
  }
  const current = await get(tenantId, id);
  if (!current) return null;
  const merged = { ...current, ...patch };
  const sql = getSql()!;
  await sql`
    UPDATE honorarios_iniciais SET mes = ${merged.mes ?? null}, cliente = ${merged.cliente},
      processo = ${merged.processo}, processo_id = ${merged.processoId ?? null}, valor = ${merged.valor},
      data_pagamento = ${merged.data_pagamento}, observacao = ${merged.observacao}, status = ${merged.status}
    WHERE tenant_id = ${tenantId} AND id = ${id}
  `;
  return merged;
}

export async function remove(tenantId: string, id: string): Promise<boolean> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const before = data.honorarios_iniciais.length;
    data.honorarios_iniciais = data.honorarios_iniciais.filter(h => h.id !== id);
    await saveDataAsync(data, tenantId);
    return data.honorarios_iniciais.length < before;
  }
  const sql = getSql()!;
  const rows = await sql`DELETE FROM honorarios_iniciais WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING id` as unknown[];
  return rows.length > 0;
}

// Upsert em lote preservando ids existentes — ver comentário equivalente em lib/repo/acordos.ts.
export async function upsertMany(tenantId: string, rows: HonorarioInicial[]): Promise<void> {
  if (!hasDb() || rows.length === 0) return;
  const sql = getSql()!;
  const statements = rows.map(row => sql`
    INSERT INTO honorarios_iniciais (tenant_id, id, mes, cliente, processo, processo_id, valor,
                                      data_pagamento, observacao, status)
    VALUES (${tenantId}, ${row.id}, ${row.mes ?? null}, ${row.cliente}, ${row.processo}, ${row.processoId ?? null},
            ${row.valor}, ${row.data_pagamento}, ${row.observacao}, ${row.status})
    ON CONFLICT (tenant_id, id) DO UPDATE SET mes = EXCLUDED.mes, cliente = EXCLUDED.cliente,
      processo = EXCLUDED.processo, processo_id = EXCLUDED.processo_id, valor = EXCLUDED.valor,
      data_pagamento = EXCLUDED.data_pagamento, observacao = EXCLUDED.observacao, status = EXCLUDED.status
  `);
  for (let i = 0; i < statements.length; i += 200) {
    await sql.transaction(statements.slice(i, i + 200));
  }
}
