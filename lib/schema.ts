import type { neon } from "@neondatabase/serverless";

type Sql = ReturnType<typeof neon>;

// Tabelas relacionais por entidade (Neon), tenant-scoped via (tenant_id, id).
// Substituem, entidade por entidade, o blob JSON único por tenant guardado em kv_store.
// Ver /Users/adrielylovato/.claude/plans/parallel-strolling-sundae.md para o plano completo.
//
// IMPORTANTE: enquanto nenhuma rota estiver religada para lib/repo/*, criar estas tabelas
// não muda nenhum comportamento — elas ficam vazias, sem leitura/escrita, ao lado do kv_store
// que continua sendo a única fonte de dados até cada fase religar suas rotas.
//
// Toda tabela tem uma coluna `raw JSONB` guardando o item original inteiro (antes de
// qualquer extração de campo) — rede de segurança para a migração: mesmo que uma coluna
// estruturada tenha sido mapeada errado ou esquecida, o dado original fica intacto e
// recuperável a partir de `raw`, nunca perdido.
//
// As linhas ALTER TABLE ... ADD COLUMN IF NOT EXISTS abaixo existem porque estas tabelas já
// foram criadas uma vez em produção (janela breve da Fase 0, antes de `raw`/`numero_processo`/
// `repasse_cliente`/`objeto` terem sido adicionados) — CREATE TABLE IF NOT EXISTS é um no-op
// nesse caso, então o ALTER garante que essas colunas existam de qualquer forma, sem tocar
// nas linhas já existentes.
export async function initSchema(sql: Sql): Promise<void> {
  // ── controle ────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS processos (
      tenant_id TEXT NOT NULL, id TEXT NOT NULL,
      autor TEXT NOT NULL DEFAULT '', reu TEXT NOT NULL DEFAULT '', objeto TEXT NOT NULL DEFAULT '',
      numero_processo TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '', hora TEXT NOT NULL DEFAULT '',
      andamento TEXT NOT NULL DEFAULT '', responsavel TEXT NOT NULL DEFAULT '', observacoes TEXT NOT NULL DEFAULT '',
      atencao BOOLEAN NOT NULL DEFAULT FALSE, finalizado BOOLEAN NOT NULL DEFAULT FALSE,
      dashboard_ok BOOLEAN, vara TEXT, tribunal TEXT, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      raw JSONB NOT NULL DEFAULT '{}',
      PRIMARY KEY (tenant_id, id)
    )
  `;
  await sql`ALTER TABLE processos ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE processos ADD COLUMN IF NOT EXISTS prazo_fatal TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_processos_tenant ON processos (tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_processos_numero ON processos (tenant_id, numero_processo)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_processos_finalizado ON processos (tenant_id, finalizado)`;

  await sql`
    CREATE TABLE IF NOT EXISTS tarefas (
      tenant_id TEXT NOT NULL, id TEXT NOT NULL,
      titulo TEXT NOT NULL DEFAULT '', descricao TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'a_fazer', responsavel TEXT NOT NULL DEFAULT '',
      prazo TEXT, processo_id TEXT, processo_titulo TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (tenant_id, id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_tarefas_tenant ON tarefas (tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tarefas_status ON tarefas (tenant_id, status)`;

  await sql`
    CREATE TABLE IF NOT EXISTS feriados_municipais (
      tenant_id TEXT NOT NULL, id TEXT NOT NULL,
      municipio TEXT NOT NULL DEFAULT '', uf TEXT NOT NULL DEFAULT '',
      mes INTEGER NOT NULL, dia INTEGER NOT NULL, nome TEXT NOT NULL DEFAULT '',
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (tenant_id, id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_feriados_municipais_tenant ON feriados_municipais (tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feriados_municipais_uf_mun ON feriados_municipais (tenant_id, uf, municipio)`;

  await sql`
    CREATE TABLE IF NOT EXISTS clientes (
      tenant_id TEXT NOT NULL, id TEXT NOT NULL,
      nome TEXT NOT NULL DEFAULT '', telefone TEXT NOT NULL DEFAULT '', cpf TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '', endereco TEXT NOT NULL DEFAULT '', tipo_aposentadoria TEXT NOT NULL DEFAULT '',
      informacoes TEXT NOT NULL DEFAULT '',
      senha_gov TEXT NOT NULL DEFAULT '', senha_serasa TEXT NOT NULL DEFAULT '',
      tipo_pessoa TEXT NOT NULL DEFAULT 'fisica', cnpj TEXT, tratamento TEXT,
      etiquetas JSONB NOT NULL DEFAULT '[]', telefones_adicionais JSONB NOT NULL DEFAULT '[]',
      emails_adicionais JSONB NOT NULL DEFAULT '[]',
      rg TEXT, profissao TEXT, estado_civil TEXT, nacionalidade TEXT NOT NULL DEFAULT 'brasileiro(a)',
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      raw JSONB NOT NULL DEFAULT '{}',
      PRIMARY KEY (tenant_id, id)
    )
  `;
  await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS banco TEXT`;
  await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS agencia TEXT`;
  await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS conta TEXT`;
  await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_conta TEXT`;
  await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS chave_pix TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_clientes_tenant ON clientes (tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_clientes_nome_cpf ON clientes (tenant_id, nome, cpf)`;

  await sql`
    CREATE TABLE IF NOT EXISTS iniciais (
      tenant_id TEXT NOT NULL, id TEXT NOT NULL,
      cliente TEXT NOT NULL DEFAULT '', reu TEXT NOT NULL DEFAULT '', objeto TEXT NOT NULL DEFAULT '',
      andamento TEXT NOT NULL DEFAULT '', responsavel TEXT NOT NULL DEFAULT '', observacoes TEXT NOT NULL DEFAULT '',
      data TEXT, hora TEXT,
      numero_processo TEXT, -- gravado por iniciais/protocolo/route.ts; não existe no tipo Inicial declarado, mas existe no dado real
      protocolo JSONB,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      raw JSONB NOT NULL DEFAULT '{}',
      PRIMARY KEY (tenant_id, id)
    )
  `;
  await sql`ALTER TABLE iniciais ADD COLUMN IF NOT EXISTS numero_processo TEXT`;
  await sql`ALTER TABLE iniciais ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`;
  await sql`CREATE INDEX IF NOT EXISTS idx_iniciais_tenant ON iniciais (tenant_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS finalizados_sem_honor (
      tenant_id TEXT NOT NULL, id TEXT NOT NULL,
      cliente TEXT NOT NULL DEFAULT '', reu TEXT NOT NULL DEFAULT '', processo TEXT NOT NULL DEFAULT '',
      objeto TEXT NOT NULL DEFAULT '', data_fin TEXT NOT NULL DEFAULT '', motivo TEXT NOT NULL DEFAULT '',
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      raw JSONB NOT NULL DEFAULT '{}',
      PRIMARY KEY (tenant_id, id)
    )
  `;
  await sql`ALTER TABLE finalizados_sem_honor ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`;
  await sql`CREATE INDEX IF NOT EXISTS idx_fin_sem_honor_tenant ON finalizados_sem_honor (tenant_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS redesignacoes (
      tenant_id TEXT NOT NULL, id TEXT NOT NULL, tipo TEXT NOT NULL, item_id TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      de_user_id TEXT NOT NULL, de_user_name TEXT NOT NULL DEFAULT '',
      para_user_id TEXT NOT NULL, para_user_name TEXT NOT NULL DEFAULT '',
      motivo TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pendente',
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), respondido_em TIMESTAMPTZ,
      raw JSONB NOT NULL DEFAULT '{}',
      PRIMARY KEY (tenant_id, id)
    )
  `;
  await sql`ALTER TABLE redesignacoes ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`;
  await sql`CREATE INDEX IF NOT EXISTS idx_redesig_tenant_para_status ON redesignacoes (tenant_id, para_user_id, status)`;

  // ── financeiro ────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS acordos (
      tenant_id TEXT NOT NULL, id TEXT NOT NULL, mes TEXT NOT NULL DEFAULT '',
      data_pagamento TEXT NOT NULL DEFAULT '',
      cliente TEXT NOT NULL DEFAULT '', reu TEXT NOT NULL DEFAULT '', objeto TEXT NOT NULL DEFAULT '',
      processo TEXT NOT NULL DEFAULT '', processo_id TEXT,
      valor_acordo NUMERIC(14,2) NOT NULL DEFAULT 0, honorarios NUMERIC(14,2) NOT NULL DEFAULT 0,
      repasse_cliente NUMERIC(14,2), -- existe em FinalizadoAcordo (controle-data.ts), ausente no tipo Acordo original
      status TEXT NOT NULL DEFAULT 'pago',
      raw JSONB NOT NULL DEFAULT '{}',
      PRIMARY KEY (tenant_id, id)
    )
  `;
  await sql`ALTER TABLE acordos ADD COLUMN IF NOT EXISTS repasse_cliente NUMERIC(14,2)`;
  await sql`ALTER TABLE acordos ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`;
  await sql`CREATE INDEX IF NOT EXISTS idx_acordos_tenant_mes ON acordos (tenant_id, mes)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_acordos_processo ON acordos (tenant_id, processo_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_acordos_processo_num ON acordos (tenant_id, processo)`;

  await sql`
    CREATE TABLE IF NOT EXISTS execucoes (
      tenant_id TEXT NOT NULL, id TEXT NOT NULL, mes TEXT NOT NULL DEFAULT '',
      data_pagamento TEXT NOT NULL DEFAULT '',
      cliente TEXT NOT NULL DEFAULT '', reu TEXT NOT NULL DEFAULT '', processo TEXT NOT NULL DEFAULT '',
      objeto TEXT, -- existe em FinalizadoExecucao (controle-data.ts), ausente no tipo Execucao original
      processo_id TEXT, tipo_execucao TEXT,
      valor_percebido NUMERIC(14,2) NOT NULL DEFAULT 0, pct_honorarios NUMERIC(6,3),
      sucumbencia NUMERIC(14,2) NOT NULL DEFAULT 0, honorarios NUMERIC(14,2) NOT NULL DEFAULT 0,
      repasse_cliente NUMERIC(14,2), status TEXT NOT NULL DEFAULT 'pago', observacoes TEXT,
      raw JSONB NOT NULL DEFAULT '{}',
      PRIMARY KEY (tenant_id, id)
    )
  `;
  await sql`ALTER TABLE execucoes ADD COLUMN IF NOT EXISTS objeto TEXT`;
  await sql`ALTER TABLE execucoes ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`;
  await sql`CREATE INDEX IF NOT EXISTS idx_execucoes_tenant_mes ON execucoes (tenant_id, mes)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_execucoes_processo ON execucoes (tenant_id, processo_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_execucoes_processo_num ON execucoes (tenant_id, processo)`;

  await sql`
    CREATE TABLE IF NOT EXISTS honorarios_iniciais (
      tenant_id TEXT NOT NULL, id TEXT NOT NULL, mes TEXT, cliente TEXT NOT NULL DEFAULT '',
      processo TEXT NOT NULL DEFAULT '', processo_id TEXT, valor NUMERIC(14,2) NOT NULL DEFAULT 0,
      data_pagamento TEXT NOT NULL DEFAULT '', observacao TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pago',
      raw JSONB NOT NULL DEFAULT '{}',
      PRIMARY KEY (tenant_id, id)
    )
  `;
  await sql`ALTER TABLE honorarios_iniciais ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hon_iniciais_tenant_mes ON honorarios_iniciais (tenant_id, mes)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hon_iniciais_processo ON honorarios_iniciais (tenant_id, processo_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS variaveis (
      tenant_id TEXT NOT NULL, id TEXT NOT NULL, descricao TEXT NOT NULL DEFAULT '',
      valor NUMERIC(14,2) NOT NULL DEFAULT 0, parcelas TEXT NOT NULL DEFAULT '1x',
      quem TEXT NOT NULL DEFAULT 'dividido', onde TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pendente', data_compra TEXT NOT NULL DEFAULT '',
      meses JSONB NOT NULL DEFAULT '{}',
      raw JSONB NOT NULL DEFAULT '{}',
      PRIMARY KEY (tenant_id, id)
    )
  `;
  await sql`ALTER TABLE variaveis ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`;
  await sql`CREATE INDEX IF NOT EXISTS idx_variaveis_tenant ON variaveis (tenant_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS timesheets (
      tenant_id TEXT NOT NULL, id TEXT NOT NULL, processo_id TEXT, processo TEXT, cliente TEXT,
      data TEXT NOT NULL DEFAULT '', minutos INTEGER NOT NULL DEFAULT 0, descricao TEXT NOT NULL DEFAULT '',
      responsavel TEXT NOT NULL DEFAULT '', faturavel BOOLEAN NOT NULL DEFAULT TRUE,
      valor_hora NUMERIC(10,2), status TEXT NOT NULL DEFAULT 'pendente',
      raw JSONB NOT NULL DEFAULT '{}',
      PRIMARY KEY (tenant_id, id)
    )
  `;
  await sql`ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`;
  await sql`CREATE INDEX IF NOT EXISTS idx_timesheets_tenant ON timesheets (tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_timesheets_processo ON timesheets (tenant_id, processo_id)`;

  // fixas: normaliza os 4 mapas paralelos (fixas/fixas_quem/fixas_status/fixas_valor_fixo) em pai + filho.
  await sql`
    CREATE TABLE IF NOT EXISTS fixas_categorias (
      tenant_id TEXT NOT NULL, categoria TEXT NOT NULL, quem TEXT NOT NULL DEFAULT 'dividido',
      valor_fixo NUMERIC(14,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (tenant_id, categoria)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS fixas_valores (
      tenant_id TEXT NOT NULL, categoria TEXT NOT NULL, col TEXT NOT NULL,
      valor NUMERIC(14,2) NOT NULL DEFAULT 0, status TEXT,
      PRIMARY KEY (tenant_id, categoria, col),
      FOREIGN KEY (tenant_id, categoria) REFERENCES fixas_categorias (tenant_id, categoria) ON DELETE CASCADE
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_fixas_valores_tenant ON fixas_valores (tenant_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS config_escritorio (
      tenant_id TEXT PRIMARY KEY, tipo TEXT NOT NULL DEFAULT 'individual',
      socios JSONB NOT NULL DEFAULT '[]'
    )
  `;
}
