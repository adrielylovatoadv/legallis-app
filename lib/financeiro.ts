import { fetchAPI, fmtBRL } from "./api";

export { fmtBRL };

export const MESES = [
  "Out/2025","Nov/2025","Dez/2025",
  "Jan/2026","Fev/2026","Mar/2026","Abr/2026","Mai/2026","Jun/2026",
  "Jul/2026","Ago/2026","Set/2026","Out/2026","Nov/2026","Dez/2026",
  "Jan/2027","Fev/2027","Mar/2027","Abr/2027","Mai/2027","Jun/2027",
  "Jul/2027","Ago/2027","Set/2027","Out/2027","Nov/2027","Dez/2027",
];

export const COL_TO_MES: Record<string, string> = {
  "Out":"Out/2025","Nov":"Nov/2025","Dez":"Dez/2025",
  "Jan":"Jan/2026","Fev":"Fev/2026","Mar":"Mar/2026","Abr":"Abr/2026",
  "Mai":"Mai/2026","Jun":"Jun/2026","Jul":"Jul/2026","Ago":"Ago/2026",
  "Set":"Set/2026","Out2":"Out/2026","Nov2":"Nov/2026","Dez2":"Dez/2026",
};

export const COLS = ["Out","Nov","Dez","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out2","Nov2","Dez2"];

export type Status = "pago" | "pendente" | "repasse";

export interface Acordo {
  id: string; mes: string; data_pagamento: string;
  cliente: string; reu: string; objeto: string; processo: string;
  valor_acordo: number; honorarios: number; status: Status;
}
export interface Execucao {
  id: string; mes: string; data_pagamento: string;
  cliente: string; reu: string; processo: string;
  valor_percebido: number; sucumbencia: number; honorarios: number; status: Status;
}
export interface HonorarioInicial {
  id: string; cliente: string; processo: string;
  valor: number; data_pagamento: string; observacao: string; status: Status;
}
export interface Fixa {
  categoria: string; quem: string;
  valores: Record<string, number>; status: Record<string, string>; total: number;
}
export interface Variavel {
  id: string; descricao: string; valor: number; parcelas: string;
  quem: string; onde: string; status: Status; data_compra: string;
  meses: Record<string, number>;
}
export interface DashFinanceiro {
  total_recebido: number; total_pendente: number;
  total_fixas: number; total_variaveis: number; saldo: number;
  resumo_mes: Array<{ mes: string; honorarios: number; fixas: number; variaveis: number; saldo: number }>;
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
export const updateFixa = (categoria: string, body: { quem: string; valores: Record<string,number> }) =>
  fetchAPI(`${p}/fixas/${encodeURIComponent(categoria)}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ categoria, ...body }) });

export const getVariaveis = () => fetchAPI(`${p}/variaveis`) as Promise<Variavel[]>;
export const createVariavel = (v: Omit<Variavel,"id">) => fetchAPI(`${p}/variaveis`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(v) });
export const updateVariavel = (id: string, v: Partial<Variavel>) => fetchAPI(`${p}/variaveis/${id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(v) });
export const deleteVariavel = (id: string) => fetchAPI(`${p}/variaveis/${id}`, { method:"DELETE" });
export const statusVariavel = (id: string, status: string) => fetchAPI(`${p}/variaveis/${id}/status`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ status }) });

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
