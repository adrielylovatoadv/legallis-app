import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, COLS } from "@/lib/financeiro-data";

export interface Fixa {
  categoria: string; quem: string;
  valores: Record<string, number>; status: Record<string, string>;
  valor_fixo: number; total: number;
}

function buildTotal(valores: Record<string, number>, valorFixo: number): number {
  return valorFixo > 0 ? COLS.length * valorFixo : COLS.reduce((s, c) => s + (valores[c] || 0), 0);
}

export async function list(tenantId: string): Promise<Fixa[]> {
  if (!hasDb()) {
    const d = await getDataAsync(tenantId);
    return Object.entries(d.fixas).map(([categoria, valores]) => {
      const valor_fixo = d.fixas_valor_fixo?.[categoria] || 0;
      return {
        categoria, quem: d.fixas_quem?.[categoria] || "dividido", valores,
        status: d.fixas_status?.[categoria] || {}, valor_fixo,
        total: buildTotal(valores, valor_fixo),
      };
    });
  }
  const sql = getSql()!;
  const [cats, vals] = await Promise.all([
    sql`SELECT * FROM fixas_categorias WHERE tenant_id = ${tenantId}` as Promise<Record<string, unknown>[]>,
    sql`SELECT * FROM fixas_valores WHERE tenant_id = ${tenantId}` as Promise<Record<string, unknown>[]>,
  ]);
  return cats.map(c => {
    const categoria = c.categoria as string;
    const valores: Record<string, number> = {};
    const status: Record<string, string> = {};
    for (const v of vals) {
      if (v.categoria !== categoria) continue;
      valores[v.col as string] = Number(v.valor);
      if (v.status) status[v.col as string] = v.status as string;
    }
    const valor_fixo = Number(c.valor_fixo) || 0;
    return { categoria, quem: c.quem as string, valores, status, valor_fixo, total: buildTotal(valores, valor_fixo) };
  });
}

export async function get(tenantId: string, categoria: string): Promise<Fixa | null> {
  const all = await list(tenantId);
  return all.find(f => f.categoria === categoria) ?? null;
}

// Grava categoria + valores lançados. Sempre recebe os valores finais já resolvidos
// pela rota (merge com o estado atual feito antes de chamar) — nunca faz merge parcial aqui.
export async function upsert(tenantId: string, categoria: string, input: {
  quem: string; valores: Record<string, number>; valor_fixo?: number;
}): Promise<void> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.fixas_quem[categoria] = input.quem;
    data.fixas[categoria] = input.valores;
    if (!data.fixas_status[categoria]) data.fixas_status[categoria] = {};
    const vf = input.valor_fixo || 0;
    if (vf > 0) data.fixas_valor_fixo[categoria] = vf;
    else delete data.fixas_valor_fixo[categoria];
    await saveDataAsync(data, tenantId);
    return;
  }
  const sql = getSql()!;
  const statements = [
    sql`INSERT INTO fixas_categorias (tenant_id, categoria, quem, valor_fixo)
        VALUES (${tenantId}, ${categoria}, ${input.quem}, ${input.valor_fixo || 0})
        ON CONFLICT (tenant_id, categoria) DO UPDATE SET quem = EXCLUDED.quem, valor_fixo = EXCLUDED.valor_fixo`,
    // status nunca é tocado aqui de propósito — é gravado só por setStatus(), coluna separada na mesma linha.
    ...Object.entries(input.valores).map(([col, valor]) => sql`
      INSERT INTO fixas_valores (tenant_id, categoria, col, valor)
      VALUES (${tenantId}, ${categoria}, ${col}, ${valor})
      ON CONFLICT (tenant_id, categoria, col) DO UPDATE SET valor = EXCLUDED.valor`),
  ];
  await sql.transaction(statements);
}

export async function create(tenantId: string, input: {
  categoria: string; quem: string; valores: Record<string, number>; valor_fixo?: number;
}): Promise<void> {
  await upsert(tenantId, input.categoria, input);
}

// Renomeia a categoria preservando valores e status (linha inteira de fixas_valores é movida,
// então status não precisa ser carregado à parte). No modo banco: insere o novo pai, religa os
// filhos e só então apaga o pai antigo — nessa ordem, para nunca violar a FK.
export async function rename(tenantId: string, categoria: string, novaCategoria: string): Promise<void> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.fixas[novaCategoria] = data.fixas[categoria];
    data.fixas_quem[novaCategoria] = data.fixas_quem[categoria];
    data.fixas_status[novaCategoria] = data.fixas_status[categoria] || {};
    data.fixas_valor_fixo[novaCategoria] = data.fixas_valor_fixo[categoria] || 0;
    delete data.fixas[categoria];
    delete data.fixas_quem[categoria];
    delete data.fixas_status[categoria];
    delete data.fixas_valor_fixo[categoria];
    await saveDataAsync(data, tenantId);
    return;
  }
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM fixas_categorias WHERE tenant_id = ${tenantId} AND categoria = ${categoria}` as Record<string, unknown>[];
  if (rows.length === 0) return;
  const atual = rows[0];
  await sql.transaction([
    sql`INSERT INTO fixas_categorias (tenant_id, categoria, quem, valor_fixo)
        VALUES (${tenantId}, ${novaCategoria}, ${atual.quem as string}, ${Number(atual.valor_fixo) || 0})
        ON CONFLICT (tenant_id, categoria) DO UPDATE SET quem = EXCLUDED.quem, valor_fixo = EXCLUDED.valor_fixo`,
    sql`UPDATE fixas_valores SET categoria = ${novaCategoria} WHERE tenant_id = ${tenantId} AND categoria = ${categoria}`,
    sql`DELETE FROM fixas_categorias WHERE tenant_id = ${tenantId} AND categoria = ${categoria}`,
  ]);
}

export async function remove(tenantId: string, categoria: string): Promise<void> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    delete data.fixas[categoria];
    delete data.fixas_quem[categoria];
    delete data.fixas_status[categoria];
    delete data.fixas_valor_fixo[categoria];
    await saveDataAsync(data, tenantId);
    return;
  }
  const sql = getSql()!;
  await sql`DELETE FROM fixas_categorias WHERE tenant_id = ${tenantId} AND categoria = ${categoria}`;
  // fixas_valores é filho com ON DELETE CASCADE — não precisa de DELETE separado.
}

export async function setStatus(tenantId: string, categoria: string, col: string, status: string): Promise<void> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    if (!data.fixas_status[categoria]) data.fixas_status[categoria] = {};
    data.fixas_status[categoria][col] = status;
    await saveDataAsync(data, tenantId);
    return;
  }
  const sql = getSql()!;
  await sql`
    INSERT INTO fixas_valores (tenant_id, categoria, col, valor, status)
    VALUES (${tenantId}, ${categoria}, ${col}, 0, ${status})
    ON CONFLICT (tenant_id, categoria, col) DO UPDATE SET status = EXCLUDED.status
  `;
}
