import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, newId, type FinalizadoSemHonor } from "@/lib/controle-data";

function rowToFinalizado(r: Record<string, unknown>): FinalizadoSemHonor {
  return {
    id: r.id as string,
    cliente: r.cliente as string,
    reu: r.reu as string,
    processo: r.processo as string,
    objeto: r.objeto as string,
    data_fin: r.data_fin as string,
    motivo: r.motivo as string,
  };
}

export async function list(tenantId: string): Promise<FinalizadoSemHonor[]> {
  if (!hasDb()) return (await getDataAsync(tenantId)).finalizados_externos_sem_honor || [];
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM finalizados_sem_honor WHERE tenant_id = ${tenantId} ORDER BY criado_em` as Record<string, unknown>[];
  return rows.map(rowToFinalizado);
}

export async function get(tenantId: string, id: string): Promise<FinalizadoSemHonor | null> {
  if (!hasDb()) return (await getDataAsync(tenantId)).finalizados_externos_sem_honor?.find(f => f.id === id) ?? null;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM finalizados_sem_honor WHERE tenant_id = ${tenantId} AND id = ${id}` as Record<string, unknown>[];
  return rows[0] ? rowToFinalizado(rows[0]) : null;
}

export async function create(tenantId: string, input: Omit<FinalizadoSemHonor, "id">): Promise<FinalizadoSemHonor> {
  const row: FinalizadoSemHonor = { ...input, id: newId() };
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.finalizados_externos_sem_honor = [...(data.finalizados_externos_sem_honor || []), row];
    await saveDataAsync(data, tenantId);
    return row;
  }
  const sql = getSql()!;
  await sql`
    INSERT INTO finalizados_sem_honor (tenant_id, id, cliente, reu, processo, objeto, data_fin, motivo)
    VALUES (${tenantId}, ${row.id}, ${row.cliente}, ${row.reu}, ${row.processo}, ${row.objeto}, ${row.data_fin}, ${row.motivo})
  `;
  return row;
}

export async function update(tenantId: string, id: string, patch: Partial<FinalizadoSemHonor>): Promise<FinalizadoSemHonor | null> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const list = data.finalizados_externos_sem_honor || [];
    const idx = list.findIndex(f => f.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    data.finalizados_externos_sem_honor = list;
    await saveDataAsync(data, tenantId);
    return list[idx];
  }
  const current = await get(tenantId, id);
  if (!current) return null;
  const merged = { ...current, ...patch };
  const sql = getSql()!;
  await sql`
    UPDATE finalizados_sem_honor SET cliente = ${merged.cliente}, reu = ${merged.reu}, processo = ${merged.processo},
      objeto = ${merged.objeto}, data_fin = ${merged.data_fin}, motivo = ${merged.motivo}
    WHERE tenant_id = ${tenantId} AND id = ${id}
  `;
  return merged;
}

// Upsert em lote preservando ids existentes — usado por controle/importar/route.ts.
export async function upsertMany(tenantId: string, rows: FinalizadoSemHonor[]): Promise<void> {
  if (!hasDb() || rows.length === 0) return;
  const sql = getSql()!;
  const statements = rows.filter(r => r.id).map(row => sql`
    INSERT INTO finalizados_sem_honor (tenant_id, id, cliente, reu, processo, objeto, data_fin, motivo)
    VALUES (${tenantId}, ${row.id}, ${row.cliente}, ${row.reu}, ${row.processo}, ${row.objeto}, ${row.data_fin}, ${row.motivo})
    ON CONFLICT (tenant_id, id) DO UPDATE SET cliente = EXCLUDED.cliente, reu = EXCLUDED.reu, processo = EXCLUDED.processo,
      objeto = EXCLUDED.objeto, data_fin = EXCLUDED.data_fin, motivo = EXCLUDED.motivo
  `);
  for (let i = 0; i < statements.length; i += 200) {
    await sql.transaction(statements.slice(i, i + 200));
  }
}

export async function remove(tenantId: string, id: string): Promise<boolean> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const list = data.finalizados_externos_sem_honor || [];
    const before = list.length;
    data.finalizados_externos_sem_honor = list.filter(f => f.id !== id);
    await saveDataAsync(data, tenantId);
    return (data.finalizados_externos_sem_honor?.length ?? 0) < before;
  }
  const sql = getSql()!;
  const rows = await sql`DELETE FROM finalizados_sem_honor WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING id` as unknown[];
  return rows.length > 0;
}
