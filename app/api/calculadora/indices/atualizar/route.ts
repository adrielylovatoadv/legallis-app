import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveIndicesOverrides } from "@/lib/indices-store";

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
  // BCB SGS: 188=INPC, 10764=IPCA-E, 433=IPCA, 4390=Selic efetiva mensal
  const [inpc, ipcae, ipca, selic] = await Promise.all([
    fetchBcb(188),
    fetchBcb(10764),
    fetchBcb(433),
    fetchBcb(4390),
  ]);

  const hoje = new Date().toLocaleDateString("pt-BR");
  await saveIndicesOverrides({ inpc, ipcae, ipca, selic, ultima_atualizacao: hoje });

  const last = (r: Record<string, number>) => Object.keys(r).sort().at(-1) ?? "-";
  return {
    ok: true,
    ultima_atualizacao: hoje,
    cobertura: {
      inpc:  last(inpc),
      ipcae: last(ipcae),
      ipca:  last(ipca),
      selic: last(selic),
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
