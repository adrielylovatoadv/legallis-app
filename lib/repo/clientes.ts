import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, newId, type Cliente } from "@/lib/controle-data";
import { encryptField, decryptField } from "@/lib/crypto";

function rowToCliente(r: Record<string, unknown>): Cliente {
  return {
    id: r.id as string,
    nome: r.nome as string,
    telefone: r.telefone as string,
    cpf: r.cpf as string,
    email: r.email as string,
    endereco: r.endereco as string,
    tipo_aposentadoria: r.tipo_aposentadoria as string,
    informacoes: r.informacoes as string,
    senha_gov: decryptField((r.senha_gov as string) || ""),
    senha_serasa: decryptField((r.senha_serasa as string) || ""),
    criado_em: r.criado_em instanceof Date ? r.criado_em.toISOString() : (r.criado_em as string),
    tipo_pessoa: (r.tipo_pessoa as Cliente["tipo_pessoa"]) ?? undefined,
    cnpj: (r.cnpj as string) ?? undefined,
    tratamento: (r.tratamento as string) ?? undefined,
    etiquetas: (r.etiquetas as string[]) ?? undefined,
    telefones_adicionais: (r.telefones_adicionais as string[]) ?? undefined,
    emails_adicionais: (r.emails_adicionais as string[]) ?? undefined,
    rg: (r.rg as string) ?? undefined,
    profissao: (r.profissao as string) ?? undefined,
    estado_civil: (r.estado_civil as string) ?? undefined,
    nacionalidade: (r.nacionalidade as string) ?? undefined,
    banco: (r.banco as string) ?? undefined,
    agencia: (r.agencia as string) ?? undefined,
    conta: r.conta ? decryptField(r.conta as string) : undefined,
    tipo_conta: (r.tipo_conta as Cliente["tipo_conta"]) ?? undefined,
    chave_pix: r.chave_pix ? decryptField(r.chave_pix as string) : undefined,
  };
}

