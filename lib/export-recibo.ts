// Emissão de recibo de quitação restrita — 2 vias idênticas, uma página A4
// inteira por via (não duas metades de página: o conteúdo estruturado não
// cabe com folga em meia-folha, e um documento de página cheia por via é o
// formato usado por escritórios de porte). Modelo genérico e reutilizável:
// nenhum nome de escritório, advogado ou pagador é fixado no corpo — todos
// os dados de identificação são opcionais e, quando ausentes, o layout se
// reorganiza sem deixar espaços vazios.

import { valorPorExtenso } from "./valor-extenso";

// Identificação de quem emite o documento (timbre) — opcional.
export interface ReciboEmitente {
  nome?: string;
  cnpj?: string;
  endereco?: string;
}

// Quem assina/representa o emitente (ex.: advogado responsável) — opcional,
// aparece apenas como identificação impressa no rodapé, não como assinatura.
export interface ReciboRepresentante {
  nome?: string;
  oab?: string;
}

export interface ReciboDoc {
  emitente?: ReciboEmitente;
  representante?: ReciboRepresentante;
  numero?: string;

  pagador?: string;              // opcional — quem efetuou o pagamento, se distinto do emitente
  recebedor: string;             // obrigatório
  documentoRecebedor?: string;   // CPF/CNPJ do recebedor — recomendado

  valor: number;                 // obrigatório
  referente: string;             // obrigatório
  processo?: string;
  formaPagamento?: string;
  dataTransferencia?: string;    // ISO (YYYY-MM-DD) ou já formatada — opcional

  local: string;                 // Cidade/UF
  data: string;                  // ISO (YYYY-MM-DD) ou já formatada — data do documento
}

// Alias mantido para não quebrar quem já importa os nomes anteriores.
export type ReciboRepresentanteDoc = ReciboRepresentante;

