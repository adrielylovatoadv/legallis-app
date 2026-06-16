import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadIndices, calcTaxaImplicita, calcPMT, calcCorrigirExcesso } from "@/lib/calc-formulas";

function round2(v: number) { return Math.round(v * 100) / 100; }
function round4(v: number) { return Math.round(v * 10_000) / 10_000; }

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  try {
    const body = await req.json();
    const {
      tipo = "veiculo",
      pv,
      pmt_contratada,
      n_parcelas,
      data_contratacao,
      data_calculo,
      taxa_bacen = null,
      total_seguros = 0,
    } = body;

    if (!pv || pv <= 0) return NextResponse.json({ error: "Valor financiado inválido." }, { status: 400 });
    if (!pmt_contratada || pmt_contratada <= 0) return NextResponse.json({ error: "Parcela contratada inválida." }, { status: 400 });
    if (!n_parcelas || n_parcelas <= 0) return NextResponse.json({ error: "Número de parcelas inválido." }, { status: 400 });
    if (pmt_contratada * n_parcelas <= pv) return NextResponse.json({ error: "Parcelas inconsistentes com valor financiado." }, { status: 400 });

    const dataContrat = data_contratacao ? new Date(data_contratacao + "T12:00:00") : null;
    const dataCalc = new Date((data_calculo || new Date().toISOString().split("T")[0]) + "T12:00:00");

    if (dataContrat && isNaN(dataContrat.getTime())) {
      return NextResponse.json({ error: "Data de contratação inválida." }, { status: 400 });
    }

    const idx = loadIndices();

    // Taxa contratada implícita (Newton-Raphson)
    const taxaContratadaPct = calcTaxaImplicita(pv, pmt_contratada, n_parcelas);
    if (!taxaContratadaPct) {
      return NextResponse.json({ error: "Não foi possível calcular a taxa implícita." }, { status: 400 });
    }

    // Taxa de referência: BACEN informada OU estimativa conservadora baseada em Selic
    let taxaReferenciaPct: number;
    if (taxa_bacen && taxa_bacen > 0) {
      taxaReferenciaPct = taxa_bacen;
    } else {
      // Usa Selic mensal mais recente disponível como proxy da taxa de mercado
      const selicKeys = Object.keys(idx.selic).sort();
      const ultimaSelic = selicKeys.length > 0 ? idx.selic[selicKeys[selicKeys.length - 1]] : 1.0;
      // Para veículo: media histórica BACEN ~1.5-1.8% a.m. (conservador)
      taxaReferenciaPct = tipo === "veiculo"
        ? Math.min(taxaContratadaPct * 0.7, Math.max(ultimaSelic * 1.5, 1.5))
        : Math.min(taxaContratadaPct * 0.7, Math.max(ultimaSelic * 2, 2.0));
      taxaReferenciaPct = round4(taxaReferenciaPct);
    }

    // Parcela justa com a taxa de referência
    const pmtJusta = calcPMT(pv, taxaReferenciaPct, n_parcelas);
    const excessoMensal = round2(Math.max(pmt_contratada - pmtJusta, 0));

    // Planilha de parcelas (primeiras 24 ou todas)
    const parcelas: {
      parcela: number;
      data_vencimento: string;
      pmt_contratada: number;
      pmt_justa: number;
      excesso: number;
      excesso_corrigido: number;
    }[] = [];

    let totalParcelas = 0;
    for (let i = 1; i <= n_parcelas; i++) {
      // Data de vencimento
      let dataVenc: Date;
      if (dataContrat) {
        dataVenc = new Date(dataContrat);
        dataVenc.setMonth(dataVenc.getMonth() + i);
      } else {
        dataVenc = new Date(dataCalc);
        dataVenc.setMonth(dataVenc.getMonth() - (n_parcelas - i));
      }

      const excesso = round2(Math.max(pmt_contratada - pmtJusta, 0));
      let excessoCorrigido = excesso;

      if (dataVenc < dataCalc && excesso > 0) {
        excessoCorrigido = calcCorrigirExcesso(excesso, dataVenc, dataCalc, idx);
      }

      totalParcelas = round2(totalParcelas + excessoCorrigido);

      if (i <= 24) {
        parcelas.push({
          parcela: i,
          data_vencimento: dataVenc.toLocaleDateString("pt-BR"),
          pmt_contratada: round2(pmt_contratada),
          pmt_justa: pmtJusta,
          excesso,
          excesso_corrigido: excessoCorrigido,
        });
      }
    }

    // Seguros embutidos corrigidos
    const totalSegurosCorrigido = total_seguros > 0 && dataContrat
      ? calcCorrigirExcesso(total_seguros, dataContrat, dataCalc, idx)
      : total_seguros;

    const totalExcesso = round2(totalParcelas + totalSegurosCorrigido);

    return NextResponse.json({
      tipo,
      pv: round2(pv),
      n_parcelas,
      taxa_contratada_pct: round4(taxaContratadaPct),
      taxa_referencia_pct: round4(taxaReferenciaPct),
      pmt_contratada: round2(pmt_contratada),
      pmt_justa: pmtJusta,
      excesso_mensal: excessoMensal,
      total_excesso: totalExcesso,
      total_parcelas: n_parcelas,
      total_seguros: round2(totalSegurosCorrigido),
      parcelas,
    });
  } catch (e: unknown) {
    console.error("[calculadora/revisional]", e);
    return NextResponse.json({ error: "Erro interno no cálculo." }, { status: 500 });
  }
}
