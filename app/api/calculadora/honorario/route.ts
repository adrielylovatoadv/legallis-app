import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { calcCorrecaoHonorario } from "@/lib/calc-formulas";
import { loadIndicesAsync } from "@/lib/indices-store";

function round2(v: number) { return Math.round(v * 100) / 100; }

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  try {
    const body = await req.json();
    const {
      valor_causa,
      data_origem,
      data_calculo,
      tribunal = "TJMG",
      honorarios_pct = 20,
      numero_processo = "",
    } = body;

    if (!valor_causa || valor_causa <= 0) {
      return NextResponse.json({ error: "Valor da causa inválido." }, { status: 400 });
    }
    if (!data_origem) {
      return NextResponse.json({ error: "Data de origem obrigatória." }, { status: 400 });
    }
    if (!data_calculo) {
      return NextResponse.json({ error: "Data do cálculo obrigatória." }, { status: 400 });
    }

    const dataOrigem = new Date(data_origem + "T12:00:00");
    const dataCalculo = new Date(data_calculo + "T12:00:00");

    if (isNaN(dataOrigem.getTime()) || isNaN(dataCalculo.getTime())) {
      return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    }

    const idx = await loadIndicesAsync();
    const result = calcCorrecaoHonorario(valor_causa, dataOrigem, dataCalculo, idx, tribunal);

    const honorario_valor = round2(result.valor_corrigido * (honorarios_pct / 100));

    // Período legível
    const fmtDate = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const periodo = `${fmtDate(dataOrigem)} a ${fmtDate(dataCalculo)}`;

    return NextResponse.json({
      valor_original: round2(valor_causa),
      valor_corrigido: result.valor_corrigido,
      corr_factor: result.corr_factor,
      variacao_pct: result.variacao_pct,
      meses_corr: result.meses_corr,
      indice_label: result.indice_label,
      honorarios_pct,
      honorario_valor,
      periodo,
      numero_processo,
    });
  } catch (e: unknown) {
    console.error("[calculadora/honorario]", e);
    return NextResponse.json({ error: "Erro interno no cálculo." }, { status: 500 });
  }
}
