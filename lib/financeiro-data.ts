import fs from "fs";
import path from "path";
import { dbGet, dbSet, dbInit, hasDb } from "./db";

const ORIGINAL_FILE = path.join(process.cwd(), "data", "financeiro_data.json");
const TMP_FILE = "/tmp/legallis_financeiro.json";
const DB_KEY_PREFIX = "financeiro";

// Legado: tenant "t_1" é o dono original dos dados no arquivo sem sufixo (pré multi-tenant).
// Qualquer outro tenant usa um arquivo próprio, para não vazar dados entre escritórios
// quando o app roda localmente sem POSTGRES_URL configurado.
function fileForTenant(tenantId: string): { main: string; tmp: string } {
  if (tenantId === "t_1" || tenantId === "default") return { main: ORIGINAL_FILE, tmp: TMP_FILE };
  return {
    main: path.join(process.cwd(), "data", `financeiro_data_${tenantId}.json`),
    tmp: `/tmp/legallis_financeiro_${tenantId}.json`,
  };
}

// Calendário do módulo financeiro, gerado a partir de hoje — nunca mais precisa de extensão
// manual. Época fixa: Out/2025 (mês 0, quando o escritório começou a usar o sistema). Horizonte:
// sempre até dezembro de (ano atual + 2), recalculado a cada carregamento do módulo (cada deploy/
// cold start já garante ~2 anos de folga à frente da data real). Mesma lógica duplicada em
// lib/financeiro.ts (versão client-side) — ver comentário lá para detalhes do esquema de tokens.
const MES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const EPOCH_ABS = 2025 * 12 + 9; // Out/2025

function horizonteAbsMax(): number {
  const now = new Date();
  return (now.getFullYear() + 2) * 12 + 11; // Dez do ano atual + 2
}

function gerarMeses(): string[] {
  const out: string[] = [];
  for (let abs = EPOCH_ABS; abs <= horizonteAbsMax(); abs++) {
    out.push(`${MES_ABREV[abs % 12]}/${Math.floor(abs / 12)}`);
  }
  return out;
}

function gerarColsEMapa(): { cols: string[]; colToMes: Record<string, string> } {
  const cols: string[] = [];
  const colToMes: Record<string, string> = {};
  const max = horizonteAbsMax();
  for (let abs = EPOCH_ABS; abs <= max; abs++) {
    const ciclo = Math.floor((abs - EPOCH_ABS) / 12);
    const sufixo = ciclo === 0 ? "" : String(ciclo + 1);
    const col = `${MES_ABREV[abs % 12]}${sufixo}`;
    cols.push(col);
    colToMes[col] = `${MES_ABREV[abs % 12]}/${Math.floor(abs / 12)}`;
  }
  return { cols, colToMes };
}

export const MESES = gerarMeses();
const _colsGerados = gerarColsEMapa();
export const COL_TO_MES: Record<string, string> = _colsGerados.colToMes;
export const COLS = _colsGerados.cols;

// Índice (em COLS) do mês corrente — mesma fórmula de getColIndex() em app/dashboard/financeiro/_shared.tsx
// (client-only), usado aqui para limitar totais "até hoje" e não somar meses futuros ainda não incorridos.
export function getCurrentColIndex(): number {
  const now = new Date();
  return now.getFullYear() * 12 + now.getMonth() - EPOCH_ABS;
}

export type Status = "pago" | "pendente" | "repasse";

export interface Acordo {
  id: string; mes: string; data_pagamento: string;
  cliente: string; reu: string; objeto: string; processo: string;
  valor_acordo: number; pct_honorarios?: number; honorarios: number; status: Status;
  processoId?: string; criado_em?: string;
}
export type TipoExecucao = "processo_completo" | "honorarios_somente";

export interface Execucao {
  id: string; mes: string; data_pagamento: string;
  cliente: string; reu: string; processo: string;
  tipo_execucao?: TipoExecucao;
  valor_percebido: number; pct_honorarios?: number; pct_sucumbencia?: number; sucumbencia: number;
  honorarios: number; repasse_cliente?: number; status: Status;
  processoId?: string;
}
export interface HonorarioInicial {
  id: string; mes?: string; cliente: string; processo: string;
  valor: number; data_pagamento: string; observacao: string; status: Status;
  processoId?: string;
}
export interface Variavel {
  id: string; descricao: string; valor: number; parcelas: string;
  quem: string; onde: string; status: Status; data_compra: string;
  meses: Record<string, number>;
}

// Horas cobráveis lançadas contra um processo (vinculado por processoId).
export interface Timesheet {
  id: string; processoId?: string; processo?: string; cliente?: string;
  data: string; minutos: number; descricao: string; responsavel: string;
  faturavel: boolean; valor_hora?: number; status: Status;
}

export interface Socio {
  id: string; nome: string; percentual: number;
}

export interface ConfigEscritorio {
  tipo: "individual" | "socios";
  socios: Socio[];
}

export interface FinanceiroData {
  acordos: Acordo[];
  execucoes: Execucao[];
  honorarios_iniciais: HonorarioInicial[];
  fixas: Record<string, Record<string, number>>;
  fixas_quem: Record<string, string>;
  fixas_status: Record<string, Record<string, string>>;
  fixas_valor_fixo: Record<string, number>; // valor mensal fixo (aplica em todos os meses)
  variaveis: Variavel[];
  timesheets: Timesheet[];
  config_escritorio?: ConfigEscritorio;
}

