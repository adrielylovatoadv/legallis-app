import { fetchAPI } from "./api";

export const ANDAMENTOS_PROCESSO = [
  "AC - AUDIÊNCIA DE CONCILIAÇÃO","ACORDO","AGUARDAR LIMINAR","AGUARDAR SENTENÇA",
  "AGUARDANDO DESPACHO","AIJ - AUDIÊNCIA","ARQUIVADO","CONCLUSO PARA JULGAMENTO",
  "DESISTÊNCIA","EMENDAR","INTERESSE DE AGIR","MANIFESTAÇÃO","MEMORIAIS FINAIS",
  "OUTRO","PERÍCIA","PROVAS","PROVAS - JUNTAR NOTIFICAÇÃO","QUESITOS DE PERÍCIA",
  "RECURSO","RÉPLICA","RÉPLICA SEM INTIMAÇÃO",
];

export const ANDAMENTOS_INICIAL = [
  "FAZER INICIAL","EM ANDAMENTO","AGUARDAR","AGUARDAR DOCS",
  "AGUARDAR CONTRATO","AGUARDAR LIMINAR","ENVIAR NOTIFICAÇÃO",
  "AGUARDAR NOTIFICAÇÃO","ASSINAR PROCURAÇÃO","PROTOCOLADO","ARQUIVADO",
];

export const RESPONSAVEIS = ["", "Adriely", "Eduarda"];

export interface Processo {
  id: string; autor: string; reu: string; objeto: string;
  numero_processo: string; data: string; hora: string;
  andamento: string; responsavel: string; observacoes: string;
  atencao: boolean; finalizado: boolean; criado_em: string;
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

export interface DashboardData {
  prazos_hoje: Processo[]; prazos_3dias: Processo[];
  iniciais_pendentes: Inicial[];
  total_clientes: number; total_processos_ativos: number;
}

// ── API calls ────────────────────────────────────────────────────────────────

export const getDashboard = () => fetchAPI("/controle/dashboard") as Promise<DashboardData>;

export const getProcessos = (params?: Record<string, string>) => {
  const q = params ? "?" + new URLSearchParams(params).toString() : "";
  return fetchAPI(`/controle/processos${q}`) as Promise<Processo[]>;
};
export const createProcesso = (p: Omit<Processo, "id" | "criado_em">) =>
  fetchAPI("/controle/processos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
export const updateProcesso = (id: string, p: Partial<Processo>) =>
  fetchAPI(`/controle/processos/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
export const deleteProcesso = (id: string) =>
  fetchAPI(`/controle/processos/${id}`, { method: "DELETE" });
export const marcarOk = (id: string) =>
  fetchAPI(`/controle/processos/${id}/ok`, { method: "POST" });

export const getClientes = (busca?: string) => {
  const q = busca ? `?busca=${encodeURIComponent(busca)}` : "";
  return fetchAPI(`/controle/clientes${q}`) as Promise<Cliente[]>;
};
export const createCliente = (c: Omit<Cliente, "id" | "criado_em">) =>
  fetchAPI("/controle/clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
export const updateCliente = (id: string, c: Partial<Cliente>) =>
  fetchAPI(`/controle/clientes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
export const deleteCliente = (id: string) =>
  fetchAPI(`/controle/clientes/${id}`, { method: "DELETE" });

export const getIniciais = (params?: Record<string, string>) => {
  const q = params ? "?" + new URLSearchParams(params).toString() : "";
  return fetchAPI(`/controle/iniciais${q}`) as Promise<Inicial[]>;
};
export const createInicial = (i: Omit<Inicial, "id" | "criado_em">) =>
  fetchAPI("/controle/iniciais", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(i) });
export const updateInicial = (id: string, i: Partial<Inicial>) =>
  fetchAPI(`/controle/iniciais/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(i) });
export const deleteInicial = (id: string) =>
  fetchAPI(`/controle/iniciais/${id}`, { method: "DELETE" });

// ── helpers ───────────────────────────────────────────────────────────────────

export function corAndamento(status: string): string {
  const s = (status || "").toUpperCase();
  if (s.includes("AUDIÊNCIA") || s.includes("AIJ")) return "text-red-400";
  if (s.includes("RÉPLICA") || s.includes("REPLICA")) return "text-orange-400";
  if (s.includes("PROVAS")) return "text-blue-400";
  if (s.includes("SENTENÇA") || s.includes("SENTENCA")) return "text-green-400";
  if (s.includes("EMENDAR") || s.includes("LIMINAR")) return "text-yellow-400";
  if (s.includes("FAZER INICIAL")) return "text-purple-400";
  if (s.includes("ARQUIVADO")) return "text-gray-500";
  if (s.includes("DESISTÊNCIA") || s.includes("DESISTENCIA")) return "text-gray-400";
  return "text-[var(--text2)]";
}

export function badgeAndamento(status: string): string {
  const s = (status || "").toUpperCase();
  if (s.includes("AUDIÊNCIA") || s.includes("AIJ")) return "bg-red-500/15 text-red-400";
  if (s.includes("PROVAS")) return "bg-blue-500/15 text-blue-400";
  if (s.includes("SENTENÇA") || s.includes("SENTENCA")) return "bg-green-500/15 text-green-400";
  if (s.includes("EMENDAR") || s.includes("LIMINAR")) return "bg-yellow-500/15 text-yellow-400";
  if (s.includes("ACORDO")) return "bg-emerald-500/15 text-emerald-400";
  if (s.includes("ARQUIVADO") || s.includes("DESISTÊNCIA")) return "bg-gray-500/15 text-gray-400";
  return "bg-[var(--surface2)] text-[var(--text2)]";
}

export function fmtData(iso: string): string {
  if (!iso || iso.length < 10) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function gcalUrl(p: Processo): string | null {
  const s = (p.andamento || "").toUpperCase();
  if (!s.includes("AIJ") && !s.startsWith("AC")) return null;
  if (!p.data) return null;
  const [y, mo, d] = p.data.split("-").map(Number);
  const [h, min] = (p.hora || "08:00").split(":").map(Number);
  const fmt = (n: number) => String(n).padStart(2, "0");
  const start = `${y}${fmt(mo)}${fmt(d)}T${fmt(h)}${fmt(min)}00`;
  const endMin = min + 30 >= 60 ? min + 30 - 60 : min + 30;
  const endH = min + 30 >= 60 ? h + 1 : h;
  const end = `${y}${fmt(mo)}${fmt(d)}T${fmt(endH)}${fmt(endMin)}00`;
  const tipo = s.includes("AIJ") ? "AIJ" : "AC";
  const titulo = `${tipo} ${p.autor} ${p.numero_processo}`.trim();
  const detalhe = `Processo: ${p.numero_processo} | ${p.autor} × ${p.reu} | ${p.objeto}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${start}/${end}&details=${encodeURIComponent(detalhe)}`;
}
