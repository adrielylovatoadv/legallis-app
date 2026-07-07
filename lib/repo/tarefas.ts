import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, newId, type Tarefa } from "@/lib/controle-data";

function rowToTarefa(r: Record<string, unknown>): Tarefa {
  return {
    id: r.id as string,
    titulo: r.titulo as string,
    descricao: r.descricao as string,
    status: r.status as Tarefa["status"],
    responsavel: r.responsavel as string,
    criado_em: r.criado_em instanceof Date ? r.criado_em.toISOString() : (r.criado_em as string),
    prazo: (r.prazo as string) ?? undefined,
    processo_id: (r.processo_id as string) ?? undefined,
    processo_titulo: (r.processo_titulo as string) ?? undefined,
  };
}

export async function list(tenantId: string): Promise<Tarefa[]> {
  if (!hasDb()) return (await getDataAsync(tenantId)).tarefas;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM tarefas WHERE tenant_id = ${tenantId} ORDER BY criado_em DESC` as Record<string, unknown>[];
  return rows.map(rowToTarefa);
}

export async function get(tenantId: string, id: string): Promise<Tarefa | null> {
  if (!hasDb()) return (await getDataAsync(tenantId)).tarefas.find(t => t.id === id) ?? null;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM tarefas WHERE tenant_id = ${tenantId} AND id = ${id}` as Record<string, unknown>[];
  return rows[0] ? rowToTarefa(rows[0]) : null;
}

export async function create(tenantId: string, input: Omit<Tarefa, "id" | "criado_em">): Promise<Tarefa> {
  const row: Tarefa = { ...input, id: newId(), criado_em: new Date().toISOString() };
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.tarefas.push(row);
    await saveDataAsync(data, tenantId);
    return row;
  }
  const sql = getSql()!;
  await sql`
    INSERT INTO tarefas (tenant_id, id, titulo, descricao, status, responsavel, prazo, processo_id, processo_titulo, criado_em)
    VALUES (${tenantId}, ${row.id}, ${row.titulo}, ${row.descricao}, ${row.status}, ${row.responsavel},
            ${row.prazo ?? null}, ${row.processo_id ?? null}, ${row.processo_titulo ?? null}, ${row.criado_em})
  `;
  return row;
}

export async function update(tenantId: string, id: string, patch: Partial<Tarefa>): Promise<Tarefa | null> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const idx = data.tarefas.findIndex(t => t.id === id);
    if (idx === -1) return null;
    data.tarefas[idx] = { ...data.tarefas[idx], ...patch };
    await saveDataAsync(data, tenantId);
    return data.tarefas[idx];
  }
  const current = await get(tenantId, id);
  if (!current) return null;
  const merged = { ...current, ...patch };
  const sql = getSql()!;
  await sql`
    UPDATE tarefas SET titulo = ${merged.titulo}, descricao = ${merged.descricao}, status = ${merged.status},
      responsavel = ${merged.responsavel}, prazo = ${merged.prazo ?? null},
      processo_id = ${merged.processo_id ?? null}, processo_titulo = ${merged.processo_titulo ?? null}
    WHERE tenant_id = ${tenantId} AND id = ${id}
  `;
  return merged;
}

export async function remove(tenantId: string, id: string): Promise<boolean> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const before = data.tarefas.length;
    data.tarefas = data.tarefas.filter(t => t.id !== id);
    await saveDataAsync(data, tenantId);
    return data.tarefas.length < before;
  }
  const sql = getSql()!;
  const rows = await sql`DELETE FROM tarefas WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING id` as unknown[];
  return rows.length > 0;
}