const INK:        [number, number, number] = [26, 26, 26];
const INK_SOFT:    [number, number, number] = [64, 64, 64];
const GRAY:        [number, number, number] = [117, 117, 117];
const GRAY_LIGHT:  [number, number, number] = [201, 201, 201];

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

  const PW = 210;
  const M = 18;
  const CW = PW - 2 * M;

  const valorExtenso = valorPorExtenso(doc.valor);
  const dataDoc = dataPorExtenso(doc.data);
  const dataTransf = doc.dataTransferencia ? dataPorExtenso(doc.dataTransferencia) : "";
  const timestamp = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  function hairline(x1: number, yy: number, x2: number, weight = 0.3, cor: [number, number, number] = GRAY_LIGHT) {
    pdf.setDrawColor(...cor);
    pdf.setLineWidth(weight);
    pdf.line(x1, yy, x2, yy);
  }

  function eyebrow(texto: string, x: number, yy: number, opts: { align?: "left" | "right" | "center" } = {}) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...GRAY);
    pdf.text(texto.toUpperCase(), x, yy, { align: opts.align ?? "left", charSpace: 0.3 });
  }

  function desenharVia(viaLabel: string) {
    let y = M;

    hairline(M, y, PW - M, 0.5, INK);
    y += 7;

    eyebrow(`Via ${viaLabel}`, M, y);
    if (doc.numero) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...GRAY);
      pdf.text(`Recibo nº ${doc.numero}`, M + CW, y, { align: "right" });
    }
    y += 6;

    // Cabeçalho do emitente — inteiramente opcional.
    if (doc.emitente?.nome) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(...INK);
      pdf.text(doc.emitente.nome, M, y);
      y += 5;

      const linhaEmitente = [
        doc.emitente.cnpj ? `CNPJ ${doc.emitente.cnpj}` : "",
        doc.emitente.endereco || "",
      ].filter(Boolean).join("   ·   ");
      if (linhaEmitente) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(...GRAY);
        pdf.text(linhaEmitente, M, y);
        y += 5;
      }
      y += 2;
      hairline(M, y, PW - M);
      y += 8;
    } else {
      y += 3;
      hairline(M, y, PW - M);
      y += 8;
    }

    // Título
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(19);
    pdf.setTextColor(...INK);
    pdf.text("RECIBO", PW / 2, y, { align: "center", charSpace: 0.9 });
    y += 10;

    // ── dados do pagamento ──────────────────────────────────────────────
    eyebrow("Dados do pagamento", M, y);
    y += 3;
    hairline(M, y, PW - M);
    y += 6;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...GRAY);
    pdf.text("VALOR RECEBIDO", M, y, { charSpace: 0.3 });
    y += 5.5;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(...INK);
    pdf.text(fmtBRL(doc.valor), M, y);
    y += 4.5;
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.setTextColor(...GRAY);
    const linhasExtenso = pdf.splitTextToSize(`(${valorExtenso})`, CW);
    pdf.text(linhasExtenso, M, y);
    y += linhasExtenso.length * 3.6 + 3;

    hairline(M, y, PW - M);
    y += 6;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...GRAY);
    pdf.text("REFERENTE A", M, y, { charSpace: 0.3 });
    y += 4.5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...INK_SOFT);
    const linhasReferente = pdf.splitTextToSize(doc.referente, CW);
    pdf.text(linhasReferente, M, y);
    y += linhasReferente.length * 4.2 + 4;

    if (doc.processo || doc.formaPagamento) {
      const colX2 = M + CW * 0.55;
      if (doc.processo) {
        eyebrow("Processo nº", M, y);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(...INK_SOFT);
        pdf.text(doc.processo, M, y + 4.3);
      }
      if (doc.formaPagamento) {
        eyebrow("Forma de pagamento", colX2, y);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(...INK_SOFT);
        pdf.text(doc.formaPagamento, colX2, y + 4.3);
      }
      y += 9;
    }

    if (dataTransf) {
      eyebrow("Data da transferência", M, y);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...INK_SOFT);
      pdf.text(dataTransf, M, y + 4.3);
      y += 9;
    }

    y += 1;
    hairline(M, y, PW - M);
    y += 7;

    // ── partes ───────────────────────────────────────────────────────────
    if (doc.pagador) {
      eyebrow("Pagador (opcional)", M, y);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(...INK_SOFT);
      pdf.text(doc.pagador, M, y + 4.3);
      y += 9;
    }

    eyebrow("Recebedor(a)", M, y);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...INK);
    pdf.text(doc.recebedor, M, y + 4.5);
    y += 8.5;
    if (doc.documentoRecebedor) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...GRAY);
      pdf.text(`CPF/CNPJ ${doc.documentoRecebedor}`, M, y);
      y += 5;
    }
    y += 3;

    // ── cláusula de quitação restrita ───────────────────────────────────
    const clausula =
      `O(A) recebedor(a) qualificado(a) acima declara ter recebido a quantia líquida e certa especificada ` +
      `neste recibo, referente ao quanto acima descrito. A quitação ora conferida é restrita e limitada, ` +
      `exclusivamente, ao valor discriminado neste documento, não implicando quitação, renúncia, transação ou ` +
      `novação quanto a quaisquer outras verbas, parcelas, direitos ou obrigações — vencidas, vincendas ou ` +
      `litigiosas — ainda que decorrentes do mesmo processo, acordo ou relação jurídica ora referida, os quais ` +
      `permanecem íntegros, hígidos e exigíveis na forma da lei, salvo quitação expressa em documento próprio.`;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.8);
    pdf.setTextColor(...INK_SOFT);
    const linhasClausula = pdf.splitTextToSize(clausula, CW);
    pdf.text(linhasClausula, M, y, { lineHeightFactor: 1.42 });
    y += linhasClausula.length * 4.1 + 5;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...INK);
    pdf.text(`${doc.local || "___________"}, ${dataDoc || "___________"}.`, M, y);
    y += 24;

    // ── assinatura ───────────────────────────────────────────────────────
    hairline(PW / 2 - 42, y, PW / 2 + 42, 0.3, INK_SOFT);
    y += 4.5;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...INK);
    pdf.text(doc.recebedor, PW / 2, y, { align: "center" });
    y += 4;
    if (doc.documentoRecebedor) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...GRAY);
      pdf.text(`CPF/CNPJ ${doc.documentoRecebedor}`, PW / 2, y, { align: "center" });
      y += 3.7;
    }
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...GRAY);
    pdf.text("assinatura do(a) recebedor(a)", PW / 2, y, { align: "center", charSpace: 0.2 });
    y += 16;

    // ── rodapé ───────────────────────────────────────────────────────────
    hairline(M, y, PW - M, 0.25);
    y += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...GRAY);
    const identificacaoEmissor = [doc.representante?.nome, doc.representante?.oab].filter(Boolean).join(" — ");
    if (identificacaoEmissor) pdf.text(`Emitido por: ${identificacaoEmissor}`, M, y);
    pdf.text(`Documento gerado eletronicamente em ${timestamp}`, PW - M, y, { align: "right" });
  }

  desenharVia("1 de 2");
  pdf.addPage();
  desenharVia("2 de 2");

  pdf.save(`${nomeArquivo}.pdf`);
}
