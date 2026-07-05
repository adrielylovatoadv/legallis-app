import fs from "fs";
import path from "path";
import { dbGet, dbSet, dbInit, hasDb } from "./db";
import { encryptField, decryptField } from "./crypto";

const DATA_FILE = path.join(process.cwd(), "data", "controle_data.json");
const TMP_CONTROLE = "/tmp/legallis_controle.json";
const DB_KEY_PREFIX = "controle";

export interface Processo {
  id: string; autor: string; reu: string; objeto: string;
  numero_processo: string; data: string; hora: string;
  andamento: string; responsavel: string; observacoes: string;
  atencao: boolean; finalizado: boolean; criado_em: string;
  dashboard_ok?: boolean; vara?: string; tribunal?: string;
}

export interface Cliente {
  id: string; nome: string; telefone: string; cpf: string;
  email: string; endereco: string; tipo_aposentadoria: string;
  informacoes: string; senha_gov: string; senha_serasa: string; criado_em: string;
  tipo_pessoa?: "fisica" | "juridica"; cnpj?: string; tratamento?: string;
  etiquetas?: string[]; telefones_adicionais?: string[]; emails_adicionais?: string[];
  rg?: string; profissao?: string; estado_civil?: string; nacionalidade?: string;
  banco?: string; agencia?: string; conta?: string; tipo_conta?: "corrente" | "poupanca"; chave_pix?: string;
}

export interface Inicial {
  id: string; cliente: string; reu: string; objeto: string;
  andamento: string; responsavel: string; observacoes: string; criado_em: string;
  data?: string; hora?: string;
  numero_processo?: string;
  protocolo?: { numero_processo: string; data_protocolo: string; observacoes: string; registrado_por: string; registrado_em: string };
}

export interface FinalizadoSemHonor {
  id?: string; cliente: string; reu: string; processo: string; objeto: string;
  data_fin: string; motivo: string;
}

export interface FinalizadoAcordo {
  mes: string; data_pagamento: string; cliente: string; reu: string;
  objeto: string; valor_acordo: number; honorarios: number; status: string;
  processo: string; repasse_cliente: number;
}

export interface FinalizadoExecucao {
  mes: string; data_pagamento: string; cliente: string; reu: string;
  processo: string; objeto: string; valor_execucao: number;
  honorarios: number; repasse_cliente: number; status: string; observacoes?: string;
}

export type StatusRedesignacao = "pendente" | "aceita" | "recusada";

export interface Redesignacao {
  id: string;
  tipo: "processo" | "inicial";
  itemId: string;
  label: string;
  deUserId: string;
  deUserName: string;
  paraUserId: string;
  paraUserName: string;
  motivo: string;
  status: StatusRedesignacao;
  criado_em: string;
  respondido_em?: string;
}

export interface ControleData {
  processos: Processo[];
  clientes: Cliente[];
  iniciais: Inicial[];
  finalizados_externos_sem_honor: FinalizadoSemHonor[];
  finalizados_externos_acordos: FinalizadoAcordo[];
  finalizados_execucao: FinalizadoExecucao[];
  redesignacoes: Redesignacao[];
}

function parseRaw(d: Partial<ControleData>): ControleData {
  return {
    processos: (d.processos || []).map((p: Processo) => ({
      ...{ atencao: false, finalizado: false, hora: "", responsavel: "",
        observacoes: "", objeto: "", reu: "", numero_processo: "", data: "" },
      ...p,
    })),
    clientes: (d.clientes || []).map((c: Cliente) => ({
      ...{ telefone: "", cpf: "", email: "", endereco: "",
        tipo_aposentadoria: "", informacoes: "", senha_gov: "", senha_serasa: "",
        tipo_pessoa: "fisica" as const, cnpj: "", tratamento: "",
        etiquetas: [], telefones_adicionais: [], emails_adicionais: [],
        rg: "", profissao: "", estado_civil: "", nacionalidade: "brasileiro(a)",
        banco: "", agencia: "", conta: "", tipo_conta: "corrente" as const, chave_pix: "" },
      ...c,
      senha_gov: decryptField(c.senha_gov || ""),
      senha_serasa: decryptField(c.senha_serasa || ""),
      conta: decryptField(c.conta || ""),
      chave_pix: decryptField(c.chave_pix || ""),
    })),
    iniciais: (d.iniciais || []).map((i: Inicial) => ({
      ...{ reu: "", objeto: "", responsavel: "", observacoes: "", data: "", hora: "" },
      ...i,
    })),
    // Backfill de id por índice para registros antigos sem id (mesma técnica já usada em
    // lib/financeiro-data.ts para acordos/execucoes/honorarios_iniciais).
    finalizados_externos_sem_honor: (d.finalizados_externos_sem_honor || []).map((f, i) => ({ ...f, id: f.id || String(i) })),
    finalizados_externos_acordos: d.finalizados_externos_acordos || [],
    finalizados_execucao: (d as ControleData).finalizados_execucao || [],
    redesignacoes: (d as ControleData).redesignacoes || [],
  };
}

