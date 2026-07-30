// Emissão de recibo de repasse ao cliente (2 vias idênticas em uma folha A4),
// para processos em que o escritório repassa ao cliente parte do valor recebido
// (acordos e execuções). Segue a identidade visual usada em export-calc.ts.

import { valorPorExtenso } from "./valor-extenso";

export interface ReciboEmpresa {
  nome?: string;
  cnpj?: string;
  endereco?: string;
}

export interface ReciboAdvogado {
  nome?: string;
  oab?: string;
}

export interface ReciboRepasseDoc {
  empresa: ReciboEmpresa;
  advogado?: ReciboAdvogado;
  numero?: string;
  cliente: string;
  cpfCnpj?: string;
  valor: number;
  referente: string;
  processo?: string;
  formaPagamento?: string;
  local: string;
  data: string; // DD/MM/AAAA
}

const GOLD:      [number, number, number] = [201, 168, 76];
const DARK:      [number, number, number] = [26, 23, 20];
const OFF_WHITE: [number, number, number] = [245, 243, 239];
const GRAY_TEXT: [number, number, number] = [110, 105, 98];

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function exportarReciboRepasse(doc: ReciboRepasseDoc, nomeArquivo: string) {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const PW = 210, PH = 297;
  const M = 15;
  const CW = PW - 2 * M;
  const VIA_H = (PH - 2 * M) / 2;

  const valorExtenso = valorPorExtenso(doc.valor);

  function desenharVia(yBase: number, rotulo: string) {
    let y = yBase;

    // Faixa dourada superior + rótulo da via
    pdf.setFillColor(...GOLD);
    pdf.rect(M, y, CW, 1.2, "F");
    y += 6;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...GRAY_TEXT);
    pdf.text(rotulo.toUpperCase(), M, y);

    if (doc.numero) {
      pdf.setFont("helvetica", "normal");
      pdf.text(`Recibo nº ${doc.numero}`, M + CW, y, { align: "right" });
    }
    y += 7;

    // Cabeçalho do escritório
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(...DARK);
    pdf.text(doc.empresa.nome || "___________", M, y);
    y += 5.5;

    const linhaEmpresa = [
      doc.empresa.cnpj ? `CNPJ ${doc.empresa.cnpj}` : "",
      doc.empresa.endereco || "",
    ].filter(Boolean).join("  ·  ");
    if (linhaEmpresa) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...GRAY_TEXT);
      pdf.text(linhaEmpresa, M, y);
      y += 6;
    } else {
      y += 2;
    }

    // Título centralizado
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(...DARK);
    pdf.text("RECIBO", PW / 2, y + 2, { align: "center" });
    y += 9;

    // Caixa de valor
    pdf.setFillColor(...OFF_WHITE);
    pdf.setDrawColor(...GOLD);
    pdf.setLineWidth(0.4);
    pdf.rect(M, y, CW, 12, "FD");
    pdf.setFillColor(...GOLD);
    pdf.rect(M, y, 2, 12, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...GRAY_TEXT);
    pdf.text("VALOR REPASSADO", M + 6, y + 5);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...DARK);
    pdf.text(fmtBRL(doc.valor), M + 6, y + 10);
    y += 17;

    // Corpo do texto do recibo
    const corpo =
      `Recebi(emos) de ${doc.empresa.nome || "___________"}${doc.empresa.cnpj ? `, CNPJ ${doc.empresa.cnpj}` : ""}, ` +
      `a quantia de ${fmtBRL(doc.valor)} (${valorExtenso}), referente a ${doc.referente}` +
      `${doc.processo ? `, relativo ao processo nº ${doc.processo}` : ""}${doc.formaPagamento ? `, pago via ${doc.formaPagamento}` : ""}. ` +
      `Para maior clareza, firmo(amos) o presente recibo, dando plena e geral quitação do valor acima referido.`;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...DARK);
    const linhas = pdf.splitTextToSize(corpo, CW);
    pdf.text(linhas, M, y, { lineHeightFactor: 1.45 });
    y += linhas.length * 4.6 + 4;

    // Local e data
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`${doc.local || "___________"}, ${doc.data}.`, M, y);
    y += 10;

    // Assinatura do cliente
    const linhaAssinaturaY = yBase + VIA_H - 20;
    pdf.setDrawColor(...DARK);
    pdf.setLineWidth(0.3);
    pdf.line(PW / 2 - 45, linhaAssinaturaY, PW / 2 + 45, linhaAssinaturaY);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...DARK);
    pdf.text(doc.cliente, PW / 2, linhaAssinaturaY + 4.5, { align: "center" });
    if (doc.cpfCnpj) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...GRAY_TEXT);
      pdf.text(doc.cpfCnpj, PW / 2, linhaAssinaturaY + 8.5, { align: "center" });
    }

    if (doc.advogado?.nome) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...GRAY_TEXT);
      const assinante = [doc.advogado.nome, doc.advogado.oab].filter(Boolean).join(" — ");
      pdf.text(assinante, M, yBase + VIA_H - 6);
    }
  }

  desenharVia(M, "1ª via — escritório");

  // Linha de corte tracejada entre as duas vias
  const meio = M + VIA_H;
  pdf.setDrawColor(...GRAY_TEXT);
  pdf.setLineWidth(0.3);
  pdf.setLineDashPattern([1.5, 1.5], 0);
  pdf.line(M, meio, PW - M, meio);
  pdf.setLineDashPattern([], 0);

  const rotuloCorte = "✂  RECORTE AQUI";
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  const larguraRotulo = pdf.getTextWidth(rotuloCorte) + 6;
  pdf.setFillColor(255, 255, 255);
  pdf.rect(PW / 2 - larguraRotulo / 2, meio - 3, larguraRotulo, 6, "F");
  pdf.setTextColor(...GRAY_TEXT);
  pdf.text(rotuloCorte, PW / 2, meio + 1, { align: "center" });

  desenharVia(meio, "2ª via — cliente");

  pdf.save(`${nomeArquivo}.pdf`);
}
