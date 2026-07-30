// Emissão de recibo simples — 2 vias idênticas em um único PDF de uma
// página. Campos mínimos: quem emite (advogado ou escritório), cliente,
// CPF, processo, valor recebido, cidade e data.

import { valorPorExtenso } from "./valor-extenso";

export interface ReciboDoc {
  emitenteNome: string;            // nome do advogado ou do escritório
  emitenteIdentificacao?: string;  // "OAB/MG 123456" ou "CNPJ 00.000.000/0000-00"
  cliente: string;
  cpf: string;
  processo?: string;
  valor: number;
  local: string;    // cidade/UF
  data: string;     // ISO (YYYY-MM-DD) ou já formatada
  // Classificação contábil do valor — deixa explícito para quem contabiliza
  // que não é receita do escritório, e sim dinheiro de titularidade do cliente
  // apenas em trânsito por ele. Só muda se, no futuro, este mesmo gerador for
  // reaproveitado para recibo de honorários (receita própria do escritório).
  natureza?: string;
}

const INK:       [number, number, number] = [26, 26, 26];
const INK_SOFT:  [number, number, number] = [64, 64, 64];
const GRAY:      [number, number, number] = [120, 120, 120];
const GRAY_LINE: [number, number, number] = [205, 205, 205];

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MESES_EXT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function dataPorExtenso(valor: string): string {
  const m = valor?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return valor || "";
  const [, ano, mes, dia] = m;
  return `${parseInt(dia, 10)} de ${MESES_EXT[parseInt(mes, 10) - 1]} de ${ano}`;
}

export async function exportarReciboRepasse(doc: ReciboDoc, nomeArquivo: string) {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const PW = 210, PH = 297;
  const M = 16;
  const CW = PW - 2 * M;
  const VIA_H = (PH - 2 * M) / 2;

  const valorExtenso = valorPorExtenso(doc.valor);
  const dataFmt = dataPorExtenso(doc.data);
  const natureza = doc.natureza || "Repasse de valores ao cliente — não constitui receita do escritório";

  function hairline(x1: number, yy: number, x2: number, weight = 0.3, cor: [number, number, number] = GRAY_LINE) {
    pdf.setDrawColor(...cor);
    pdf.setLineWidth(weight);
    pdf.line(x1, yy, x2, yy);
  }

  function label(texto: string, x: number, yy: number) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...GRAY);
    pdf.text(texto.toUpperCase(), x, yy, { charSpace: 0.3 });
  }

  function desenharVia(yBase: number, viaLabel: string, comTopo: boolean) {
    let y = yBase;

    if (comTopo) hairline(M, y, PW - M, 0.5, INK);
    y += 6;

    label(viaLabel, M, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...INK_SOFT);
    pdf.text(doc.emitenteNome, M + CW, y, { align: "right" });
    y += 4.5;
    if (doc.emitenteIdentificacao) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...GRAY);
      pdf.text(doc.emitenteIdentificacao, M + CW, y, { align: "right" });
    }
    y += 6;

    // Título
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.setTextColor(...INK);
    pdf.text("RECIBO", PW / 2, y, { align: "center", charSpace: 0.8 });
    y += 9;

    // Valor
    label("Valor recebido", M, y);
    y += 5.5;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(...INK);
    pdf.text(fmtBRL(doc.valor), M, y);
    y += 4.5;
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.setTextColor(...GRAY);
    const linhasExtenso = pdf.splitTextToSize(`(${valorExtenso})`, CW);
    pdf.text(linhasExtenso, M, y);
    y += linhasExtenso.length * 3.6 + 4;

    hairline(M, y, PW - M);
    y += 6;

    // Cliente / CPF
    label("Recebedor(a)", M, y);
    y += 4.8;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.setTextColor(...INK);
    pdf.text(doc.cliente, M, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...INK_SOFT);
    pdf.text(`CPF ${doc.cpf}`, M + CW, y, { align: "right" });
    y += 7;

    // Natureza — classificação contábil do valor (repasse x receita).
    label("Natureza", M, y);
    y += 4.5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...INK_SOFT);
    const linhasNatureza = pdf.splitTextToSize(natureza, CW);
    pdf.text(linhasNatureza, M, y);
    y += linhasNatureza.length * 4 + 2;

    // Processo
    if (doc.processo) {
      label("Processo nº", M, y);
      y += 4.5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(...INK_SOFT);
      pdf.text(doc.processo, M, y);
      y += 7;
    }

    y += 1;
    hairline(M, y, PW - M);
    y += 6;

    // Cláusula
    const clausula =
      `O(a) recebedor(a) qualificado(a) acima declara ter recebido a quantia líquida e certa acima indicada` +
      `${doc.processo ? `, referente ao processo nº ${doc.processo}` : ""}. A presente quitação refere-se ` +
      `exclusivamente ao valor líquido recebido pela parte Autora, correspondente ao montante remanescente ` +
      `após a dedução dos honorários advocatícios contratuais e sucumbenciais, quando devidos.`;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.8);
    pdf.setTextColor(...INK_SOFT);
    const linhasClausula = pdf.splitTextToSize(clausula, CW);
    pdf.text(linhasClausula, M, y, { lineHeightFactor: 1.32 });
    y += linhasClausula.length * 3.8 + 4;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...INK);
    pdf.text(`${doc.local || "___________"}, ${dataFmt || "___________"}.`, M, y);

    // Assinatura — ancorada ao rodapé da via, mas nunca mais perto do texto
    // acima do que 8mm (conteúdo variável: natureza/processo podem empurrá-la).
    const linhaAssinaturaY = Math.max(y + 8, yBase + VIA_H - 16);
    hairline(PW / 2 - 40, linhaAssinaturaY, PW / 2 + 40, 0.3, INK_SOFT);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...INK);
    pdf.text(doc.cliente, PW / 2, linhaAssinaturaY + 4.2, { align: "center" });
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...GRAY);
    pdf.text("assinatura do(a) recebedor(a)", PW / 2, linhaAssinaturaY + 7.4, { align: "center", charSpace: 0.2 });
  }

  desenharVia(M, "1ª via", true);

  // Linha de corte entre as duas vias — serve também de borda superior da 2ª via,
  // por isso desenharVia(..., false) não desenha uma segunda linha por cima dela.
  const meio = M + VIA_H;
  pdf.setDrawColor(...GRAY);
  pdf.setLineWidth(0.3);
  pdf.setLineDashPattern([1.2, 1.6], 0);
  pdf.line(M, meio, PW - M, meio);
  pdf.setLineDashPattern([], 0);

  const rotuloCorte = "R E C O R T E   A Q U I";
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  const larguraRotulo = pdf.getTextWidth(rotuloCorte) + 8;
  pdf.setFillColor(255, 255, 255);
  pdf.rect(PW / 2 - larguraRotulo / 2, meio - 2.6, larguraRotulo, 5.2, "F");
  pdf.setTextColor(...GRAY);
  pdf.text(rotuloCorte, PW / 2, meio + 0.8, { align: "center" });

  desenharVia(meio, "2ª via", false);

  pdf.save(`${nomeArquivo}.pdf`);
}
