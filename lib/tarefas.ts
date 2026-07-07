import type { Tarefa, StatusTarefa } from "@/lib/controle-data";

export type { Tarefa, StatusTarefa };

async function fetchAPI(path: string, options?: RequestInit) {
  const base = typeof window === "undefined" ? (process.env.NEXTAUTH_URL || "http://localhost:3001") : "";
  const res = await fetch(`${base}/api${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Erro na API");
  }
  return res.json();
}

const J = { headers: { "Content-Type": "application/json" } };

export const COLUNAS: { status: StatusTarefa; label: string }[] = [
  { status: "a_fazer", label: "A Fazer" },
  { status: "fazendo", label: "Fazendo" },
  { status: "concluido", label: "Concluído" },
];

export const getTarefas = () => fetchAPI("/tarefas") as Promise<Tarefa[]>;
export const createTarefa = (t: Omit<Tarefa, "id" | "criado_em">) =>
  fetchAPI("/tarefas", { method: "POST", ...J, body: JSON.stringify(t) }) as Promise<Tarefa>;
export const updateTarefa = (id: string, t: Partial<Tarefa>) =>
  fetchAPI(`/tarefas/${id}`, { method: "PUT", ...J, body: JSON.stringify(t) }) as Promise<Tarefa>;
export const deleteTarefa = (id: string) =>
  fetchAPI(`/tarefas/${id}`, { method: "DELETE" });
