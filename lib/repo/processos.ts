import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, newId, type Processo } from "@/lib/controle-data";

function rowToProcesso(r: Record<string, unknown>): Processo {
  return {
    id: r.id as string,
    autor: r.autor as string,
    reu: r.reu as string,
    objeto: r.objeto as string,
    numero_processo: r.numero_processo as string,
    data: r.data as string,
    hora: r.hora as string,
    andamento: r.andamento as string,
    responsavel: r.responsavel as string,
    observacoes: r.observacoes as string,
    atencao: !!r.atencao,
    finalizado: !!r.finalizado,
    criado_em: r.criado_em instanceof Date ? r.criado_em.toISOString() : (r.criado_em as string),
    dashboard_ok: r.dashboard_ok != null ? !!r.dashboard_ok : undefined,
    vara: (r.vara as string) ?? undefined,
    tribunal: (r.tribunal as string) ?? undefined,
  };
}

export async function list(tenantId: string): Promise<Processo[]> {
  if (!hasDb()) return (await getDataAsync(tenantId)).processos;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM processos WHERE tenant_id = ${tenantId}` as Record<string, unknown>[];
  return rows.map(rowToProcesso);
}

export async function get(tenantId: string, id: string): Promise<Processo | null> {
  if (!hasDb()) return (await getDataAsync(tenantId)).processos.find(p => p.id === id) ?? null;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM processos WHERE tenant_id = ${tenantId} AND id = ${id}` as Record<string, unknown>[];
  return rows[0] ? rowToProcesso(rows[0]) : null;
}

// Constrói (sem executar) o INSERT de um processo — usado por create() e por rotas que
// precisam agrupar essa escrita com a de outra entidade numa única transação (ex.:
// iniciais/protocolo, que marca a inicial como protocolada e cria o processo ao mesmo tempo).
export function buildCreateStatement(tenantId: string, row: Processo) {
  const sql = getSql()!;
  return sql`
    INSERT INTO processos (tenant_id, id, autor, reu, objeto, numero_processo, data, hora, andamento,
                            responsavel, observacoes, atencao, finalizado, dashboard_ok, vara, tribunal, criado_em)
    VALUES (${tenantId}, ${row.id}, ${row.autor}, ${row.reu}, ${row.objeto}, ${row.numero_processo}, ${row.data},
            ${row.hora}, ${row.andamento}, ${row.responsavel}, ${row.observacoes}, ${row.atencao}, ${row.finalizado},
            ${row.dashboard_ok ?? null}, ${row.vara ?? null}, ${row.tribunal ?? null}, ${row.criado_em})
  `;
}

export async function create(tenantId: string, input: Omit<Processo, "id" | "criado_em">): Promise<Processo> {
  const row: Processo = { ...input, id: newId(), criado_em: new Date().toISOString() };
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.processos.push(row);
    await saveDataAsync(data, tenantId);
    return row;
  }
  await buildCreateStatement(tenantId, row);
  return row;
}

// Constrói (sem executar) o UPDATE de um processo — usado tanto por update() (chamada solta)
// quanto por rotas que precisam agrupar esse UPDATE com escritas de outra entidade numa
// única transação (ex.: processos/[id] PUT, que também pode inserir em finalizados_sem_honor).
export function buildUpdateStatement(tenantId: string, merged: Processo) {
  const sql = getSql()!;
  return sql`
    UPDATE processos SET autor = ${merged.autor}, reu = ${merged.reu}, objeto = ${merged.objeto},
      numero_processo = ${merged.numero_processo}, data = ${merged.data}, hora = ${merged.hora},
      andamento = ${merged.andamento}, responsavel = ${merged.responsavel}, observacoes = ${merged.observacoes},
      atencao = ${merged.atencao}, finalizado = ${merged.finalizado}, dashboard_ok = ${merged.dashboard_ok ?? null},
      vara = ${merged.vara ?? null}, tribunal = ${merged.tribunal ?? null}
    WHERE tenant_id = ${tenantId} AND id = ${merged.id}
  `;
}

export async function update(tenantId: string, id: string, patch: Partial<Processo>): Promise<Processo | null> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const idx = data.processos.findIndex(p => p.id === id);
    if (idx === -1) return null;
    data.processos[idx] = { ...data.processos[idx], ...patch };
    await saveDataAsync(data, tenantId);
    return data.processos[idx];
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
    const before = data.processos.length;
    data.processos = data.processos.filter(p => p.id !== id);
    await saveDataAsync(data, tenantId);
    return data.processos.length < before;
  }
  const sql = getSql()!;
  const rows = await sql`DELETE FROM processos WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING id` as unknown[];
  return rows.length > 0;
}

// Upsert em lote preservando ids existentes — usado por controle/importar/route.ts.
export async function upsertMany(tenantId: string, rows: Processo[]): Promise<void> {
  if (!hasDb() || rows.length === 0) return;
  const sql = getSql()!;
  const statements = rows.map(row => sql`
    INSERT INTO processos (tenant_id, id, autor, reu, objeto, numero_processo, data, hora, andamento,
                            responsavel, observacoes, atencao, finalizado, dashboard_ok, vara, tribunal, criado_em)
    VALUES (${tenantId}, ${row.id}, ${row.autor}, ${row.reu}, ${row.objeto}, ${row.numero_processo}, ${row.data},
            ${row.hora}, ${row.andamento}, ${row.responsavel}, ${row.observacoes}, ${row.atencao}, ${row.finalizado},
            ${row.dashboard_ok ?? null}, ${row.vara ?? null}, ${row.tribunal ?? null}, ${row.criado_em})
    ON CONFLICT (tenant_id, id) DO UPDATE SET autor = EXCLUDED.autor, reu = EXCLUDED.reu, objeto = EXCLUDED.objeto,
      numero_processo = EXCLUDED.numero_processo, data = EXCLUDED.data, hora = EXCLUDED.hora,
      andamento = EXCLUDED.andamento, responsavel = EXCLUDED.responsavel, observacoes = EXCLUDED.observacoes,
      atencao = EXCLUDED.atencao, finalizado = EXCLUDED.finalizado, dashboard_ok = EXCLUDED.dashboard_ok,
      vara = EXCLUDED.vara, tribunal = EXCLUDED.tribunal
  `);
  for (let i = 0; i < statements.length; i += 200) {
    await sql.transaction(statements.slice(i, i + 200));
  }
}
