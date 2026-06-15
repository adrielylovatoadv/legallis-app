import fs from "fs";
import path from "path";
import { dbGet, dbSet, dbInit, hasDb } from "./db";

const DATA_FILE = path.join(process.cwd(), "data", "controle_data.json");
const TMP_CONTROLE = "/tmp/legallis_controle.json";
const DB_KEY_PREFIX = "controle";

export interface Processo {
  id: string; autor: string; reu: string; objeto: string;
  numero_processo: string; data: string; hora: string;
  andamento: string; responsavel: string; observacoes: string;
  atencao: boolean; finalizado: boolean; criado_em: string;
  dashboard_ok?: boolean;
}

export interface Cliente {
  id: string; nome: string; telefone: string; cpf: string;
  email: string; endereco: string; tipo_aposentadoria: string;
  informacoes: string; senha_gov: string; senha_serasa: string; criado_em: string;
}

export interface Inicial {
  id: string; cliente: string; reu: string; objeto: string;
  andamento: string; responsavel: string; observacoes: string; criado_em: string;
}

interface ControleData {
  processos: Processo[];
  clientes: Cliente[];
  iniciais: Inicial[];
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
        tipo_aposentadoria: "", informacoes: "", senha_gov: "", senha_serasa: "" },
      ...c,
    })),
    iniciais: (d.iniciais || []).map((i: Inicial) => ({
      ...{ reu: "", objeto: "", responsavel: "", observacoes: "" },
      ...i,
    })),
  };
}

function emptyData(): ControleData {
  return { processos: [], clientes: [], iniciais: [] };
}

function readFromFile(): ControleData {
  const file = fs.existsSync(TMP_CONTROLE) ? TMP_CONTROLE : DATA_FILE;
  if (!fs.existsSync(file)) return emptyData();
  return parseRaw(JSON.parse(fs.readFileSync(file, "utf-8")));
}

export async function getDataAsync(tenantId = "default"): Promise<ControleData> {
  const key = `${DB_KEY_PREFIX}_${tenantId}`;
  if (hasDb()) {
    await dbInit();
    const d = await dbGet<Partial<ControleData>>(key);
    if (d) return parseRaw(d);
    const fromFile = readFromFile();
    await dbSet(key, fromFile);
    return fromFile;
  }
  return readFromFile();
}

export async function saveDataAsync(data: ControleData, tenantId = "default"): Promise<void> {
  const key = `${DB_KEY_PREFIX}_${tenantId}`;
  if (hasDb()) {
    const ok = await dbSet(key, data);
    if (!ok) console.error(`[controle] FALHA ao salvar no banco: chave=${key}`);
    return;
  }
  const content = JSON.stringify(data, null, 2);
  try { fs.writeFileSync(DATA_FILE, content, "utf-8"); }
  catch { fs.writeFileSync(TMP_CONTROLE, content, "utf-8"); }
}

// Legacy sync API
export function getData(): ControleData {
  return readFromFile();
}

export function saveData(data: ControleData) {
  const content = JSON.stringify(data, null, 2);
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
