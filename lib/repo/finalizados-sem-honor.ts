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

// Constrói (sem executar) o INSERT — usado por create() e por rotas que precisam agrupar
// essa escrita com a de outra entidade numa única transação (ex.: processos/[id] PUT,
// que finaliza um processo e insere em finalizados_sem_honor ao mesmo tempo).
export function buildCreateStatement(tenantId: string, row: FinalizadoSemHonor) {
  const sql = getSql()!;
  return sql`
    INSERT INTO finalizados_sem_honor (tenant_id, id, cliente, reu, processo, objeto, data_fin, motivo)
    VALUES (${tenantId}, ${row.id}, ${row.cliente}, ${row.reu}, ${row.processo}, ${row.objeto}, ${row.data_fin}, ${row.motivo})
  `;
}

// Constrói (sem executar) o DELETE — usado por remove() e por finalizados/reabrir/route.ts,
// que remove o finalizado e reabre o processo correspondente numa única transação.
export function buildRemoveStatement(tenantId: string, id: string) {
  const sql = getSql()!;
  return sql`DELETE FROM finalizados_sem_honor WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING id`;
}

export async function create(tenantId: string, input: Omit<FinalizadoSemHonor, "id">): Promise<FinalizadoSemHonor> {
  const row: FinalizadoSemHonor = { ...input, id: newId() };
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.finalizados_externos_sem_honor = [...(data.finalizados_externos_sem_honor || []), row];
    await saveDataAsync(data, tenantId);
    return row;
  }
  await buildCreateStatement(tenantId, row);
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

// Constrói (sem executar) os upserts em lote — usado por upsertMany() e por
// controle/importar/route.ts, que agrupa os statements de todas as entidades importadas
// numa única transação (Fase 6 da migração).
export function buildUpsertManyStatements(tenantId: string, rows: FinalizadoSemHonor[]) {
  const sql = getSql()!;
  return rows.filter(r => r.id).map(row => sql`
    INSERT INTO finalizados_sem_honor (tenant_id, id, cliente, reu, processo, objeto, data_fin, motivo)
    VALUES (${tenantId}, ${row.id}, ${row.cliente}, ${row.reu}, ${row.processo}, ${row.objeto}, ${row.data_fin}, ${row.motivo})
    ON CONFLICT (tenant_id, id) DO UPDATE SET cliente = EXCLUDED.cliente, reu = EXCLUDED.reu, processo = EXCLUDED.processo,
      objeto = EXCLUDED.objeto, data_fin = EXCLUDED.data_fin, motivo = EXCLUDED.motivo
  `);
}

// Upsert em lote preservando ids existentes.
export async function upsertMany(tenantId: string, rows: FinalizadoSemHonor[]): Promise<void> {
  if (!hasDb() || rows.length === 0) return;
  const sql = getSql()!;
  const statements = buildUpsertManyStatements(tenantId, rows);
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
  const rows = await buildRemoveStatement(tenantId, id) as unknown[];
  return rows.length > 0;
}
