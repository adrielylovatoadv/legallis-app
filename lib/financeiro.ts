async function fetchAPI(path: string, options?: RequestInit) {
  const base = typeof window === "undefined" ? (process.env.NEXTAUTH_URL || "http://localhost:3001") : "";
  const res = await fetch(`${base}/api${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Erro na API");
  }
  return res.json();
}

export const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Calendário do módulo financeiro, gerado a partir de hoje — nunca mais precisa de extensão
// manual. Época fixa: Out/2025 (mês 0, quando o escritório começou a usar o sistema). Horizonte:
// sempre até dezembro de (ano atual + 2), recalculado a cada carregamento do módulo (cada deploy/
// cold start já garante ~2 anos de folga à frente da data real). Ver mesma lógica em financeiro-data.ts.
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

// COLS usa o esquema legado de tokens curtos (Out,Nov,Dez,...,Set, depois Out2,Nov2,Dez2,...,Set2,
// Out3,...) para não invalidar dados já gravados com esses nomes. O sufixo é o número do ciclo
// Out→Set desde a época — cresce sozinho, nunca fica sem token daqui pra frente.
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
export interface Timesheet {
  id: string; processoId?: string; processo?: string; cliente?: string;
  data: string; minutos: number; descricao: string; responsavel: string;
  faturavel: boolean; valor_hora?: number; status: Status;
}
export interface ProcessoFinanceiro {
  acordos: Acordo[]; execucoes: Execucao[];
  honorarios_iniciais: HonorarioInicial[]; timesheets: Timesheet[];
}
export interface Fixa {
  categoria: string; quem: string;
  valores: Record<string, number>; status: Record<string, string>;
  valor_fixo: number; total: number;
}
export interface Variavel {
  id: string; descricao: string; valor: number; parcelas: string;
  quem: string; onde: string; status: Status; data_compra: string;
  meses: Record<string, number>;
}
export interface DashFinanceiro {
  total_recebido: number; total_pendente: number;
  total_fixas: number; total_variaveis: number; saldo: number;
  resumo_mes: Array<{ mes: string; honorarios: number; honorarios_pendente?: number; fixas: number; variaveis: number; saldo: number }>;
  pendentes: Array<{ tipo: string; cliente: string; mes: string; valor: number; processo?: string; observacao?: string }>;
}

// ── API ───────────────────────────────────────────────────────────────────────
const p = "/financeiro";
export const getDash = () => fetchAPI(`${p}/dashboard`) as Promise<DashFinanceiro>;

export const getAcordos = () => fetchAPI(`${p}/acordos`) as Promise<Acordo[]>;
export const createAcordo = (a: Omit<Acordo,"id"|"honorarios">) => fetchAPI(`${p}/acordos`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(a) });
export const updateAcordo = (id: string, a: Partial<Acordo>) => fetchAPI(`${p}/acordos/${id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(a) });
export const deleteAcordo = (id: string) => fetchAPI(`${p}/acordos/${id}`, { method:"DELETE" });
export const statusAcordo = (id: string, status: string) => fetchAPI(`${p}/acordos/${id}/status`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ status }) });

export const getExecucoes = () => fetchAPI(`${p}/execucoes`) as Promise<Execucao[]>;
export const createExecucao = (e: Omit<Execucao,"id"|"honorarios">) => fetchAPI(`${p}/execucoes`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(e) });
export const updateExecucao = (id: string, e: Partial<Execucao>) => fetchAPI(`${p}/execucoes/${id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(e) });
export const deleteExecucao = (id: string) => fetchAPI(`${p}/execucoes/${id}`, { method:"DELETE" });
export const statusExecucao = (id: string, status: string) => fetchAPI(`${p}/execucoes/${id}/status`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ status }) });

export const getHonIniciais = () => fetchAPI(`${p}/honorarios-iniciais`) as Promise<HonorarioInicial[]>;
export const createHonInicial = (h: Omit<HonorarioInicial,"id">) => fetchAPI(`${p}/honorarios-iniciais`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(h) });
export const updateHonInicial = (id: string, h: Partial<HonorarioInicial>) => fetchAPI(`${p}/honorarios-iniciais/${id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(h) });
export const deleteHonInicial = (id: string) => fetchAPI(`${p}/honorarios-iniciais/${id}`, { method:"DELETE" });
export const statusHonInicial = (id: string, status: string) => fetchAPI(`${p}/honorarios-iniciais/${id}/status`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ status }) });

