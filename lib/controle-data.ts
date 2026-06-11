import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "controle_data.json");

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

export function getData(): ControleData {
  if (!fs.existsSync(DATA_FILE)) return { processos: [], clientes: [], iniciais: [] };
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  const d = JSON.parse(raw);
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

export function saveData(data: ControleData) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
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