export async function list(tenantId: string): Promise<Cliente[]> {
  if (!hasDb()) return (await getDataAsync(tenantId)).clientes;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM clientes WHERE tenant_id = ${tenantId} ORDER BY nome` as Record<string, unknown>[];
  return rows.map(rowToCliente);
}

export async function get(tenantId: string, id: string): Promise<Cliente | null> {
  if (!hasDb()) return (await getDataAsync(tenantId)).clientes.find(c => c.id === id) ?? null;
  const sql = getSql()!;
  const rows = await sql`SELECT * FROM clientes WHERE tenant_id = ${tenantId} AND id = ${id}` as Record<string, unknown>[];
  return rows[0] ? rowToCliente(rows[0]) : null;
}

// Constrói (sem executar) o INSERT de um cliente — usado por create() e por rotas que
// precisam agrupar essa escrita com a de outra entidade numa única transação (ex.:
// atendimentos/concluir, que cadastra o cliente e vincula o atendimento ao mesmo tempo).
export function buildCreateStatement(tenantId: string, row: Cliente) {
  const sql = getSql()!;
  return sql`
    INSERT INTO clientes (tenant_id, id, nome, telefone, cpf, email, endereco, tipo_aposentadoria, informacoes,
                           senha_gov, senha_serasa, tipo_pessoa, cnpj, tratamento, etiquetas, telefones_adicionais,
                           emails_adicionais, rg, profissao, estado_civil, nacionalidade,
                           banco, agencia, conta, tipo_conta, chave_pix, criado_em)
    VALUES (${tenantId}, ${row.id}, ${row.nome}, ${row.telefone}, ${row.cpf}, ${row.email}, ${row.endereco},
            ${row.tipo_aposentadoria}, ${row.informacoes}, ${encryptField(row.senha_gov || "")},
            ${encryptField(row.senha_serasa || "")}, ${row.tipo_pessoa ?? "fisica"}, ${row.cnpj ?? null},
            ${row.tratamento ?? null}, ${JSON.stringify(row.etiquetas || [])},
            ${JSON.stringify(row.telefones_adicionais || [])}, ${JSON.stringify(row.emails_adicionais || [])},
            ${row.rg ?? null}, ${row.profissao ?? null}, ${row.estado_civil ?? null},
            ${row.nacionalidade ?? "brasileiro(a)"}, ${row.banco ?? null}, ${row.agencia ?? null},
            ${encryptField(row.conta || "") || null}, ${row.tipo_conta ?? "corrente"},
            ${encryptField(row.chave_pix || "") || null}, ${row.criado_em})
  `;
}

export async function create(tenantId: string, input: Omit<Cliente, "id" | "criado_em">): Promise<Cliente> {
  const row: Cliente = { ...input, id: newId(), criado_em: new Date().toISOString() };
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    data.clientes.push(row);
    await saveDataAsync(data, tenantId);
    return row;
  }
  await buildCreateStatement(tenantId, row);
  return row;
}

export async function update(tenantId: string, id: string, patch: Partial<Cliente>): Promise<Cliente | null> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const idx = data.clientes.findIndex(c => c.id === id);
    if (idx === -1) return null;
    data.clientes[idx] = { ...data.clientes[idx], ...patch };
    await saveDataAsync(data, tenantId);
    return data.clientes[idx];
  }
  const current = await get(tenantId, id);
  if (!current) return null;
  const merged = { ...current, ...patch };
  const sql = getSql()!;
  await sql`
    UPDATE clientes SET nome = ${merged.nome}, telefone = ${merged.telefone}, cpf = ${merged.cpf},
      email = ${merged.email}, endereco = ${merged.endereco}, tipo_aposentadoria = ${merged.tipo_aposentadoria},
      informacoes = ${merged.informacoes}, senha_gov = ${encryptField(merged.senha_gov || "")},
      senha_serasa = ${encryptField(merged.senha_serasa || "")}, tipo_pessoa = ${merged.tipo_pessoa ?? "fisica"},
      cnpj = ${merged.cnpj ?? null}, tratamento = ${merged.tratamento ?? null},
      etiquetas = ${JSON.stringify(merged.etiquetas || [])},
      telefones_adicionais = ${JSON.stringify(merged.telefones_adicionais || [])},
      emails_adicionais = ${JSON.stringify(merged.emails_adicionais || [])},
      rg = ${merged.rg ?? null}, profissao = ${merged.profissao ?? null}, estado_civil = ${merged.estado_civil ?? null},
      nacionalidade = ${merged.nacionalidade ?? "brasileiro(a)"},
      banco = ${merged.banco ?? null}, agencia = ${merged.agencia ?? null},
      conta = ${encryptField(merged.conta || "") || null}, tipo_conta = ${merged.tipo_conta ?? "corrente"},
      chave_pix = ${encryptField(merged.chave_pix || "") || null}
    WHERE tenant_id = ${tenantId} AND id = ${id}
  `;
  return merged;
}

export async function remove(tenantId: string, id: string): Promise<boolean> {
  if (!hasDb()) {
    const data = await getDataAsync(tenantId);
    const before = data.clientes.length;
    data.clientes = data.clientes.filter(c => c.id !== id);
    await saveDataAsync(data, tenantId);
    return data.clientes.length < before;
  }
  const sql = getSql()!;
  const rows = await sql`DELETE FROM clientes WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING id` as unknown[];
  return rows.length > 0;
}

// Constrói (sem executar) os upserts em lote — usado por upsertMany() e por
// controle/importar/route.ts, que agrupa os statements de todas as entidades importadas
// numa única transação (Fase 6 da migração). Recebe senha_gov/senha_serasa em texto puro
// (igual ao que getDataAsync já descriptografa para uso em memória) — encryptField() cuida
// de criptografar antes de gravar.
export function buildUpsertManyStatements(tenantId: string, rows: Cliente[]) {
  const sql = getSql()!;
  return rows.map(row => sql`
    INSERT INTO clientes (tenant_id, id, nome, telefone, cpf, email, endereco, tipo_aposentadoria, informacoes,
                           senha_gov, senha_serasa, tipo_pessoa, cnpj, tratamento, etiquetas, telefones_adicionais,
                           emails_adicionais, rg, profissao, estado_civil, nacionalidade,
                           banco, agencia, conta, tipo_conta, chave_pix, criado_em)
    VALUES (${tenantId}, ${row.id}, ${row.nome}, ${row.telefone}, ${row.cpf}, ${row.email}, ${row.endereco},
            ${row.tipo_aposentadoria}, ${row.informacoes}, ${encryptField(row.senha_gov || "")},
            ${encryptField(row.senha_serasa || "")}, ${row.tipo_pessoa ?? "fisica"}, ${row.cnpj ?? null},
            ${row.tratamento ?? null}, ${JSON.stringify(row.etiquetas || [])},
            ${JSON.stringify(row.telefones_adicionais || [])}, ${JSON.stringify(row.emails_adicionais || [])},
            ${row.rg ?? null}, ${row.profissao ?? null}, ${row.estado_civil ?? null},
            ${row.nacionalidade ?? "brasileiro(a)"}, ${row.banco ?? null}, ${row.agencia ?? null},
            ${encryptField(row.conta || "") || null}, ${row.tipo_conta ?? "corrente"},
            ${encryptField(row.chave_pix || "") || null}, ${row.criado_em})
    ON CONFLICT (tenant_id, id) DO UPDATE SET nome = EXCLUDED.nome, telefone = EXCLUDED.telefone, cpf = EXCLUDED.cpf,
      email = EXCLUDED.email, endereco = EXCLUDED.endereco, tipo_aposentadoria = EXCLUDED.tipo_aposentadoria,
      informacoes = EXCLUDED.informacoes, senha_gov = EXCLUDED.senha_gov, senha_serasa = EXCLUDED.senha_serasa,
      tipo_pessoa = EXCLUDED.tipo_pessoa, cnpj = EXCLUDED.cnpj, tratamento = EXCLUDED.tratamento,
      etiquetas = EXCLUDED.etiquetas, telefones_adicionais = EXCLUDED.telefones_adicionais,
      emails_adicionais = EXCLUDED.emails_adicionais, rg = EXCLUDED.rg, profissao = EXCLUDED.profissao,
      estado_civil = EXCLUDED.estado_civil, nacionalidade = EXCLUDED.nacionalidade,
      banco = EXCLUDED.banco, agencia = EXCLUDED.agencia, conta = EXCLUDED.conta,
      tipo_conta = EXCLUDED.tipo_conta, chave_pix = EXCLUDED.chave_pix
  `);
}

// Upsert em lote preservando ids existentes — usado por controle/seed/route.ts.
export async function upsertMany(tenantId: string, rows: Cliente[]): Promise<void> {
  if (!hasDb() || rows.length === 0) return;
  const sql = getSql()!;
  const statements = buildUpsertManyStatements(tenantId, rows);
  for (let i = 0; i < statements.length; i += 200) {
    await sql.transaction(statements.slice(i, i + 200));
  }
}
