import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, newId, type Publicacao } from "@/lib/controle-data";

function rowToPublicacao(r: Record<string, unknown>): Publicacao {
  return {
    id: r.id as string,
    oabNumero: r.oab_numero as string,
    oabUf: r.oab_uf as string,
    numeroProcesso: (r.numero_processo as string) ?? undefined,
    orgao: (r.orgao as string) ?? undefined,
    tipoComunicacao: (r.tipo_comunicacao as string) ?? undefined,
    dataDisponibilizacao: (r.data_disponibilizacao as string) ?? undefined,
    texto: (r.texto as string) ?? undefined,
    fonte: r.fonte as Publicacao["fonte"],
    fonteId: (r.fonte_id as string) ?? undefined,
    tratada: !!r.tratada,
    processoId: (r.processo_id as string) ?? undefined,
    criado_em: r.criado_em instanceof Date ? r.criado_em.toISOString() : (r.criado_em as string),
    raw: r.raw ?? undefined,
  };
}

export async function list(tenantId: string, filtro?: { tratada?: boolean }): Promise<Publicacao[]> {
  if (!hasDb()) {
    const all = (await getDataAsync(tenantId)).publicacoes;
    return filtro?.tratada === undefined ? all : all.filter(p => p.tratada === filtro.tratada);
  }
  const sql = getSql()!;
  const rows = filtro?.tratada === undefined
    ? await sql`SELECT * FROM publicacoes WHERE tenant_id = ${tenantId} ORDER BY data_disponibilizacao DESC NULLS LAST` as Record<string, unknown>[]
    : await sql`SELECT * FROM publicacoes WHERE tenant_id = ${tenantId} AND tratada = ${filtro.tratada} ORDER BY data_disponibilizacao DESC NULLS LAST` as Record<string, unknown>[];
  return rows.map(rowToPublicacao);
}

// Insere só as publicações ainda não vistas (dedupe por fonte+fonteId quando a fonte informa
// um id externo estável; sem fonteId, dedupe por fonte+numeroProcesso+dataDisponibilizacao).
// Retorna apenas as que foram efetivamente inseridas (novas).
export async function upsertNovas(tenantId: string, itens: Omit<Publicacao, "id" | "criado_em" | "tratada">[]): Promise<Publicacao[]> {
  if (itens.length === 0) return [];
  const existentes = await list(tenantId);
  const chave = (p: { fonte: string; fonteId?: string; numeroProcesso?: string; dataDisponibilizacao?: string }) =>
    p.fonteId ? `${p.fonte}:${p.fonteId}` : `${p.fonte}:${p.numeroProcesso ?? ""}:${p.dataDisponibilizacao ?? ""}`;
  const vistos = new Set(existentes.map(chave));
  const novas = itens.filter(i => !vistos.has(chave(i)));
  if (novas.length === 0) return [];

  const rows: Publicacao[] = novas.map(i => ({ ...i, id: newId(), criado_em: new Date().toISOString(), tratada: false }));
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.publicacoes.push(...rows);
    await saveDataAsync(data, tenantId);
    return rows;
  }
  const sql = getSql()!;
  for (const row of rows) {
    await sql`
      INSERT INTO publicacoes (tenant_id, id, oab_numero, oab_uf, numero_processo, orgao, tipo_comunicacao,
                                data_disponibilizacao, texto, fonte, fonte_id, tratada, processo_id, criado_em, raw)
      VALUES (${tenantId}, ${row.id}, ${row.oabNumero}, ${row.oabUf}, ${row.numeroProcesso ?? null}, ${row.orgao ?? null},
              ${row.tipoComunicacao ?? null}, ${row.dataDisponibilizacao ?? null}, ${row.texto ?? null}, ${row.fonte},
              ${row.fonteId ?? null}, ${row.tratada}, ${row.processoId ?? null}, ${row.criado_em}, ${JSON.stringify(row.raw ?? {}) as unknown as object})
    `;
  }
  return rows;
}

export async function update(tenantId: string, id: string, patch: Partial<Pick<Publicacao, "tratada" | "processoId">>): Promise<Publicacao | null> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const idx = data.publicacoes.findIndex(p => p.id === id);
    if (idx === -1) return null;
    data.publicacoes[idx] = { ...data.publicacoes[idx], ...patch };
    await saveDataAsync(data, tenantId);
    return data.publicacoes[idx];
  }
  const sql = getSql()!;
  const current = (await sql`SELECT * FROM publicacoes WHERE tenant_id = ${tenantId} AND id = ${id}` as Record<string, unknown>[])[0];
  if (!current) return null;
  const merged = { ...rowToPublicacao(current), ...patch };
  await sql`
    UPDATE publicacoes SET tratada = ${merged.tratada}, processo_id = ${merged.processoId ?? null}
    WHERE tenant_id = ${tenantId} AND id = ${id}
  `;
  return merged;
}
