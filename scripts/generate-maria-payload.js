const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const EMAIL = "mariasouzaadv@hotmail.com";
const PASSWORD = "12345678";
const TENANT_ID = "t_maria_teste";
const OUT_DIR = "/private/tmp/claude-501/-Users-adrielylovato/7a08507d-82f5-4afc-a4e6-5cec137d1aeb/scratchpad";

function newId() { return crypto.randomBytes(4).toString("hex"); }

const CLIENTES_NOMES = [
  "Maria Aparecida Souza", "João Batista Ferreira", "Antônia Ribeiro Lima",
  "Roberto Carlos Nunes", "Fernanda Lima Costa", "Pedro Henrique Alves",
  "Sebastiana Gomes Pereira", "Carlos Eduardo Martins", "Lúcia Helena Rocha",
  "Francisco das Chagas Silva", "Marlene Aparecida Dias", "José Aparecido Souza",
];
const BANCOS = ["ITAU", "BRADESCO", "SANTANDER", "BMG", "PAN", "AGIBANK", "C6 BANK", "NUBANK", "CAIXA", "CREFISA"];
const OBJETOS = [
  "RMC NAO RECONHECIDO", "SEGURO PRESTAMISTA NAO CONTRATADO", "TARIFA BANCARIA INDEVIDA",
  "EMPRESTIMO CONSIGNADO NAO CONTRATADO", "REVISIONAL DE CONTRATO DE FINANCIAMENTO",
  "SEGURO CARTAO", "DEBITO DE SEGURO NAO AUTORIZADO", "CARTAO CONSIGNADO NAO SOLICITADO",
  "TARIFA COMUNICACAO DIGITAL", "EMPRESTIMO NAO RECONHECIDO",
];
const ANDAMENTOS_ATIVOS = [
  "AGUARDANDO DESPACHO", "AIJ - AUDIÊNCIA", "AC - AUDIÊNCIA DE CONCILIAÇÃO",
  "PROVAS", "SENTENÇA", "RECURSO", "CUMPRIMENTO DE SENTENÇA",
];
function pick(arr, i) { return arr[i % arr.length]; }
function numeroProcesso(seq) {
  const n = String(9000 + seq).padStart(7, "0");
  const ano = 2025 + (seq % 2);
  const vara = pick(["0329", "0647", "0313"], seq);
  return `5${n.slice(1)}-${String(10 + (seq % 89)).padStart(2, "0")}.${ano}.8.13.${vara}`;
}

