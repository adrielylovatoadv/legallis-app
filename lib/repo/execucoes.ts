import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, newId, type Execucao } from "@/lib/financeiro-data";

function rowToExecucao(r: Record<string, unknown>): Execucao {
  return {
    id: r.id as string,
    mes: r.mes as string,
    data_pagamento: r.data_pagamento as string,
    cliente: r.cliente as string,
    reu: r.reu as string,
    processo: r.processo as string,
    tipo_execucao: (r.tipo_execucao as Execucao["tipo_execucao"]) ?? undefined,
    valor_percebido: Number(r.valor_percebido),
    pct_honorarios: r.pct_honorarios != null ? Number(r.pct_honorarios) : undefined,
    sucumbencia: Number(r.sucumbencia),
    honorarios: Number(r.honorarios),
    repasse_cliente: r.repasse_cliente != null ? Number(r.repasse_cliente) : undefined,
    status: r.status as Execucao["status"],
    processoId: (r.processo_id as string) ?? undefined,
  };
}

export async function list(tenantId: string): Promise<Execucao[]> {
  if (!hasDb()) return (await getDataAsync(tenantId)).execucoes;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM execucoes WHERE tenant_id = ${tenantId} ORDER BY mes` as Record<string, unknown>[];
  return rows.map(rowToExecucao);
}

export async function get(tenantId: string, id: string): Promise<Execucao | null> {
  if (!hasDb()) return (await getDataAsync(tenantId)).execucoes.find(e => e.id === id) ?? null;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM execucoes WHERE tenant_id = ${tenantId} AND id = ${id}` as Record<string, unknown>[];
  return rows[0] ? rowToExecucao(rows[0]) : null;
}

export async function create(tenantId: string, input: Omit<Execucao, "id">): Promise<Execucao> {
  const row: Execucao = { ...input, id: newId() };
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.execucoes.push(row);
    await saveDataAsync(data, tenantId);
    return row;
  }
  const sql = getSql()!;
  await sql`
    INSERT INTO execucoes (tenant_id, id, mes, data_pagamento, cliente, reu, processo, processo_id,
                            tipo_execucao, valor_percebido, pct_honorarios, sucumbencia, honorarios,
                            repasse_cliente, status)
    VALUES (${tenantId}, ${row.id}, ${row.mes}, ${row.data_pagamento}, ${row.cliente}, ${row.reu}, ${row.processo},
            ${row.processoId ?? null}, ${row.tipo_execucao ?? null}, ${row.valor_percebido},
            ${row.pct_honorarios ?? null}, ${row.sucumbencia}, ${row.honorarios}, ${row.repasse_cliente ?? null},
            ${row.status})
  `;
  return row;
}

export async function update(tenantId: string, id: string, patch: Partial<Execucao>): Promise<Execucao | null> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const idx = data.execucoes.findIndex(e => e.id === id);
    if (idx === -1) return null;
    data.execucoes[idx] = { ...data.execucoes[idx], ...patch };
    await saveDataAsync(data, tenantId);
    return data.execucoes[idx];
  }
  const current = await get(tenantId, id);
  if (!current) return null;
  const merged = { ...current, ...patch };
  const sql = getSql()!;
  await sql`
    UPDATE execucoes SET mes = ${merged.mes}, data_pagamento = ${merged.data_pagamento}, cliente = ${merged.cliente},
      reu = ${merged.reu}, processo = ${merged.processo}, processo_id = ${merged.processoId ?? null},
      tipo_execucao = ${merged.tipo_execucao ?? null}, valor_percebido = ${merged.valor_percebido},
      pct_honorarios = ${merged.pct_honorarios ?? null}, sucumbencia = ${merged.sucumbencia},
      honorarios = ${merged.honorarios}, repasse_cliente = ${merged.repasse_cliente ?? null}, status = ${merged.status}
    WHERE tenant_id = ${tenantId} AND id = ${id}
  `;
  return merged;
}

export async function remove(tenantId: string, id: string): Promise<boolean> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const before = data.execucoes.length;
    data.execucoes = data.execucoes.filter(e => e.id !== id);
    await saveDataAsync(data, tenantId);
    return data.execucoes.length < before;
  }
  const sql = getSql()!;
  const rows = await sql`DELETE FROM execucoes WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING id` as unknown[];
  return rows.length > 0;
}

// Constrói (sem executar) os upserts em lote — ver comentário equivalente em lib/repo/acordos.ts.
export function buildUpsertManyStatements(tenantId: string, rows: Execucao[]) {
  const sql = getSql()!;
  return rows.map(row => sql`
    INSERT INTO execucoes (tenant_id, id, mes, data_pagamento, cliente, reu, processo, processo_id,
                            tipo_execucao, valor_percebido, pct_honorarios, sucumbencia, honorarios,
                            repasse_cliente, status)
    VALUES (${tenantId}, ${row.id}, ${row.mes}, ${row.data_pagamento}, ${row.cliente}, ${row.reu}, ${row.processo},
            ${row.processoId ?? null}, ${row.tipo_execucao ?? null}, ${row.valor_percebido},
            ${row.pct_honorarios ?? null}, ${row.sucumbencia}, ${row.honorarios}, ${row.repasse_cliente ?? null},
            ${row.status})
    ON CONFLICT (tenant_id, id) DO UPDATE SET mes = EXCLUDED.mes, data_pagamento = EXCLUDED.data_pagamento,
      cliente = EXCLUDED.cliente, reu = EXCLUDED.reu, processo = EXCLUDED.processo,
      processo_id = EXCLUDED.processo_id, tipo_execucao = EXCLUDED.tipo_execucao,
      valor_percebido = EXCLUDED.valor_percebido, pct_honorarios = EXCLUDED.pct_honorarios,
      sucumbencia = EXCLUDED.sucumbencia, honorarios = EXCLUDED.honorarios,
      repasse_cliente = EXCLUDED.repasse_cliente, status = EXCLUDED.status
  `);
}

// Upsert em lote preservando ids existentes.
export async function upsertMany(tenantId: string, rows: Execucao[]): Promise<void> {
  if (!hasDb() || rows.length === 0) return;
  const sql = getSql()!;
  const statements = buildUpsertManyStatements(tenantId, rows);
  for (let i = 0; i < statements.length; i += 200) {
    await sql.transaction(statements.slice(i, i + 200));
  }
}
