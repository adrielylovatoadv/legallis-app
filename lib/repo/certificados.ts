import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, newId, type Certificado } from "@/lib/controle-data";
import { decryptField } from "@/lib/crypto";

function rowToCertificado(r: Record<string, unknown>): Certificado {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    tipo: r.tipo as Certificado["tipo"],
    apelido: r.apelido as string,
    nomeArquivo: (r.nome_arquivo as string) ?? undefined,
    blobPath: (r.blob_path as string) ?? undefined,
    senha: r.senha ? decryptField(r.senha as string) : undefined,
    titular: (r.titular as string) ?? undefined,
    validade: (r.validade as string) ?? undefined,
    criado_em: r.criado_em instanceof Date ? r.criado_em.toISOString() : (r.criado_em as string),
  };
}

export async function list(tenantId: string): Promise<Certificado[]> {
  if (!hasDb()) return (await getDataAsync(tenantId)).certificados;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM certificados WHERE tenant_id = ${tenantId} ORDER BY criado_em DESC` as Record<string, unknown>[];
  return rows.map(rowToCertificado);
}

export async function create(tenantId: string, input: Omit<Certificado, "id" | "criado_em">): Promise<Certificado> {
  const row: Certificado = { ...input, id: newId(), criado_em: new Date().toISOString() };
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.certificados.push(row);
    await saveDataAsync(data, tenantId);
    return row;
  }
  const { encryptField } = await import("@/lib/crypto");
  const sql = getSql()!;
  await sql`
    INSERT INTO certificados (tenant_id, id, user_id, tipo, apelido, nome_arquivo, blob_path, senha, titular, validade, criado_em)
    VALUES (${tenantId}, ${row.id}, ${row.userId}, ${row.tipo}, ${row.apelido}, ${row.nomeArquivo ?? null},
            ${row.blobPath ?? null}, ${row.senha ? encryptField(row.senha) : null}, ${row.titular ?? null},
            ${row.validade ?? null}, ${row.criado_em})
  `;
  return row;
}

export async function remove(tenantId: string, id: string): Promise<Certificado | null> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const found = data.certificados.find(c => c.id === id) ?? null;
    data.certificados = data.certificados.filter(c => c.id !== id);
    await saveDataAsync(data, tenantId);
    return found;
  }
  const sql = getSql()!;
  const rows = await sql`DELETE FROM certificados WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING *` as Record<string, unknown>[];
  return rows[0] ? rowToCertificado(rows[0]) : null;
}
