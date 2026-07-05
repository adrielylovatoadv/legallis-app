import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, newId, type Redesignacao } from "@/lib/controle-data";

// Repositório para Redesignacao. Ramifica em hasDb(): tabela relacional em produção
// (Neon), blob JSON local em dev — ver /Users/adrielylovato/.claude/plans/parallel-strolling-sundae.md.
// Esta é a entidade "molde": as demais em lib/repo/* seguem a mesma forma (list/get/create/update/remove).

function toIso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function rowToRedesignacao(r: Record<string, unknown>): Redesignacao {
  return {
    id: r.id as string,
    tipo: r.tipo as Redesignacao["tipo"],
    itemId: r.item_id as string,
    label: r.label as string,
    deUserId: r.de_user_id as string,
    deUserName: r.de_user_name as string,
    paraUserId: r.para_user_id as string,
    paraUserName: r.para_user_name as string,
    motivo: r.motivo as string,
    status: r.status as Redesignacao["status"],
    criado_em: toIso(r.criado_em),
    respondido_em: r.respondido_em ? toIso(r.respondido_em) : undefined,
  };
}

export async function list(tenantId: string): Promise<Redesignacao[]> {
  if (!hasDb()) return (await getDataAsync(tenantId)).redesignacoes;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM redesignacoes WHERE tenant_id = ${tenantId} ORDER BY criado_em DESC` as Record<string, unknown>[];
  return rows.map(rowToRedesignacao);
}

export async function get(tenantId: string, id: string): Promise<Redesignacao | null> {
  if (!hasDb()) return (await getDataAsync(tenantId)).redesignacoes.find(r => r.id === id) ?? null;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM redesignacoes WHERE tenant_id = ${tenantId} AND id = ${id}` as Record<string, unknown>[];
  return rows[0] ? rowToRedesignacao(rows[0]) : null;
}

export async function create(tenantId: string, input: Omit<Redesignacao, "id" | "criado_em">): Promise<Redesignacao> {
  const row: Redesignacao = { ...input, id: newId(), criado_em: new Date().toISOString() };
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.redesignacoes.push(row);
    await saveDataAsync(data, tenantId);
    return row;
  }
  const sql = getSql()!;
  await sql`
    INSERT INTO redesignacoes (tenant_id, id, tipo, item_id, label, de_user_id, de_user_name,
                                para_user_id, para_user_name, motivo, status, criado_em)
    VALUES (${tenantId}, ${row.id}, ${row.tipo}, ${row.itemId}, ${row.label}, ${row.deUserId}, ${row.deUserName},
            ${row.paraUserId}, ${row.paraUserName}, ${row.motivo}, ${row.status}, ${row.criado_em})
  `;
  return row;
}

// Constrói (sem executar) o UPDATE — usado por update() e por designacoes/route.ts POST
// (responder_redesignacao), que grava a resposta e atualiza o responsável do processo/inicial
// correspondente numa única transação.
export function buildUpdateStatement(tenantId: string, merged: Redesignacao) {
  const sql = getSql()!;
  return sql`
    UPDATE redesignacoes SET tipo = ${merged.tipo}, item_id = ${merged.itemId}, label = ${merged.label},
      de_user_id = ${merged.deUserId}, de_user_name = ${merged.deUserName},
      para_user_id = ${merged.paraUserId}, para_user_name = ${merged.paraUserName},
      motivo = ${merged.motivo}, status = ${merged.status}, respondido_em = ${merged.respondido_em ?? null}
    WHERE tenant_id = ${tenantId} AND id = ${merged.id}
  `;
}

export async function update(tenantId: string, id: string, patch: Partial<Redesignacao>): Promise<Redesignacao | null> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const idx = data.redesignacoes.findIndex(r => r.id === id);
    if (idx === -1) return null;
    data.redesignacoes[idx] = { ...data.redesignacoes[idx], ...patch };
    await saveDataAsync(data, tenantId);
    return data.redesignacoes[idx];
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
    const before = data.redesignacoes.length;
    data.redesignacoes = data.redesignacoes.filter(r => r.id !== id);
    await saveDataAsync(data, tenantId);
    return data.redesignacoes.length < before;
  }
  const sql = getSql()!;
  const rows = await sql`DELETE FROM redesignacoes WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING id` as unknown[];
  return rows.length > 0;
}
