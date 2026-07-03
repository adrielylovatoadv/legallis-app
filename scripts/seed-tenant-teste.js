/**
 * Cria um tenant de teste ISOLADO (usuário fictício + processos + iniciais + financeiro)
 * direto no banco de produção (Neon), sem tocar nos dados reais do escritório.
 *
 * Uso:
 *   1. vercel env pull .env.production.local --environment=production
 *   2. node scripts/seed-tenant-teste.js
 *
 * Depois de rodar, pode apagar o .env.production.local com segurança:
 *   rm .env.production.local
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { neon } = require("@neondatabase/serverless");

const ENV_FILE = path.join(__dirname, "..", ".env.production.local");
const TENANT_ID = "t_demo";
const DEMO_EMAIL = "demo@legallis.app.br";
const DEMO_PASSWORD = "Demo@2026!";

function loadEnv(file) {
  const raw = fs.readFileSync(file, "utf-8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
    if (!m) continue;
    const [, key, value] = m;
    if (!process.env[key]) process.env[key] = value;
  }
}

function newId() {
  return crypto.randomBytes(4).toString("hex");
}

async function main() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error(`Arquivo não encontrado: ${ENV_FILE}`);
    console.error("Rode antes: vercel env pull .env.production.local --environment=production");
    process.exit(1);
  }
  loadEnv(ENV_FILE);

  if (!process.env.POSTGRES_URL) {
    console.error("POSTGRES_URL não encontrado no .env.production.local");
    process.exit(1);
  }

  const sql = neon(process.env.POSTGRES_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  async function dbGet(key) {
    const rows = await sql`SELECT value FROM kv_store WHERE key = ${key}`;
    return rows.length ? rows[0].value : null;
  }
  async function dbSet(key, value) {
    await sql`
      INSERT INTO kv_store (key, value) VALUES (${key}, ${JSON.stringify(value)})
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(value)}, updated_at = NOW()
    `;
  }

  // ── 1. Usuário fictício ──────────────────────────────────────────────
  const users = (await dbGet("users_global")) || [];
  const already = users.find(u => u.email === DEMO_EMAIL);
  if (already) {
    console.log(`Usuário ${DEMO_EMAIL} já existe (tenantId=${already.tenantId}). Pulando criação de usuário.`);
  } else {
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
    const demoUser = {
      id: crypto.randomUUID(),
      name: "Camila Ferreira Dias",
      email: DEMO_EMAIL,
      password: hashedPassword,
      role: "admin",
      plan: "profissional",
      avatar: "",
      createdAt: new Date().toISOString(),
      phone: "(35) 99999-1234",
      company: {
        name: "Escritório Teste Legallis",
        cnpj: "00.000.000/0001-00",
        address: "Rua Fictícia, 123 - Centro, Poços de Caldas/MG",
      },
      subscriptionStatus: "active",
      theme: "dark",
      isActive: true,
      tenantId: TENANT_ID,
      sexo: "feminino",
    };
    users.push(demoUser);
    await dbSet("users_global", users);
    console.log(`Usuário fictício criado: ${DEMO_EMAIL} (tenantId=${TENANT_ID})`);
  }

  // ── 2. Controle Processual fictício ──────────────────────────────────
  const nowIso = new Date().toISOString();

  const clientes = [
    {
      id: newId(), nome: "Maria Aparecida Souza", telefone: "(35) 98888-1111",
      cpf: "111.111.111-11", email: "maria.souza@fakemail.com",
      endereco: "Rua das Flores, 45 - Centro", tipo_aposentadoria: "Aposentadoria por idade",
      informacoes: "Cliente fictício para testes do sistema", senha_gov: "", senha_serasa: "",
      criado_em: nowIso,
    },
    {
      id: newId(), nome: "João Batista Ferreira", telefone: "(35) 98888-2222",
      cpf: "222.222.222-22", email: "joao.ferreira@fakemail.com",
      endereco: "Av. Brasil, 900 - Jardim América", tipo_aposentadoria: "",
      informacoes: "Cliente fictício para testes do sistema", senha_gov: "", senha_serasa: "",
      criado_em: nowIso,
    },
    {
      id: newId(), nome: "Antônia Ribeiro Lima", telefone: "(35) 98888-3333",
      cpf: "333.333.333-33", email: "antonia.lima@fakemail.com",
      endereco: "Rua Sete de Setembro, 12 - Centro", tipo_aposentadoria: "Aposentadoria por invalidez",
      informacoes: "Cliente fictício para testes do sistema", senha_gov: "", senha_serasa: "",
      criado_em: nowIso,
    },
  ];

  const processos = [
    {
      id: newId(), autor: "MARIA APARECIDA SOUZA", reu: "ITAU",
      objeto: "SEGURO CARTAO (fictício)", numero_processo: "5009991-11.2026.8.13.0329",
      data: "2026-07-20", hora: "14:00", andamento: "AC - AUDIÊNCIA DE CONCILIAÇÃO",
      observacoes: "Processo fictício para teste do sistema", responsavel: "",
      atencao: true, finalizado: false, criado_em: nowIso,
      valor_acordo: 0, honorarios_acordo: 0, data_pagamento_acordo: "",
    },
    {
      id: newId(), autor: "JOAO BATISTA FERREIRA", reu: "BRADESCO",
      objeto: "TARIFA BANCARIA INDEVIDA (fictício)", numero_processo: "5009992-22.2026.8.13.0329",
      data: "", hora: "", andamento: "AGUARDANDO DESPACHO",
      observacoes: "Processo fictício para teste do sistema", responsavel: "",
      atencao: false, finalizado: false, criado_em: nowIso,
    },
    {
      id: newId(), autor: "ANTONIA RIBEIRO LIMA", reu: "SANTANDER",
      objeto: "REVISIONAL DE CONTRATO DE FINANCIAMENTO (fictício)", numero_processo: "5009993-33.2026.8.13.0329",
      data: "2026-08-05", hora: "10:00", andamento: "AIJ - AUDIÊNCIA",
      observacoes: "Processo fictício para teste do sistema", responsavel: "",
      atencao: false, finalizado: false, criado_em: nowIso,
      valor_acordo: 0, honorarios_acordo: 0, data_pagamento_acordo: "",
    },
    {
      id: newId(), autor: "MARIA APARECIDA SOUZA", reu: "C6 BANK",
      objeto: "RMC NAO RECONHECIDO (fictício)", numero_processo: "5009994-44.2026.8.13.0329",
      data: "", hora: "", andamento: "PROVAS",
      observacoes: "Processo fictício para teste do sistema", responsavel: "",
      atencao: false, finalizado: false, criado_em: nowIso,
    },
  ];

  const iniciais = [
    {
      id: newId(), cliente: "ROBERTO CARLOS NUNES", reu: "PAN",
      objeto: "SEGURO PRESTAMISTA NAO CONTRATADO (fictício)",
      andamento: "AGUARDANDO DOCUMENTOS", responsavel: "",
      observacoes: "Lead fictício - aguardando RG e comprovante de residência", criado_em: nowIso,
    },
    {
      id: newId(), cliente: "FERNANDA LIMA COSTA", reu: "AGIBANK",
      objeto: "EMPRESTIMO CONSIGNADO NAO CONTRATADO (fictício)",
      andamento: "CONTRATO ASSINADO - AGUARDANDO PROTOCOLO", responsavel: "",
      observacoes: "Lead fictício - contrato assinado", criado_em: nowIso,
    },
  ];

  const finalizados_externos_sem_honor = [
    {
      cliente: "PEDRO HENRIQUE ALVES", reu: "ITAU", processo: "5009995-55.2025.8.13.0329",
      objeto: "SEGURO CARTAO (fictício)", data_fin: "2026-05-15", motivo: "Desistência",
    },
  ];

  const finalizados_externos_acordos = [
    {
      mes: "Jun/2026", data_pagamento: "2026-06-10", cliente: "MARIA APARECIDA SOUZA",
      reu: "ITAU", objeto: "SEGURO CARTAO (fictício)", valor_acordo: 4500.0, honorarios: 1867.5,
      processo: "5009991-11.2026.8.13.0329", repasse_cliente: 2632.5, status: "pago",
    },
  ];

  const finalizados_execucao = [
    {
      mes: "Mai/2026", data_pagamento: "2026-05-20", cliente: "JOAO BATISTA FERREIRA",
      reu: "BRADESCO", processo: "5009992-22.2026.8.13.0329", objeto: "TARIFA BANCARIA (fictício)",
      valor_execucao: 3200.0, honorarios: 1120.0, repasse_cliente: 2080.0, status: "pago",
      observacoes: "",
    },
  ];

  const controleData = {
    processos, clientes, iniciais,
    finalizados_externos_sem_honor, finalizados_externos_acordos, finalizados_execucao,
    redesignacoes: [],
  };

  await dbSet(`controle_${TENANT_ID}`, controleData);
  console.log(`Dados de Controle Processual fictícios gravados em controle_${TENANT_ID}`);

  // ── 3. Financeiro fictício ───────────────────────────────────────────
  const financeiroData = {
    acordos: [
      {
        id: newId(), mes: "Jun/2026", data_pagamento: "2026-06-10", cliente: "MARIA APARECIDA SOUZA",
        reu: "ITAU", objeto: "SEGURO CARTAO (fictício)", processo: "5009991-11.2026.8.13.0329",
        valor_acordo: 4500.0, honorarios: 1867.5, status: "pago",
      },
      {
        id: newId(), mes: "Jul/2026", data_pagamento: "", cliente: "ANTONIA RIBEIRO LIMA",
        reu: "SANTANDER", objeto: "REVISIONAL DE CONTRATO (fictício)", processo: "5009993-33.2026.8.13.0329",
        valor_acordo: 6000.0, honorarios: 0, status: "pendente",
      },
    ],
    execucoes: [
      {
        id: newId(), mes: "Mai/2026", data_pagamento: "2026-05-20", cliente: "JOAO BATISTA FERREIRA",
        reu: "BRADESCO", processo: "5009992-22.2026.8.13.0329", tipo_execucao: "processo_completo",
        valor_percebido: 3200.0, pct_honorarios: 35, sucumbencia: 0, honorarios: 1120.0,
        repasse_cliente: 2080.0, status: "pago",
      },
    ],
    honorarios_iniciais: [
      {
        id: newId(), mes: "Jun/2026", cliente: "ROBERTO CARLOS NUNES", processo: "",
        valor: 1500.0, data_pagamento: "15/06/2026",
        observacao: "Honorário inicial - contratação (fictício)", status: "pago",
      },
      {
        id: newId(), mes: "Jul/2026", cliente: "FERNANDA LIMA COSTA", processo: "",
        valor: 1200.0, data_pagamento: "", observacao: "Honorário inicial - contratação (fictício)",
        status: "pendente",
      },
    ],
    fixas: {
      "Aluguel": { Jun: 800.0, Jul: 800.0 },
      "Internet": { Jun: 99.9, Jul: 99.9 },
    },
    fixas_quem: { "Aluguel": "individual", "Internet": "individual" },
    fixas_status: {
      "Aluguel": { Jun: "pago", Jul: "pendente" },
      "Internet": { Jun: "pago", Jul: "pago" },
    },
    fixas_valor_fixo: {},
    variaveis: [
      {
        id: newId(), descricao: "Material de escritório (fictício)", valor: 120.0, parcelas: "1x",
        quem: "individual", onde: "Papelaria Teste", status: "pago",
        meses: { Jun: 120.0 }, data_compra: "05/06/2026",
      },
      {
        id: newId(), descricao: "Assinatura de software jurídico (fictício)", valor: 89.9, parcelas: "1x",
        quem: "individual", onde: "Assinatura mensal", status: "pendente",
        meses: { Jul: 89.9 }, data_compra: "01/07/2026",
      },
    ],
    config_escritorio: { tipo: "individual", socios: [] },
  };

  await dbSet(`financeiro_${TENANT_ID}`, financeiroData);
  console.log(`Dados Financeiros fictícios gravados em financeiro_${TENANT_ID}`);

  console.log("\n=== Concluído ===");
  console.log(`Login:  ${DEMO_EMAIL}`);
  console.log(`Senha:  ${DEMO_PASSWORD}`);
  console.log(`Tenant: ${TENANT_ID} (isolado dos dados reais do escritório)`);
}

main().catch(err => {
  console.error("Erro ao rodar seed:", err);
  process.exit(1);
});
