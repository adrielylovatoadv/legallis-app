import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadIndicesAsync, saveIndicesOverrides } from "@/lib/indices-store";
import { fetchTjspTabelaPratica, mergeTjspForward } from "@/lib/tjsp-scraper";

export const runtime = "nodejs";

type BcbEntry = { data: string; valor: string };

async function fetchBcb(serie: number, n = 12): Promise<Record<string, number>> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/${n}?formato=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`BCB série ${serie}: HTTP ${res.status}`);
  const data = (await res.json()) as BcbEntry[];
  const result: Record<string, number> = {};
  for (const { data: d, valor } of data) {
    // "01/04/2026" → "2026-04"
    const parts = d.split("/");
    const key = `${parts[2]}-${parts[1]}`;
    result[key] = parseFloat(valor);
  }
  return result;
}

async function runUpdate() {
  // BCB SGS: 188=INPC, 10764=IPCA-E, 433=IPCA, 4390=Selic efetiva mensal,
  // 29543=Taxa Legal mensal pronta (art. 406 §1º CC, Lei 14.905/2024 — ver nota em calc-formulas.ts)
  const [inpc, ipcae, ipca, selic, taxa_legal] = await Promise.all([
    fetchBcb(188),
    fetchBcb(10764),
    fetchBcb(433),
    fetchBcb(4390),
    fetchBcb(29543),
  ]);

  // Tabela Prática do TJSP (Lei 14.905/2024) não vem do BCB — é lida do PDF oficial do tribunal.
  // Só estende a série para meses novos (mergeTjspForward); se o parse falhar ou divergir do que
  // já está salvo, mantém o valor atual e reporta o erro sem interromper a atualização dos demais.
  let tjsp_14905: Record<string, number> | undefined;
  let tjspErro: string | null = null;
  try {
    const atual = await loadIndicesAsync();
    const parsed = await fetchTjspTabelaPratica();
    tjsp_14905 = mergeTjspForward(atual.tjsp_14905, parsed);
  } catch (e) {
    tjspErro = e instanceof Error ? e.message : String(e);
    console.error("[indices/atualizar] TJSP:", e);
  }

  const hoje = new Date().toLocaleDateString("pt-BR");
  await saveIndicesOverrides({ inpc, ipcae, ipca, selic, taxa_legal, tjsp_14905, ultima_atualizacao: hoje });

  const last = (r: Record<string, number>) => Object.keys(r).sort().at(-1) ?? "-";
  return {
    ok: true,
    ultima_atualizacao: hoje,
    cobertura: {
      inpc:       last(inpc),
      ipcae:      last(ipcae),
      ipca:       last(ipca),
      selic:      last(selic),
      taxa_legal: last(taxa_legal),
      tjsp:       tjsp_14905 ? last(tjsp_14905) : `erro: ${tjspErro}`,
    },
  };
}

// GET — chamado pelo cron Vercel
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth_header = req.headers.get("authorization");
  if (!secret || auth_header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  try {
    return NextResponse.json(await runUpdate());
  } catch (e) {
    console.error("[indices/atualizar]", e);
    return NextResponse.json({ error: "Erro ao buscar índices do BCB." }, { status: 500 });
  }
}

// POST — acionado manualmente pelo painel admin. Escreve um override GLOBAL (usado por todos
// os tenants), então exige o super-admin real (plan="admin"), não o role interno do escritório
// — ver nota de segurança em app/api/usuarios/[id]/route.ts.
export async function POST() {
  const session = await auth();
  if (!session || session.user?.plan !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  try {
    return NextResponse.json(await runUpdate());
  } catch (e) {
    console.error("[indices/atualizar]", e);
    return NextResponse.json({ error: "Erro ao buscar índices do BCB." }, { status: 500 });
  }
}
