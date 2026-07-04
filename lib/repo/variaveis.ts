import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, newId, type Variavel } from "@/lib/financeiro-data";

function rowToVariavel(r: Record<string, unknown>): Variavel {
  return {
    id: r.id as string,
    descricao: r.descricao as string,
    valor: Number(r.valor),
    parcelas: r.parcelas as string,
    quem: r.quem as string,
    onde: r.onde as string,
    status: r.status as Variavel["status"],
    data_compra: r.data_compra as string,
    meses: (r.meses as Record<string, number>) || {},
  };
}

export async function list(tenantId: string): Promise<Variavel[]> {
  if (!hasDb()) return (await getDataAsync(tenantId)).variaveis;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM variaveis WHERE tenant_id = ${tenantId} ORDER BY data_compra DESC` as Record<string, unknown>[];
  return rows.map(rowToVariavel);
}

export async function get(tenantId: string, id: string): Promise<Variavel | null> {
  if (!hasDb()) return (await getDataAsync(tenantId)).variaveis.find(v => v.id === id) ?? null;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM variaveis WHERE tenant_id = ${tenantId} AND id = ${id}` as Record<string, unknown>[];
  return rows[0] ? rowToVariavel(rows[0]) : null;
}

export async function create(tenantId: string, input: Omit<Variavel, "id">): Promise<Variavel> {
  const row: Variavel = { ...input, id: newId() };
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.variaveis.push(row);
    await saveDataAsync(data, tenantId);
    return row;
  }
  const sql = getSql()!;
  await sql`
    INSERT INTO variaveis (tenant_id, id, descricao, valor, parcelas, quem, onde, status, data_compra, meses)
    VALUES (${tenantId}, ${row.id}, ${row.descricao}, ${row.valor}, ${row.parcelas}, ${row.quem}, ${row.onde},
            ${row.status}, ${row.data_compra}, ${JSON.stringify(row.meses || {})})
  `;
  return row;
}

export async function update(tenantId: string, id: string, patch: Partial<Variavel>): Promise<Variavel | null> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const idx = data.variaveis.findIndex(v => v.id === id);
    if (idx === -1) return null;
    data.variaveis[idx] = { ...data.variaveis[idx], ...patch };
    await saveDataAsync(data, tenantId);
    return data.variaveis[idx];
  }
  const current = await get(tenantId, id);
  if (!current) return null;
  const merged = { ...current, ...patch };
  const sql = getSql()!;
  await sql`
    UPDATE variaveis SET descricao = ${merged.descricao}, valor = ${merged.valor}, parcelas = ${merged.parcelas},
      quem = ${merged.quem}, onde = ${merged.onde}, status = ${merged.status}, data_compra = ${merged.data_compra},
      meses = ${JSON.stringify(merged.meses || {})}
    WHERE tenant_id = ${tenantId} AND id = ${id}
  `;
  return merged;
}

export async function remove(tenantId: string, id: string): Promise<boolean> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const before = data.variaveis.length;
    data.variaveis = data.variaveis.filter(v => v.id !== id);
    await saveDataAsync(data, tenantId);
    return data.variaveis.length < before;
  }
  const sql = getSql()!;
  const rows = await sql`DELETE FROM variaveis WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING id` as unknown[];
  return rows.length > 0;
}
