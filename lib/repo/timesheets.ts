import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, newId, type Timesheet } from "@/lib/financeiro-data";

function rowToTimesheet(r: Record<string, unknown>): Timesheet {
  return {
    id: r.id as string,
    processoId: (r.processo_id as string) ?? undefined,
    processo: (r.processo as string) ?? undefined,
    cliente: (r.cliente as string) ?? undefined,
    data: r.data as string,
    minutos: Number(r.minutos),
    descricao: r.descricao as string,
    responsavel: r.responsavel as string,
    faturavel: !!r.faturavel,
    valor_hora: r.valor_hora != null ? Number(r.valor_hora) : undefined,
    status: r.status as Timesheet["status"],
  };
}

export async function list(tenantId: string): Promise<Timesheet[]> {
  if (!hasDb()) return (await getDataAsync(tenantId)).timesheets;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM timesheets WHERE tenant_id = ${tenantId} ORDER BY data DESC` as Record<string, unknown>[];
  return rows.map(rowToTimesheet);
}

export async function get(tenantId: string, id: string): Promise<Timesheet | null> {
  if (!hasDb()) return (await getDataAsync(tenantId)).timesheets.find(t => t.id === id) ?? null;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM timesheets WHERE tenant_id = ${tenantId} AND id = ${id}` as Record<string, unknown>[];
  return rows[0] ? rowToTimesheet(rows[0]) : null;
}

export async function create(tenantId: string, input: Omit<Timesheet, "id">): Promise<Timesheet> {
  const row: Timesheet = { ...input, id: newId() };
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.timesheets.push(row);
    await saveDataAsync(data, tenantId);
    return row;
  }
  const sql = getSql()!;
  await sql`
    INSERT INTO timesheets (tenant_id, id, processo_id, processo, cliente, data, minutos, descricao,
                             responsavel, faturavel, valor_hora, status)
    VALUES (${tenantId}, ${row.id}, ${row.processoId ?? null}, ${row.processo ?? null}, ${row.cliente ?? null},
            ${row.data}, ${row.minutos}, ${row.descricao}, ${row.responsavel}, ${row.faturavel},
            ${row.valor_hora ?? null}, ${row.status})
  `;
  return row;
}

export async function update(tenantId: string, id: string, patch: Partial<Timesheet>): Promise<Timesheet | null> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const idx = data.timesheets.findIndex(t => t.id === id);
    if (idx === -1) return null;
    data.timesheets[idx] = { ...data.timesheets[idx], ...patch };
    await saveDataAsync(data, tenantId);
    return data.timesheets[idx];
  }
  const current = await get(tenantId, id);
  if (!current) return null;
  const merged = { ...current, ...patch };
  const sql = getSql()!;
  await sql`
    UPDATE timesheets SET processo_id = ${merged.processoId ?? null}, processo = ${merged.processo ?? null},
      cliente = ${merged.cliente ?? null}, data = ${merged.data}, minutos = ${merged.minutos},
      descricao = ${merged.descricao}, responsavel = ${merged.responsavel}, faturavel = ${merged.faturavel},
      valor_hora = ${merged.valor_hora ?? null}, status = ${merged.status}
    WHERE tenant_id = ${tenantId} AND id = ${id}
  `;
  return merged;
}

export async function remove(tenantId: string, id: string): Promise<boolean> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const before = data.timesheets.length;
    data.timesheets = data.timesheets.filter(t => t.id !== id);
    await saveDataAsync(data, tenantId);
    return data.timesheets.length < before;
  }
  const sql = getSql()!;
  const rows = await sql`DELETE FROM timesheets WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING id` as unknown[];
  return rows.length > 0;
}
