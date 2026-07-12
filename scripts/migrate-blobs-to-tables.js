/**
 * Migra os dados de kv_store (blob JSON por tenant) para as tabelas relacionais
 * definidas em lib/schema.ts. NUNCA apaga nem altera as linhas do kv_store — elas
 * continuam intactas como rede de segurança durante toda a migração por fases.
 *
 * Toda linha migrada ganha uma coluna `raw` com o item original inteiro (antes de
 * qualquer extração de campo), então mesmo que uma coluna estruturada tenha sido
 * mapeada errado, o dado original nunca é perdido.
 *
 * Uso:
 *   1. vercel env pull .env.production.local --environment=production
 *   2. node scripts/migrate-blobs-to-tables.js --dry-run [--tenant=t_1]
 *   3. node scripts/migrate-blobs-to-tables.js --backup ./backup-2026-07-04.json
 *   4. node scripts/migrate-blobs-to-tables.js --tenant=t_1              (roda de verdade, um tenant por vez)
 *   5. node scripts/migrate-blobs-to-tables.js --verify [--tenant=t_1]
 *   6. rm .env.production.local
 *
 * Sem --dry-run nem --backup já feito, o script se recusa a escrever de verdade.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { neon } = require("@neondatabase/serverless");

const ENV_FILE = path.join(__dirname, "..", ".env.production.local");

function loadEnv(file) {
  const raw = fs.readFileSync(file, "utf-8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
    if (!m) continue;
    const [, key, value] = m;
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { dryRun: false, verify: false, tenant: null, backup: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--verify") out.verify = true;
    else if (a.startsWith("--tenant=")) out.tenant = a.slice("--tenant=".length);
    else if (a === "--backup") out.backup = args[++i];
    else if (a.startsWith("--backup=")) out.backup = a.slice("--backup=".length);
  }
  return out;
}

function hashId(parts) {
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 8);
}

function newId() {
  return crypto.randomBytes(4).toString("hex");
}

function toJsonb(v) {
  return JSON.stringify(v ?? null);
}

// ---- espelha lib/controle-data.ts parseRaw() — não descriptografa senha_gov/senha_serasa,
// migram como estão no blob (já criptografadas), igual à coluna clientes.senha_gov/senha_serasa ----
function parseControle(d) {
  d = d || {};
  return {
    processos: (d.processos || []).map(p => ({
      atencao: false, finalizado: false, hora: "", responsavel: "",
      observacoes: "", objeto: "", reu: "", numero_processo: "", data: "",
      ...p,
    })),
    clientes: (d.clientes || []).map(c => ({
      telefone: "", cpf: "", email: "", endereco: "",
      tipo_aposentadoria: "", informacoes: "", senha_gov: "", senha_serasa: "",
      tipo_pessoa: "fisica", cnpj: "", tratamento: "",
      etiquetas: [], telefones_adicionais: [], emails_adicionais: [],
      rg: "", profissao: "", estado_civil: "", nacionalidade: "brasileiro(a)",
      ...c,
    })),
    iniciais: (d.iniciais || []).map(i => ({
      reu: "", objeto: "", responsavel: "", observacoes: "", data: "", hora: "",
      ...i,
    })),
    finalizados_externos_sem_honor: d.finalizados_externos_sem_honor || [],
    finalizados_externos_acordos: d.finalizados_externos_acordos || [],
    finalizados_execucao: d.finalizados_execucao || [],
    redesignacoes: d.redesignacoes || [],
  };
}

// ---- espelha lib/financeiro-data.ts parseRaw() ----
function parseFinanceiro(d) {
  d = d || {};
  const withIdx = (arr, defaults) => (arr || []).map((item, i) => ({ id: String(i), ...defaults, ...item }));
  return {
    acordos: withIdx(d.acordos, { objeto: "", reu: "", processo: "", data_pagamento: "", status: "pago" }),
    execucoes: withIdx(d.execucoes, { data_pagamento: "", reu: "", processo: "", sucumbencia: 0, status: "pago" }),
    honorarios_iniciais: withIdx(d.honorarios_iniciais, { processo: "", data_pagamento: "", observacao: "", status: "pago", mes: "" }),
    fixas: d.fixas || {},
    fixas_valor_fixo: d.fixas_valor_fixo || {},
    fixas_quem: d.fixas_quem || {},
    fixas_status: d.fixas_status || {},
    variaveis: withIdx(d.variaveis, { parcelas: "1x", quem: "dividido", onde: "", data_compra: "", status: "pendente", meses: {} }),
    timesheets: withIdx(d.timesheets, { processo: "", cliente: "", descricao: "", faturavel: true, status: "pendente" }),
    config_escritorio: d.config_escritorio || null,
  };
}

const finKey = (processo, cliente, mes) => `${processo || ""}|${(cliente || "").toUpperCase()}|${mes || ""}`;

// ---- monta o plano de migração de UM tenant: lista de {table, row} a inserir ----
function buildPlan(tenantId, controle, financeiro) {
  const plan = { tenantId, tables: {} };
  const add = (table, row) => { (plan.tables[table] ||= []).push(row); };

  for (const p of controle.processos) {
    add("processos", {
      tenant_id: tenantId, id: p.id, autor: p.autor || "", reu: p.reu, objeto: p.objeto,
      numero_processo: p.numero_processo, data: p.data, hora: p.hora, andamento: p.andamento || "",
      responsavel: p.responsavel, observacoes: p.observacoes, atencao: !!p.atencao, finalizado: !!p.finalizado,
      dashboard_ok: p.dashboard_ok ?? null, vara: p.vara ?? null, tribunal: p.tribunal ?? null,
      criado_em: p.criado_em || new Date().toISOString(), raw: p,
    });
  }

  for (const c of controle.clientes) {
    add("clientes", {
      tenant_id: tenantId, id: c.id, nome: c.nome || "", telefone: c.telefone, cpf: c.cpf, email: c.email,
      endereco: c.endereco, tipo_aposentadoria: c.tipo_aposentadoria, informacoes: c.informacoes,
      senha_gov: c.senha_gov, senha_serasa: c.senha_serasa, tipo_pessoa: c.tipo_pessoa,
      cnpj: c.cnpj ?? null, tratamento: c.tratamento ?? null,
      etiquetas: c.etiquetas || [], telefones_adicionais: c.telefones_adicionais || [], emails_adicionais: c.emails_adicionais || [],
      rg: c.rg ?? null, profissao: c.profissao ?? null, estado_civil: c.estado_civil ?? null, nacionalidade: c.nacionalidade,
      banco: c.banco ?? null, agencia: c.agencia ?? null, conta: c.conta ?? null,
      tipo_conta: c.tipo_conta ?? "corrente", chave_pix: c.chave_pix ?? null,
      criado_em: c.criado_em || new Date().toISOString(), raw: c,
    });
  }

  for (const i of controle.iniciais) {
    add("iniciais", {
      tenant_id: tenantId, id: i.id, cliente: i.cliente || "", reu: i.reu, objeto: i.objeto, andamento: i.andamento || "",
      responsavel: i.responsavel, observacoes: i.observacoes, data: i.data ?? null, hora: i.hora ?? null,
      numero_processo: i.numero_processo ?? null, protocolo: i.protocolo ?? null,
      criado_em: i.criado_em || new Date().toISOString(), raw: i,
    });
  }

  for (const r of controle.redesignacoes) {
    add("redesignacoes", {
      tenant_id: tenantId, id: r.id, tipo: r.tipo || "processo", item_id: r.itemId || "", label: r.label || "",
      de_user_id: r.deUserId || "", de_user_name: r.deUserName || "", para_user_id: r.paraUserId || "", para_user_name: r.paraUserName || "",
      motivo: r.motivo || "", status: r.status || "pendente",
      criado_em: r.criado_em || new Date().toISOString(), respondido_em: r.respondido_em ?? null, raw: r,
    });
  }

  for (const f of controle.finalizados_externos_sem_honor) {
    const id = hashId([f.processo || "", f.cliente || "", f.reu || "", f.data_fin || ""]);
    add("finalizados_sem_honor", {
      tenant_id: tenantId, id, cliente: f.cliente || "", reu: f.reu || "", processo: f.processo || "",
      objeto: f.objeto || "", data_fin: f.data_fin || "", motivo: f.motivo || "", raw: f,
    });
  }

  // ── acordos: financeiro.acordos + fold-in de controle.finalizados_externos_acordos ──
  const acordosByKey = new Map();
  for (const a of financeiro.acordos) {
    const row = {
      tenant_id: tenantId, id: a.id, mes: a.mes, data_pagamento: a.data_pagamento, cliente: a.cliente,
      reu: a.reu, objeto: a.objeto, processo: a.processo, processo_id: a.processoId ?? null,
      valor_acordo: a.valor_acordo || 0, honorarios: a.honorarios || 0, repasse_cliente: null,
      status: a.status || "pago", raw: a,
    };
    acordosByKey.set(finKey(a.processo, a.cliente, a.mes), row);
  }
  for (const f of controle.finalizados_externos_acordos) {
    const key = finKey(f.processo, f.cliente, f.mes);
    const existing = acordosByKey.get(key);
    if (existing) {
      if (existing.repasse_cliente == null) existing.repasse_cliente = f.repasse_cliente ?? null;
      existing.raw = { financeiro: existing.raw, finalizado_controle: f };
    } else {
      acordosByKey.set(key, {
        tenant_id: tenantId, id: newId(), mes: f.mes, data_pagamento: f.data_pagamento, cliente: f.cliente,
        reu: f.reu, objeto: f.objeto, processo: f.processo, processo_id: null,
        valor_acordo: f.valor_acordo || 0, honorarios: f.honorarios || 0, repasse_cliente: f.repasse_cliente ?? null,
        status: f.status || "pago", raw: { finalizado_controle: f },
      });
    }
  }
  for (const row of acordosByKey.values()) add("acordos", row);

  // ── execucoes: financeiro.execucoes + fold-in de controle.finalizados_execucao ──
  const execByKey = new Map();
  for (const e of financeiro.execucoes) {
    const row = {
      tenant_id: tenantId, id: e.id, mes: e.mes, data_pagamento: e.data_pagamento, cliente: e.cliente, reu: e.reu,
      processo: e.processo, objeto: null, processo_id: e.processoId ?? null, tipo_execucao: e.tipo_execucao ?? null,
      valor_percebido: e.valor_percebido || 0, pct_honorarios: e.pct_honorarios ?? null, sucumbencia: e.sucumbencia || 0,
      honorarios: e.honorarios || 0, repasse_cliente: e.repasse_cliente ?? null, status: e.status || "pago",
      observacoes: null, raw: e,
    };
    execByKey.set(finKey(e.processo, e.cliente, e.mes), row);
  }
  for (const f of controle.finalizados_execucao) {
    const key = finKey(f.processo, f.cliente, f.mes);
    const existing = execByKey.get(key);
    if (existing) {
      if (existing.objeto == null) existing.objeto = f.objeto ?? null;
      if (existing.observacoes == null) existing.observacoes = f.observacoes ?? null;
      if (existing.repasse_cliente == null) existing.repasse_cliente = f.repasse_cliente ?? null;
      existing.raw = { financeiro: existing.raw, finalizado_controle: f };
    } else {
      execByKey.set(key, {
        tenant_id: tenantId, id: newId(), mes: f.mes, data_pagamento: f.data_pagamento, cliente: f.cliente, reu: f.reu,
        processo: f.processo, objeto: f.objeto ?? null, processo_id: null, tipo_execucao: "processo_completo",
        valor_percebido: f.valor_execucao || 0, pct_honorarios: null, sucumbencia: 0,
        honorarios: f.honorarios || 0, repasse_cliente: f.repasse_cliente ?? null, status: f.status || "pago",
        observacoes: f.observacoes ?? null, raw: { finalizado_controle: f },
      });
    }
  }
  for (const row of execByKey.values()) add("execucoes", row);

  for (const h of financeiro.honorarios_iniciais) {
    add("honorarios_iniciais", {
      tenant_id: tenantId, id: h.id, mes: h.mes ?? null, cliente: h.cliente, processo: h.processo,
      processo_id: h.processoId ?? null, valor: h.valor || 0, data_pagamento: h.data_pagamento,
      observacao: h.observacao, status: h.status || "pago", raw: h,
    });
  }

  for (const v of financeiro.variaveis) {
    add("variaveis", {
      tenant_id: tenantId, id: v.id, descricao: v.descricao || "", valor: v.valor || 0, parcelas: v.parcelas,
      quem: v.quem, onde: v.onde, status: v.status || "pendente", data_compra: v.data_compra,
      meses: v.meses || {}, raw: v,
    });
  }

  for (const t of financeiro.timesheets) {
    add("timesheets", {
      tenant_id: tenantId, id: t.id, processo_id: t.processoId ?? null, processo: t.processo ?? null,
      cliente: t.cliente ?? null, data: t.data || "", minutos: t.minutos || 0, descricao: t.descricao,
      responsavel: t.responsavel || "", faturavel: !!t.faturavel, valor_hora: t.valor_hora ?? null,
      status: t.status || "pendente", raw: t,
    });
  }

  // ── fixas: 4 mapas paralelos -> fixas_categorias (pai) + fixas_valores (filho) ──
  const categorias = new Set([
    ...Object.keys(financeiro.fixas || {}),
    ...Object.keys(financeiro.fixas_quem || {}),
    ...Object.keys(financeiro.fixas_status || {}),
    ...Object.keys(financeiro.fixas_valor_fixo || {}),
  ]);
  for (const categoria of categorias) {
    add("fixas_categorias", {
      tenant_id: tenantId, categoria, quem: financeiro.fixas_quem?.[categoria] || "dividido",
      valor_fixo: financeiro.fixas_valor_fixo?.[categoria] || 0,
    });
    const valores = financeiro.fixas?.[categoria] || {};
    const status = financeiro.fixas_status?.[categoria] || {};
    const cols = new Set([...Object.keys(valores), ...Object.keys(status)]);
    for (const col of cols) {
      add("fixas_valores", {
        tenant_id: tenantId, categoria, col, valor: valores[col] || 0, status: status[col] ?? null,
      });
    }
  }

  if (financeiro.config_escritorio) {
    add("config_escritorio", {
      tenant_id: tenantId, tipo: financeiro.config_escritorio.tipo || "individual",
      socios: financeiro.config_escritorio.socios || [],
    });
  }

  return plan;
}

// ---- DDL: mesmas tabelas de lib/schema.ts (mantido em sincronia manualmente — script
// standalone em CommonJS, não importa o módulo TS diretamente) ----
const DDL = [
  `CREATE TABLE IF NOT EXISTS processos (
    tenant_id TEXT NOT NULL, id TEXT NOT NULL,
    autor TEXT NOT NULL DEFAULT '', reu TEXT NOT NULL DEFAULT '', objeto TEXT NOT NULL DEFAULT '',
    numero_processo TEXT NOT NULL DEFAULT '', data TEXT NOT NULL DEFAULT '', hora TEXT NOT NULL DEFAULT '',
    andamento TEXT NOT NULL DEFAULT '', responsavel TEXT NOT NULL DEFAULT '', observacoes TEXT NOT NULL DEFAULT '',
    atencao BOOLEAN NOT NULL DEFAULT FALSE, finalizado BOOLEAN NOT NULL DEFAULT FALSE,
    dashboard_ok BOOLEAN, vara TEXT, tribunal TEXT, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw JSONB NOT NULL DEFAULT '{}', PRIMARY KEY (tenant_id, id))`,
  `ALTER TABLE processos ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`,
  `ALTER TABLE processos ADD COLUMN IF NOT EXISTS prazo_fatal TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_processos_tenant ON processos (tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_processos_numero ON processos (tenant_id, numero_processo)`,
  `CREATE INDEX IF NOT EXISTS idx_processos_finalizado ON processos (tenant_id, finalizado)`,
  `CREATE TABLE IF NOT EXISTS clientes (
    tenant_id TEXT NOT NULL, id TEXT NOT NULL,
    nome TEXT NOT NULL DEFAULT '', telefone TEXT NOT NULL DEFAULT '', cpf TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '', endereco TEXT NOT NULL DEFAULT '', tipo_aposentadoria TEXT NOT NULL DEFAULT '',
    informacoes TEXT NOT NULL DEFAULT '', senha_gov TEXT NOT NULL DEFAULT '', senha_serasa TEXT NOT NULL DEFAULT '',
    tipo_pessoa TEXT NOT NULL DEFAULT 'fisica', cnpj TEXT, tratamento TEXT,
    etiquetas JSONB NOT NULL DEFAULT '[]', telefones_adicionais JSONB NOT NULL DEFAULT '[]',
    emails_adicionais JSONB NOT NULL DEFAULT '[]',
    rg TEXT, profissao TEXT, estado_civil TEXT, nacionalidade TEXT NOT NULL DEFAULT 'brasileiro(a)',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), raw JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (tenant_id, id))`,
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`,
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS banco TEXT`,
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS agencia TEXT`,
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS conta TEXT`,
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_conta TEXT`,
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS chave_pix TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_clientes_tenant ON clientes (tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_clientes_nome_cpf ON clientes (tenant_id, nome, cpf)`,
  `CREATE TABLE IF NOT EXISTS iniciais (
    tenant_id TEXT NOT NULL, id TEXT NOT NULL,
    cliente TEXT NOT NULL DEFAULT '', reu TEXT NOT NULL DEFAULT '', objeto TEXT NOT NULL DEFAULT '',
    andamento TEXT NOT NULL DEFAULT '', responsavel TEXT NOT NULL DEFAULT '', observacoes TEXT NOT NULL DEFAULT '',
    data TEXT, hora TEXT, numero_processo TEXT, protocolo JSONB,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), raw JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (tenant_id, id))`,
  `ALTER TABLE iniciais ADD COLUMN IF NOT EXISTS numero_processo TEXT`,
  `ALTER TABLE iniciais ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`,
  `CREATE INDEX IF NOT EXISTS idx_iniciais_tenant ON iniciais (tenant_id)`,
  `CREATE TABLE IF NOT EXISTS finalizados_sem_honor (
    tenant_id TEXT NOT NULL, id TEXT NOT NULL,
    cliente TEXT NOT NULL DEFAULT '', reu TEXT NOT NULL DEFAULT '', processo TEXT NOT NULL DEFAULT '',
    objeto TEXT NOT NULL DEFAULT '', data_fin TEXT NOT NULL DEFAULT '', motivo TEXT NOT NULL DEFAULT '',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), raw JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (tenant_id, id))`,
  `ALTER TABLE finalizados_sem_honor ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`,
  `CREATE INDEX IF NOT EXISTS idx_fin_sem_honor_tenant ON finalizados_sem_honor (tenant_id)`,
  `CREATE TABLE IF NOT EXISTS redesignacoes (
    tenant_id TEXT NOT NULL, id TEXT NOT NULL, tipo TEXT NOT NULL, item_id TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '', de_user_id TEXT NOT NULL, de_user_name TEXT NOT NULL DEFAULT '',
    para_user_id TEXT NOT NULL, para_user_name TEXT NOT NULL DEFAULT '',
    motivo TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pendente',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), respondido_em TIMESTAMPTZ, raw JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (tenant_id, id))`,
  `ALTER TABLE redesignacoes ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`,
  `CREATE INDEX IF NOT EXISTS idx_redesig_tenant_para_status ON redesignacoes (tenant_id, para_user_id, status)`,
  `CREATE TABLE IF NOT EXISTS acordos (
    tenant_id TEXT NOT NULL, id TEXT NOT NULL, mes TEXT NOT NULL DEFAULT '', data_pagamento TEXT NOT NULL DEFAULT '',
    cliente TEXT NOT NULL DEFAULT '', reu TEXT NOT NULL DEFAULT '', objeto TEXT NOT NULL DEFAULT '',
    processo TEXT NOT NULL DEFAULT '', processo_id TEXT,
    valor_acordo NUMERIC(14,2) NOT NULL DEFAULT 0, honorarios NUMERIC(14,2) NOT NULL DEFAULT 0,
    repasse_cliente NUMERIC(14,2), status TEXT NOT NULL DEFAULT 'pago', raw JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (tenant_id, id))`,
  `ALTER TABLE acordos ADD COLUMN IF NOT EXISTS repasse_cliente NUMERIC(14,2)`,
  `ALTER TABLE acordos ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`,
  `CREATE INDEX IF NOT EXISTS idx_acordos_tenant_mes ON acordos (tenant_id, mes)`,
  `CREATE INDEX IF NOT EXISTS idx_acordos_processo ON acordos (tenant_id, processo_id)`,
  `CREATE INDEX IF NOT EXISTS idx_acordos_processo_num ON acordos (tenant_id, processo)`,
  `CREATE TABLE IF NOT EXISTS execucoes (
    tenant_id TEXT NOT NULL, id TEXT NOT NULL, mes TEXT NOT NULL DEFAULT '', data_pagamento TEXT NOT NULL DEFAULT '',
    cliente TEXT NOT NULL DEFAULT '', reu TEXT NOT NULL DEFAULT '', processo TEXT NOT NULL DEFAULT '', objeto TEXT,
    processo_id TEXT, tipo_execucao TEXT,
    valor_percebido NUMERIC(14,2) NOT NULL DEFAULT 0, pct_honorarios NUMERIC(6,3),
    sucumbencia NUMERIC(14,2) NOT NULL DEFAULT 0, honorarios NUMERIC(14,2) NOT NULL DEFAULT 0,
    repasse_cliente NUMERIC(14,2), status TEXT NOT NULL DEFAULT 'pago', observacoes TEXT,
    raw JSONB NOT NULL DEFAULT '{}', PRIMARY KEY (tenant_id, id))`,
  `ALTER TABLE execucoes ADD COLUMN IF NOT EXISTS objeto TEXT`,
  `ALTER TABLE execucoes ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`,
  `CREATE INDEX IF NOT EXISTS idx_execucoes_tenant_mes ON execucoes (tenant_id, mes)`,
  `CREATE INDEX IF NOT EXISTS idx_execucoes_processo ON execucoes (tenant_id, processo_id)`,
  `CREATE INDEX IF NOT EXISTS idx_execucoes_processo_num ON execucoes (tenant_id, processo)`,
  `CREATE TABLE IF NOT EXISTS honorarios_iniciais (
    tenant_id TEXT NOT NULL, id TEXT NOT NULL, mes TEXT, cliente TEXT NOT NULL DEFAULT '',
    processo TEXT NOT NULL DEFAULT '', processo_id TEXT, valor NUMERIC(14,2) NOT NULL DEFAULT 0,
    data_pagamento TEXT NOT NULL DEFAULT '', observacao TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pago',
    raw JSONB NOT NULL DEFAULT '{}', PRIMARY KEY (tenant_id, id))`,
  `ALTER TABLE honorarios_iniciais ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`,
  `CREATE INDEX IF NOT EXISTS idx_hon_iniciais_tenant_mes ON honorarios_iniciais (tenant_id, mes)`,
  `CREATE INDEX IF NOT EXISTS idx_hon_iniciais_processo ON honorarios_iniciais (tenant_id, processo_id)`,
  `CREATE TABLE IF NOT EXISTS variaveis (
    tenant_id TEXT NOT NULL, id TEXT NOT NULL, descricao TEXT NOT NULL DEFAULT '',
    valor NUMERIC(14,2) NOT NULL DEFAULT 0, parcelas TEXT NOT NULL DEFAULT '1x',
    quem TEXT NOT NULL DEFAULT 'dividido', onde TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pendente', data_compra TEXT NOT NULL DEFAULT '',
    meses JSONB NOT NULL DEFAULT '{}', raw JSONB NOT NULL DEFAULT '{}', PRIMARY KEY (tenant_id, id))`,
  `ALTER TABLE variaveis ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`,
  `CREATE INDEX IF NOT EXISTS idx_variaveis_tenant ON variaveis (tenant_id)`,
  `CREATE TABLE IF NOT EXISTS timesheets (
    tenant_id TEXT NOT NULL, id TEXT NOT NULL, processo_id TEXT, processo TEXT, cliente TEXT,
    data TEXT NOT NULL DEFAULT '', minutos INTEGER NOT NULL DEFAULT 0, descricao TEXT NOT NULL DEFAULT '',
    responsavel TEXT NOT NULL DEFAULT '', faturavel BOOLEAN NOT NULL DEFAULT TRUE,
    valor_hora NUMERIC(10,2), status TEXT NOT NULL DEFAULT 'pendente',
    raw JSONB NOT NULL DEFAULT '{}', PRIMARY KEY (tenant_id, id))`,
  `ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'`,
  `CREATE INDEX IF NOT EXISTS idx_timesheets_tenant ON timesheets (tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_timesheets_processo ON timesheets (tenant_id, processo_id)`,
  `CREATE TABLE IF NOT EXISTS fixas_categorias (
    tenant_id TEXT NOT NULL, categoria TEXT NOT NULL, quem TEXT NOT NULL DEFAULT 'dividido',
    valor_fixo NUMERIC(14,2) NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, categoria))`,
  `CREATE TABLE IF NOT EXISTS fixas_valores (
    tenant_id TEXT NOT NULL, categoria TEXT NOT NULL, col TEXT NOT NULL,
    valor NUMERIC(14,2) NOT NULL DEFAULT 0, status TEXT,
    PRIMARY KEY (tenant_id, categoria, col),
    FOREIGN KEY (tenant_id, categoria) REFERENCES fixas_categorias (tenant_id, categoria) ON DELETE CASCADE)`,
  `CREATE INDEX IF NOT EXISTS idx_fixas_valores_tenant ON fixas_valores (tenant_id)`,
  `CREATE TABLE IF NOT EXISTS config_escritorio (
    tenant_id TEXT PRIMARY KEY, tipo TEXT NOT NULL DEFAULT 'individual', socios JSONB NOT NULL DEFAULT '[]')`,
  `CREATE TABLE IF NOT EXISTS tarefas (
    tenant_id TEXT NOT NULL, id TEXT NOT NULL,
    titulo TEXT NOT NULL DEFAULT '', descricao TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'a_fazer', responsavel TEXT NOT NULL DEFAULT '',
    prazo TEXT, processo_id TEXT, processo_titulo TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, id))`,
  `CREATE INDEX IF NOT EXISTS idx_tarefas_tenant ON tarefas (tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tarefas_status ON tarefas (tenant_id, status)`,
];

async function ensureSchema(sql) {
  for (const stmt of DDL) await sql.query(stmt);
}

// NÃO dá await aqui — retorna a promise da query "crua" para ser incluída em sql.transaction([...]),
// que precisa das queries ainda não resolvidas para agrupá-las numa transação atômica real.
function buildInsertStatement(sql, table, row) {
  const cols = Object.keys(row);
  const jsonbCols = new Set(["raw", "etiquetas", "telefones_adicionais", "emails_adicionais", "meses", "protocolo", "socios"]);
  const values = cols.map(c => (jsonbCols.has(c) ? toJsonb(row[c]) : row[c]));
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const updates = cols.filter(c => !isPkCol(table, c)).map(c => `${c} = EXCLUDED.${c}`).join(", ");
  const conflictCols = pkCols(table).join(", ");
  const text = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})
    ON CONFLICT (${conflictCols}) DO UPDATE SET ${updates}`;
  return sql.query(text, values);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function pkCols(table) {
  if (table === "fixas_categorias") return ["tenant_id", "categoria"];
  if (table === "fixas_valores") return ["tenant_id", "categoria", "col"];
  if (table === "config_escritorio") return ["tenant_id"];
  return ["tenant_id", "id"];
}
function isPkCol(table, c) { return pkCols(table).includes(c); }

async function main() {
  const opts = parseArgs();
  if (!fs.existsSync(ENV_FILE)) {
    console.error(`Arquivo não encontrado: ${ENV_FILE}\nRode primeiro: vercel env pull .env.production.local --environment=production`);
    process.exit(1);
  }
  loadEnv(ENV_FILE);
  if (!process.env.POSTGRES_URL) { console.error("POSTGRES_URL não encontrado no .env.production.local"); process.exit(1); }

  const isRealRun = !opts.dryRun && !opts.verify;
  if (isRealRun && !opts.backup) {
    console.error("Recusando rodar sem --dry-run nem --backup <arquivo>. Rode primeiro:\n  node scripts/migrate-blobs-to-tables.js --backup ./backup.json");
    process.exit(1);
  }

  const sql = neon(process.env.POSTGRES_URL);
  await ensureSchema(sql);

  // Descobre tenants a partir das chaves existentes em kv_store
  const keyRows = await sql`SELECT key, value, updated_at FROM kv_store WHERE key LIKE 'controle\_%' OR key LIKE 'financeiro\_%'`;
  const byTenant = new Map();
  for (const r of keyRows) {
    const m = r.key.match(/^(controle|financeiro)_(.+)$/);
    if (!m) continue;
    const [, mod, tenantId] = m;
    if (opts.tenant && tenantId !== opts.tenant) continue;
    if (!byTenant.has(tenantId)) byTenant.set(tenantId, {});
    byTenant.get(tenantId)[mod] = r.value;
  }

  if (opts.backup) {
    fs.writeFileSync(opts.backup, JSON.stringify(keyRows, null, 2), "utf-8");
    console.log(`Backup salvo em ${opts.backup} (${keyRows.length} linhas de kv_store).`);
    if (!opts.dryRun && !opts.tenant) {
      console.log("Backup concluído. Rode de novo com --tenant=<id> para migrar de verdade, um tenant por vez.");
      return;
    }
  }

  if (byTenant.size === 0) {
    console.log("Nenhum tenant encontrado (verifique --tenant ou se kv_store tem dados controle_*/financeiro_*).");
    return;
  }

  for (const [tenantId, blobs] of byTenant) {
    const controle = parseControle(blobs.controle);
    const financeiro = parseFinanceiro(blobs.financeiro);
    const plan = buildPlan(tenantId, controle, financeiro);

    console.log(`\n── tenant ${tenantId} ──`);
    for (const [table, rows] of Object.entries(plan.tables)) {
      console.log(`  ${table}: ${rows.length} linha(s)`);
    }

    if (opts.verify) {
      for (const [table, rows] of Object.entries(plan.tables)) {
        const res = await sql.query(`SELECT COUNT(*) FROM ${table} WHERE tenant_id = $1`, [tenantId]);
        const dbCount = Number(res[0].count);
        const flag = dbCount === rows.length ? "OK" : "DIVERGE";
        console.log(`    [verify] ${table}: blob=${rows.length} banco=${dbCount} ${flag}`);
      }
      continue;
    }

    if (opts.dryRun) continue;

    // Ordem segura (fixas_categorias antes de fixas_valores, por causa da FK)
    const order = ["processos", "clientes", "iniciais", "finalizados_sem_honor", "redesignacoes",
      "acordos", "execucoes", "honorarios_iniciais", "variaveis", "timesheets",
      "fixas_categorias", "fixas_valores", "config_escritorio"];
    const allRows = []; // [{table, row}] na ordem correta, para manter fixas_categorias antes de fixas_valores
    for (const table of order) {
      const rows = plan.tables[table];
      if (!rows) continue;
      for (const row of rows) allRows.push({ table, row });
    }
    // Executa em lotes transacionais (cada lote é atômico; lotes são independentes entre si,
    // e todo INSERT é idempotente via ON CONFLICT, então re-rodar depois de uma falha é seguro).
    for (const batch of chunk(allRows, 200)) {
      const statements = batch.map(({ table, row }) => buildInsertStatement(sql, table, row));
      await sql.transaction(statements);
    }
    console.log(`  -> migrado (${allRows.length} linha(s) em ${chunk(allRows, 200).length} lote(s)).`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