function emptyData(): ControleData {
  return { processos: [], clientes: [], iniciais: [], finalizados_externos_sem_honor: [], finalizados_externos_acordos: [], finalizados_execucao: [], redesignacoes: [] };
}

// Legado: tenant "t_1" é o dono original dos dados no arquivo sem sufixo (pré multi-tenant).
// Qualquer outro tenant usa um arquivo próprio, para não vazar dados entre escritórios
// quando o app roda localmente sem POSTGRES_URL configurado.
function fileForTenant(tenantId: string): { main: string; tmp: string } {
  if (tenantId === "t_1" || tenantId === "default") return { main: DATA_FILE, tmp: TMP_CONTROLE };
  return {
    main: path.join(process.cwd(), "data", `controle_data_${tenantId}.json`),
    tmp: `/tmp/legallis_controle_${tenantId}.json`,
  };
}

function readFromFile(tenantId: string): ControleData {
  const { main, tmp } = fileForTenant(tenantId);
  const file = fs.existsSync(tmp) ? tmp : main;
  if (!fs.existsSync(file)) return emptyData();
  return parseRaw(JSON.parse(fs.readFileSync(file, "utf-8")));
}

function encryptClientes(data: ControleData): ControleData {
  return {
    ...data,
    clientes: data.clientes.map(c => ({
      ...c,
      senha_gov: encryptField(c.senha_gov || ""),
      senha_serasa: encryptField(c.senha_serasa || ""),
      conta: encryptField(c.conta || ""),
      chave_pix: encryptField(c.chave_pix || ""),
    })),
  };
}

export async function getDataAsync(tenantId = "default"): Promise<ControleData> {
  const key = `${DB_KEY_PREFIX}_${tenantId}`;
  if (hasDb()) {
    await dbInit();
    const d = await dbGet<Partial<ControleData>>(key);
    if (d) return parseRaw(d);
    // Primeira vez: semeia com dados vazios (não sobrescreve com arquivo do build)
    const empty = emptyData();
    await dbSet(key, empty);
    return empty;
  }
  return readFromFile(tenantId);
}

export async function saveDataAsync(data: ControleData, tenantId = "default"): Promise<void> {
  const key = `${DB_KEY_PREFIX}_${tenantId}`;
  const encrypted = encryptClientes(data);
  if (hasDb()) {
    const ok = await dbSet(key, encrypted);
    if (!ok) throw new Error(`Falha ao salvar dados de controle no banco: chave=${key}`);
    return;
  }
  const { main, tmp } = fileForTenant(tenantId);
  const content = JSON.stringify(encrypted, null, 2);
  try { fs.writeFileSync(main, content, "utf-8"); }
  catch { fs.writeFileSync(tmp, content, "utf-8"); }
}

// Legacy sync API
export function getData(): ControleData {
  return readFromFile("t_1");
}

export function saveData(data: ControleData) {
  const encrypted = encryptClientes(data);
  const content = JSON.stringify(encrypted, null, 2);
  try { fs.writeFileSync(DATA_FILE, content, "utf-8"); }
  catch { fs.writeFileSync(TMP_CONTROLE, content, "utf-8"); }
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function isFinalizado(p: Processo): boolean {
  if (p.finalizado) return true;
  const a = (p.andamento || "").toUpperCase();
  return a === "ACORDO" || a === "ARQUIVADO" || a === "DESISTÊNCIA" || a === "DESISTENCIA";
}

export function normNome(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}
