import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { calculateCharge } from "@/lib/calc-formulas";
import { loadIndicesAsync } from "@/lib/indices-store";

function round2(v: number) { return Math.round(v * 100) / 100; }

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  try {
    const body = await req.json();
    const {
      lancamentos,
      data_calculo,
      tribunal = "TJMG",
      honorarios_pct = 20,
      multa_523 = false,
      modo = "execucao",
      aplicar_dobro = false,
      dano_moral = 0,
    } = body;

    if (!lancamentos?.length) {
      return NextResponse.json({ error: "Nenhum lançamento informado." }, { status: 400 });
    }
    if (!data_calculo) {
      return NextResponse.json({ error: "Data de cálculo obrigatória." }, { status: 400 });
    }

    const idx = await loadIndicesAsync();
    const dateCalc = new Date(data_calculo + "T12:00:00");

    if (isNaN(dateCalc.getTime())) {
      return NextResponse.json({ error: "Data de cálculo inválida." }, { status: 400 });
    }

    const rows = (lancamentos as { data_cobranca: string; valor: number }[]).map((l) => {
      if (!l.data_cobranca || !l.valor) return null;
      const dateCharge = new Date(l.data_cobranca + "T12:00:00");
      if (isNaN(dateCharge.getTime())) return null;
      const r = calculateCharge(l.valor, dateCharge, dateCalc, idx, tribunal);
      return {
        data_cobranca: l.data_cobranca,
        valor_original: round2(l.valor),
        fator_correcao: r.correction_factor,
        debito_corrigido: r.corrected,
        juros_pct: r.interest_pct,
        juros_valor: r.interest_value,
        total: r.total,
      };
    }).filter(Boolean);

    if (!rows.length) {
      return NextResponse.json({ error: "Nenhum lançamento válido encontrado." }, { status: 400 });
    }

    const subtotalPrincipal = round2(rows.reduce((s, r) => s + r!.debito_corrigido, 0));
    const subtotalJuros = round2(rows.reduce((s, r) => s + r!.juros_valor, 0));
    const subtotalBase = round2(rows.reduce((s, r) => s + r!.total, 0));

    const summary: Record<string, number | boolean | undefined> = {
      subtotal_principal: subtotalPrincipal,
      subtotal_juros: subtotalJuros,
      subtotal_base: subtotalBase,
    };

    let totalGeral = subtotalBase;

    if (modo === "execucao") {
      const honorariosValor = round2(subtotalBase * ((honorarios_pct as number) / 100));
      summary.honorarios_pct = honorarios_pct as number;
      summary.honorarios_valor = honorariosValor;
      totalGeral = round2(totalGeral + honorariosValor);

      if (multa_523) {
        const multaValor = round2(subtotalBase * 0.10);
        summary.multa_523 = true;
        summary.multa_valor = multaValor;
        totalGeral = round2(totalGeral + multaValor);
      }
    } else if (modo === "inicial") {
      if (aplicar_dobro) {
        const subtotalMaterial = round2(subtotalBase * 2);
        summary.aplicar_dobro = true;
        summary.subtotal_material = subtotalMaterial;
        totalGeral = subtotalMaterial;
      }
      if ((dano_moral as number) > 0) {
        summary.dano_moral = dano_moral as number;
        totalGeral = round2(totalGeral + (dano_moral as number));
      }
    }

    summary.total_geral = round2(totalGeral);

    return NextResponse.json({ rows, summary });
  } catch (e: unknown) {
    console.error("[calculadora/calcular]", e);
    return NextResponse.json({ error: "Erro interno no cálculo." }, { status: 500 });
  }
}
