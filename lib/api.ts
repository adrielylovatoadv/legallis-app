export async function fetchAPI(path: string, options?: RequestInit) {
  // Rotas internas Next.js em /api — funciona em client e server
  const base = typeof window === "undefined"
    ? (process.env.NEXTAUTH_URL || "http://localhost:3001")
    : "";
  const res = await fetch(`${base}/api${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || err.error || "Erro na API");
  }
  return res.json();
}

export const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtPct = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + "%";

export const fmtFator = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