function parseRaw(d: Partial<FinanceiroData>): FinanceiroData {
  return {
    acordos: (d.acordos || []).map((a, i) => Object.assign({ objeto: "", reu: "", processo: "", data_pagamento: "", status: "pago" as Status, id: String(i) }, a) as Acordo),
    execucoes: (d.execucoes || []).map((e, i) => Object.assign({ data_pagamento: "", reu: "", processo: "", sucumbencia: 0, status: "pago" as Status, id: String(i) }, e) as Execucao),
    honorarios_iniciais: (d.honorarios_iniciais || []).map((h, i) => Object.assign({ processo: "", data_pagamento: "", observacao: "", status: "pago" as Status, mes: "", id: String(i) }, h) as HonorarioInicial),
    fixas: d.fixas || {},
    fixas_valor_fixo: d.fixas_valor_fixo || {},
    fixas_quem: d.fixas_quem || {},
    fixas_status: d.fixas_status || {},
    variaveis: (d.variaveis || []).map((v, i) => Object.assign({ parcelas: "1x", quem: "dividido", onde: "", data_compra: "", status: "pendente" as Status, meses: {}, id: String(i) }, v) as Variavel),
    timesheets: (d.timesheets || []).map((t, i) => Object.assign({ processo: "", cliente: "", descricao: "", faturavel: true, status: "pendente" as Status, id: String(i) }, t) as Timesheet),
    config_escritorio: d.config_escritorio,
  };
}

function emptyData(): FinanceiroData {
  return { acordos: [], execucoes: [], honorarios_iniciais: [], fixas: {}, fixas_quem: {}, fixas_status: {}, fixas_valor_fixo: {}, variaveis: [], timesheets: [] };
}

function readFromFile(tenantId: string): FinanceiroData {
  const { main, tmp } = fileForTenant(tenantId);
  const file = fs.existsSync(tmp) ? tmp : main;
  if (!fs.existsSync(file)) return emptyData();
  const d = JSON.parse(fs.readFileSync(file, "utf-8")) as Partial<FinanceiroData>;
  return parseRaw(d);
}

export async function getDataAsync(tenantId = "default"): Promise<FinanceiroData> {
  const key = `${DB_KEY_PREFIX}_${tenantId}`;
  if (hasDb()) {
    await dbInit();
    const d = await dbGet<Partial<FinanceiroData>>(key);
    if (d) return parseRaw(d);
    // Primeira vez: semeia com dados vazios (não sobrescreve com arquivo do build)
    const empty = emptyData();
    await dbSet(key, empty);
    return empty;
  }
  return readFromFile(tenantId);
}

export async function saveDataAsync(data: FinanceiroData, tenantId = "default"): Promise<void> {
  const key = `${DB_KEY_PREFIX}_${tenantId}`;
  if (hasDb()) {
    const ok = await dbSet(key, data);
    if (!ok) throw new Error(`Falha ao salvar dados financeiros no banco: chave=${key}`);
    return;
  }
  const { main, tmp } = fileForTenant(tenantId);
  const content = JSON.stringify(data, null, 2);
  try { fs.writeFileSync(main, content, "utf-8"); }
  catch { fs.writeFileSync(tmp, content, "utf-8"); }
}

// Legacy sync API (file-only, used only when DB not available)
export function getData(): FinanceiroData {
  return readFromFile("t_1");
}

export function saveData(data: FinanceiroData) {
  const content = JSON.stringify(data, null, 2);
  try { fs.writeFileSync(ORIGINAL_FILE, content, "utf-8"); }
  catch { fs.writeFileSync(TMP_FILE, content, "utf-8"); }
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export const PCT_ACORDO_PADRAO = 41.5;

export function calcAcordo(valor: number, pct?: number): number {
  return Math.round(valor * ((pct ?? PCT_ACORDO_PADRAO) / 100) * 100) / 100;
}

// Sucumbência é arbitrada pelo juiz em % — calculada sobre o valor total percebido na execução.
export function calcSucumbencia(percebido: number, pctSucumbencia?: number): number {
  return Math.round(percebido * ((pctSucumbencia ?? 0) / 100) * 100) / 100;
}

export function calcExecucao(
  percebido: number,
  sucumbencia: number,
  tipo?: TipoExecucao,
  pct?: number
): number {
  if (tipo === "honorarios_somente") {
    // percebido já é o honorário bruto
    return Math.round((percebido + sucumbencia) * 100) / 100;
  }
  // processo_completo (padrão): pct% do percebido (valor cheio) + sucumbência por cima
  const pctUsado = (pct ?? 35) / 100;
  return Math.round((percebido * pctUsado + sucumbencia) * 100) / 100;
}

// Repasse ao cliente = a parte do valor percebido que não é honorário contratual.
// A sucumbência não entra aqui: é paga pela parte perdedora além do valor percebido, não sai da cota do cliente.
export function calcRepasseExecucao(percebido: number, pct?: number): number {
  const pctUsado = (pct ?? 35) / 100;
  return Math.round(percebido * (1 - pctUsado) * 100) / 100;
}
