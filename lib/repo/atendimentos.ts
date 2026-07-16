import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, newId, type Atendimento } from "@/lib/controle-data";

function rowToAtendimento(r: Record<string, unknown>): Atendimento {
  return {
    id: r.id as string,
    data: r.data as string,
    hora: r.hora as string,
    cliente: r.cliente as string,
    cliente_id: (r.cliente_id as string) ?? undefined,
    telefone: r.telefone as string,
    forma: r.forma as string,
    observacoes: r.observacoes as string,
    status: r.status as string,
    responsavel: r.responsavel as string,
    processo_id: (r.processo_id as string) ?? undefined,
    criado_em: r.criado_em instanceof Date ? r.criado_em.toISOString() : (r.criado_em as string),
  };
}

export async function list(tenantId: string): Promise<Atendimento[]> {
  if (!hasDb()) return (await getDataAsync(tenantId)).atendimentos;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM atendimentos WHERE tenant_id = ${tenantId}` as Record<string, unknown>[];
  return rows.map(rowToAtendimento);
}

export async function get(tenantId: string, id: string): Promise<Atendimento | null> {
  if (!hasDb()) return (await getDataAsync(tenantId)).atendimentos.find(a => a.id === id) ?? null;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM atendimentos WHERE tenant_id = ${tenantId} AND id = ${id}` as Record<string, unknown>[];
  return rows[0] ? rowToAtendimento(rows[0]) : null;
}

// Constrói (sem executar) o INSERT — usado por create() e por rotas que precisam agrupar
// essa escrita com a de outra entidade numa única transação (ex.: concluir, que cadastra
// um cliente e vincula o atendimento ao mesmo tempo).
export function buildCreateStatement(tenantId: string, row: Atendimento) {
  const sql = getSql()!;
  return sql`
    INSERT INTO atendimentos (tenant_id, id, data, hora, cliente, cliente_id, telefone, forma,
                               observacoes, status, responsavel, processo_id, criado_em)
    VALUES (${tenantId}, ${row.id}, ${row.data}, ${row.hora}, ${row.cliente}, ${row.cliente_id ?? null},
            ${row.telefone}, ${row.forma}, ${row.observacoes}, ${row.status}, ${row.responsavel},
            ${row.processo_id ?? null}, ${row.criado_em})
  `;
}

export async function create(tenantId: string, input: Omit<Atendimento, "id" | "criado_em">): Promise<Atendimento> {
  const row: Atendimento = { ...input, id: newId(), criado_em: new Date().toISOString() };
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.atendimentos.push(row);
    await saveDataAsync(data, tenantId);
    return row;
  }
  await buildCreateStatement(tenantId, row);
  return row;
}

// Constrói (sem executar) o UPDATE — usado por update() e por rotas que precisam agrupar
// essa escrita com a de outra entidade numa única transação (ex.: concluir/criar-processo).
export function buildUpdateStatement(tenantId: string, merged: Atendimento) {
  const sql = getSql()!;
  return sql`
    UPDATE atendimentos SET data = ${merged.data}, hora = ${merged.hora}, cliente = ${merged.cliente},
      cliente_id = ${merged.cliente_id ?? null}, telefone = ${merged.telefone}, forma = ${merged.forma},
      observacoes = ${merged.observacoes}, status = ${merged.status}, responsavel = ${merged.responsavel},
      processo_id = ${merged.processo_id ?? null}
    WHERE tenant_id = ${tenantId} AND id = ${merged.id}
  `;
}

export async function update(tenantId: string, id: string, patch: Partial<Atendimento>): Promise<Atendimento | null> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const idx = data.atendimentos.findIndex(a => a.id === id);
    if (idx === -1) return null;
    data.atendimentos[idx] = { ...data.atendimentos[idx], ...patch };
    await saveDataAsync(data, tenantId);
    return data.atendimentos[idx];
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
    const before = data.atendimentos.length;
    data.atendimentos = data.atendimentos.filter(a => a.id !== id);
    await saveDataAsync(data, tenantId);
    return data.atendimentos.length < before;
  }
  const sql = getSql()!;
  const rows = await sql`DELETE FROM atendimentos WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING id` as unknown[];
  return rows.length > 0;
}
