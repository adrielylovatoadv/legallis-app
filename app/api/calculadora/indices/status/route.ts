import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadIndicesAsync } from "@/lib/indices-store";

function lastKey(obj: Record<string, number>): string | null {
  const keys = Object.keys(obj).sort();
  return keys.length > 0 ? keys[keys.length - 1] : null;
}

function proximaAtualizacaoTJSP(ultimoMes: string | null): string {
  if (!ultimoMes) return "-";
  const [year, month] = ultimoMes.split("-").map(Number);
  const next = month === 12 ? new Date(year + 1, 0, 1) : new Date(year, month, 1);
  return `01/${String(next.getMonth() + 1).padStart(2, "0")}/${next.getFullYear()}`;
}

function formatMes(key: string | null): string {
  if (!key) return "-";
  const [year, month] = key.split("-");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[parseInt(month) - 1]}/${year}`;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  try {
    const idx = await loadIndicesAsync();

    const ultimoTJSP = lastKey(idx.tjsp_14905);

    return NextResponse.json({
      ultima_atualizacao: idx.ultima_atualizacao ?? null,
      cobertura: {
        inpc: formatMes(lastKey(idx.inpc)),
        ipcae: formatMes(lastKey(idx.ipcae)),
        selic: formatMes(lastKey(idx.selic)),
        tjsp: formatMes(ultimoTJSP),
        tjsp_raw: ultimoTJSP,
      },
      proxima_atualizacao_tjsp: proximaAtualizacaoTJSP(ultimoTJSP),
    });
  } catch (e) {
    console.error("[indices/status]", e);
    return NextResponse.json({ error: "Erro ao carregar status." }, { status: 500 });
  }
}
