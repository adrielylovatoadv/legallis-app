import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, newId, type FeriadoMunicipal } from "@/lib/controle-data";

function rowToFeriado(r: Record<string, unknown>): FeriadoMunicipal {
  return {
    id: r.id as string,
    municipio: r.municipio as string,
    uf: r.uf as string,
    mes: Number(r.mes),
    dia: Number(r.dia),
    nome: r.nome as string,
    criado_em: r.criado_em instanceof Date ? r.criado_em.toISOString() : (r.criado_em as string),
  };
}

export async function list(tenantId: string): Promise<FeriadoMunicipal[]> {
  if (!hasDb()) return (await getDataAsync(tenantId)).feriados_municipais;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM feriados_municipais WHERE tenant_id = ${tenantId} ORDER BY uf, municipio, mes, dia` as Record<string, unknown>[];
  return rows.map(rowToFeriado);
}

export async function create(tenantId: string, input: Omit<FeriadoMunicipal, "id" | "criado_em">): Promise<FeriadoMunicipal> {
  const row: FeriadoMunicipal = { ...input, id: newId(), criado_em: new Date().toISOString() };
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.feriados_municipais.push(row);
    await saveDataAsync(data, tenantId);
    return row;
  }
  const sql = getSql()!;
  await sql`
    INSERT INTO feriados_municipais (tenant_id, id, municipio, uf, mes, dia, nome, criado_em)
    VALUES (${tenantId}, ${row.id}, ${row.municipio}, ${row.uf}, ${row.mes}, ${row.dia}, ${row.nome}, ${row.criado_em})
  `;
  return row;
}

export async function remove(tenantId: string, id: string): Promise<boolean> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const before = data.feriados_municipais.length;
    data.feriados_municipais = data.feriados_municipais.filter(f => f.id !== id);
    await saveDataAsync(data, tenantId);
    return data.feriados_municipais.length < before;
  }
  const sql = getSql()!;
  const rows = await sql`DELETE FROM feriados_municipais WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING id` as unknown[];
  return rows.length > 0;
}