function main_data() {
  const nowIso = new Date().toISOString();
  const clientes = CLIENTES_NOMES.map((nome, i) => ({
    id: newId(), nome, telefone: `(35) 9888${i}-${1000 + i * 111}`,
    cpf: `${100 + i}.${100 + i}.${100 + i}-${10 + i}`,
    email: `${nome.split(" ")[0].toLowerCase()}.${nome.split(" ").at(-1).toLowerCase()}@fakemail.com`,
    endereco: `Rua Fictícia ${i + 1}, ${100 + i * 10} - Centro, Poços de Caldas/MG`,
    tipo_aposentadoria: i % 3 === 0 ? "Aposentadoria por idade" : (i % 3 === 1 ? "Aposentadoria por invalidez" : ""),
    informacoes: "Cliente fictício para testes do sistema",
    senha_gov: "", senha_serasa: "", criado_em: nowIso,
  }));

  const processos = [];
  for (let i = 0; i < 22; i++) {
    const cliente = pick(CLIENTES_NOMES, i).toUpperCase();
    const reu = pick(BANCOS, i + 2);
    const objeto = `${pick(OBJETOS, i)} (fictício)`;
    const andamento = pick(ANDAMENTOS_ATIVOS, i);
    const comData = andamento.startsWith("AIJ") || andamento.startsWith("AC");
    processos.push({
      id: newId(), autor: cliente, reu, objeto,
      numero_processo: numeroProcesso(i),
      data: comData ? `2026-0${7 + (i % 3)}-${String(5 + (i % 20)).padStart(2, "0")}` : "",
      hora: comData ? `${9 + (i % 8)}:00` : "",
      andamento, observacoes: "Processo fictício para teste do sistema",
      responsavel: "", atencao: i % 4 === 0, finalizado: false, criado_em: nowIso,
      valor_acordo: 0, honorarios_acordo: 0, data_pagamento_acordo: "",
    });
  }

  const MESES = ["Fev/2026", "Mar/2026", "Abr/2026", "Mai/2026", "Jun/2026", "Jul/2026"];
  const finalizadosComAcordo = [];
  for (let i = 0; i < 6; i++) {
    const cliente = pick(CLIENTES_NOMES, i + 3).toUpperCase();
    const reu = pick(BANCOS, i + 5);
    const objeto = `${pick(OBJETOS, i + 4)} (fictício)`;
    const valor = 2500 + i * 850.5;
    const honorarios = Math.round(valor * 0.35 * 100) / 100;
    const proc = {
      id: newId(), autor: cliente, reu, objeto,
      numero_processo: numeroProcesso(30 + i),
      data: "", hora: "", andamento: "ACORDO",
      observacoes: "Processo fictício finalizado com acordo",
      responsavel: "", atencao: false, finalizado: true, criado_em: nowIso,
      valor_acordo: valor, honorarios_acordo: honorarios,
      data_pagamento_acordo: `2026-0${2 + i}-${String(10 + i * 2).padStart(2, "0")}`,
    };
    processos.push(proc);
    finalizadosComAcordo.push({
      mes: pick(MESES, i), data_pagamento: proc.data_pagamento_acordo,
      cliente, reu, objeto, valor_acordo: valor, honorarios,
      processo: proc.numero_processo,
      repasse_cliente: Math.round((valor - honorarios) * 100) / 100,
      status: i < 4 ? "pago" : "pendente",
    });
  }

  const iniciais = [
    { id: newId(), cliente: "LUCIA HELENA ROCHA", reu: "PAN", objeto: "SEGURO PRESTAMISTA NAO CONTRATADO (fictício)", andamento: "AGUARDANDO DOCUMENTOS", responsavel: "", observacoes: "Lead fictício - aguardando RG e comprovante de residência", criado_em: nowIso },
    { id: newId(), cliente: "CARLOS EDUARDO MARTINS", reu: "AGIBANK", objeto: "EMPRESTIMO CONSIGNADO NAO CONTRATADO (fictício)", andamento: "CONTRATO ASSINADO - AGUARDANDO PROTOCOLO", responsavel: "", observacoes: "Lead fictício - contrato assinado", criado_em: nowIso },
    { id: newId(), cliente: "FRANCISCO DAS CHAGAS SILVA", reu: "SANTANDER", objeto: "REVISIONAL DE CONTRATO (fictício)", andamento: "AGUARDANDO DOCUMENTOS", responsavel: "", observacoes: "Lead fictício - primeira reunião realizada", criado_em: nowIso },
    { id: newId(), cliente: "MARLENE APARECIDA DIAS", reu: "C6 BANK", objeto: "CARTAO CONSIGNADO NAO SOLICITADO (fictício)", andamento: "CONTRATO ASSINADO - AGUARDANDO PROTOCOLO", responsavel: "", observacoes: "Lead fictício", criado_em: nowIso },
  ];

  const finalizados_externos_sem_honor = [
    { cliente: "JOSÉ APARECIDO SOUZA", reu: "ITAU", processo: numeroProcesso(50), objeto: "SEGURO CARTAO (fictício)", data_fin: "2026-04-12", motivo: "Desistência" },
    { cliente: "SEBASTIANA GOMES PEREIRA", reu: "BRADESCO", processo: numeroProcesso(51), objeto: "TARIFA BANCARIA (fictício)", data_fin: "2026-05-02", motivo: "Improcedência" },
  ];

  const finalizados_execucao = [];
  for (let i = 0; i < 4; i++) {
    const cliente = pick(CLIENTES_NOMES, i + 7).toUpperCase();
    const reu = pick(BANCOS, i + 1);
    const valor = 3000 + i * 640;
    const honorarios = Math.round(valor * 0.35 * 100) / 100;
    finalizados_execucao.push({
      mes: pick(MESES, i + 1), data_pagamento: `2026-0${3 + i}-${String(15 + i).padStart(2, "0")}`,
      cliente, reu, processo: numeroProcesso(40 + i), objeto: `${pick(OBJETOS, i + 6)} (fictício)`,
      valor_execucao: valor, honorarios, repasse_cliente: Math.round((valor - honorarios) * 100) / 100,
      status: i < 3 ? "pago" : "pendente", observacoes: "",
    });
  }

  const controleData = {
    processos, clientes, iniciais,
    finalizados_externos_sem_honor,
    finalizados_externos_acordos: finalizadosComAcordo,
    finalizados_execucao, redesignacoes: [],
  };

  const financeiroData = {
    acordos: finalizadosComAcordo.map(a => ({
      id: newId(), mes: a.mes, data_pagamento: a.data_pagamento, cliente: a.cliente,
      reu: a.reu, objeto: a.objeto, processo: a.processo,
      valor_acordo: a.valor_acordo, honorarios: a.honorarios, status: a.status,
    })),
    execucoes: finalizados_execucao.map(e => ({
      id: newId(), mes: e.mes, data_pagamento: e.data_pagamento, cliente: e.cliente,
      reu: e.reu, processo: e.processo, tipo_execucao: "processo_completo",
      valor_percebido: e.valor_execucao, pct_honorarios: 35, sucumbencia: 0,
      honorarios: e.honorarios, repasse_cliente: e.repasse_cliente, status: e.status,
    })),
    honorarios_iniciais: CLIENTES_NOMES.slice(0, 6).map((cliente, i) => ({
      id: newId(), mes: pick(MESES, i), cliente,
      processo: i % 2 === 0 ? numeroProcesso(i) : "",
      valor: 900 + i * 150, data_pagamento: i < 4 ? `${10 + i}/0${(i % 5) + 2}/2026` : "",
      observacao: "Honorário inicial - contratação (fictício)",
      status: i < 4 ? "pago" : "pendente",
    })),
    fixas: {
      "Aluguel": { Fev: 800, Mar: 800, Abr: 800, Mai: 800, Jun: 850, Jul: 850 },
      "Internet": { Fev: 99.9, Mar: 99.9, Abr: 99.9, Mai: 99.9, Jun: 99.9, Jul: 99.9 },
      "Sistema Jurídico (SaaS)": { Fev: 149, Mar: 149, Abr: 149, Mai: 149, Jun: 149, Jul: 149 },
    },
    fixas_quem: { "Aluguel": "individual", "Internet": "individual", "Sistema Jurídico (SaaS)": "individual" },
    fixas_status: {
      "Aluguel": { Fev: "pago", Mar: "pago", Abr: "pago", Mai: "pago", Jun: "pago", Jul: "pendente" },
      "Internet": { Fev: "pago", Mar: "pago", Abr: "pago", Mai: "pago", Jun: "pago", Jul: "pago" },
      "Sistema Jurídico (SaaS)": { Fev: "pago", Mar: "pago", Abr: "pago", Mai: "pago", Jun: "pago", Jul: "pendente" },
    },
    fixas_valor_fixo: {},
    variaveis: [
      { id: newId(), descricao: "Material de escritório (fictício)", valor: 120, parcelas: "1x", quem: "individual", onde: "Papelaria Teste", status: "pago", meses: { Mar: 120 }, data_compra: "05/03/2026" },
      { id: newId(), descricao: "Assinatura de software jurídico (fictício)", valor: 89.9, parcelas: "1x", quem: "individual", onde: "Assinatura mensal", status: "pago", meses: { Abr: 89.9 }, data_compra: "01/04/2026" },
      { id: newId(), descricao: "Curso de atualização (fictício)", valor: 450, parcelas: "3x", quem: "individual", onde: "Curso online", status: "pendente", meses: { Mai: 150, Jun: 150, Jul: 150 }, data_compra: "10/05/2026" },
      { id: newId(), descricao: "Manutenção de notebook (fictício)", valor: 320, parcelas: "1x", quem: "individual", onde: "Assistência técnica", status: "pago", meses: { Jun: 320 }, data_compra: "18/06/2026" },
    ],
    config_escritorio: { tipo: "individual", socios: [] },
  };

  return { controleData, financeiroData };
}

async function main() {
  const { controleData, financeiroData } = main_data();
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);
  const demoUser = {
    id: crypto.randomUUID(),
    name: "Maria Souza",
    email: EMAIL,
    password: hashedPassword,
    role: "admin",
    plan: "profissional",
    avatar: "",
    createdAt: new Date().toISOString(),
    phone: "(35) 99999-1234",
    company: {
      name: "Maria Souza Advocacia (Teste)",
      cnpj: "00.000.000/0001-00",
      address: "Rua Fictícia, 123 - Centro, Poços de Caldas/MG",
    },
    subscriptionStatus: "active",
    theme: "dark",
    isActive: true,
    tenantId: TENANT_ID,
    sexo: "feminino",
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "maria_user.json"), JSON.stringify(demoUser));
  fs.writeFileSync(path.join(OUT_DIR, "maria_controle.json"), JSON.stringify(controleData));
  fs.writeFileSync(path.join(OUT_DIR, "maria_financeiro.json"), JSON.stringify(financeiroData));
  console.log("OK - arquivos gerados em", OUT_DIR);
  console.log("processos:", controleData.processos.length, "clientes:", controleData.clientes.length);
  console.log("tenantId:", TENANT_ID);
}

main();