export const getFixas = () => fetchAPI(`${p}/fixas`) as Promise<Fixa[]>;
export const createFixa = (body: { categoria: string; quem: string; valores: Record<string,number>; valor_fixo?: number }) =>
  fetchAPI(`${p}/fixas`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
export const updateFixa = (categoria: string, body: { quem?: string; valores?: Record<string,number>; nova_categoria?: string; valor_fixo?: number }) =>
  fetchAPI(`${p}/fixas/${encodeURIComponent(categoria)}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
export const deleteFixa = (categoria: string) =>
  fetchAPI(`${p}/fixas/${encodeURIComponent(categoria)}`, { method:"DELETE" });
export const statusFixaMes = (categoria: string, col: string, status: string) =>
  fetchAPI(`${p}/fixas/${encodeURIComponent(categoria)}/status`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ col, status }) });

export const getTimesheets = () => fetchAPI(`${p}/timesheet`) as Promise<Timesheet[]>;
export const createTimesheet = (t: Omit<Timesheet,"id">) => fetchAPI(`${p}/timesheet`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(t) });
export const updateTimesheet = (id: string, t: Partial<Timesheet>) => fetchAPI(`${p}/timesheet/${id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(t) });
export const deleteTimesheet = (id: string) => fetchAPI(`${p}/timesheet/${id}`, { method:"DELETE" });

export const getProcessoFinanceiro = (processoId: string) =>
  fetchAPI(`/controle/processos/${processoId}/financeiro`) as Promise<ProcessoFinanceiro>;
export const getFinanceiroPorNumero = (numero: string) =>
  fetchAPI(`${p}/por-numero?numero=${encodeURIComponent(numero)}`) as Promise<ProcessoFinanceiro>;

export const getVariaveis = () => fetchAPI(`${p}/variaveis`) as Promise<Variavel[]>;
export const createVariavel = (v: Omit<Variavel,"id">) => fetchAPI(`${p}/variaveis`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(v) });
export const updateVariavel = (id: string, v: Partial<Variavel>) => fetchAPI(`${p}/variaveis/${id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(v) });
export const deleteVariavel = (id: string) => fetchAPI(`${p}/variaveis/${id}`, { method:"DELETE" });
export const statusVariavel = (id: string, status: string) => fetchAPI(`${p}/variaveis/${id}/status`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ status }) });

export interface Socio { id: string; nome: string; percentual: number; }
export interface ConfigEscritorio { tipo: "individual" | "socios"; socios: Socio[]; }

export const getConfig = () => fetchAPI(`${p}/config`) as Promise<ConfigEscritorio>;
export const saveConfig = (c: ConfigEscritorio) => fetchAPI(`${p}/config`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(c) });

// ── helpers ───────────────────────────────────────────────────────────────────
export const NEXT_STATUS: Record<string, Status> = {
  pago: "repasse", repasse: "pendente", pendente: "pago",
};
export const NEXT_STATUS2: Record<string, Status> = {
  pago: "pendente", pendente: "pago",
};

export function statusBadge(s: string) {
  if (s === "pago")     return "bg-green-500/15 text-green-400";
  if (s === "repasse")  return "bg-yellow-500/15 text-yellow-400";
  return "bg-red-500/15 text-red-400";
}
export function statusLabel(s: string) {
  if (s === "pago")    return "🟢 Recebido";
  if (s === "repasse") return "🟡 Repasse pendente";
  return "🔴 Não recebido";
}
