// Geração de modelos de documento (Procuração, Contrato de Honorários) em PDF,
// com dados mesclados do cliente/processo/advogado. Reaproveita a paleta visual
// já usada em lib/export-calc.ts (dourado/preto Legallis).

export interface AdvogadoDoc {
  nome?: string;
  oab?: string;
  estado?: string;
  oabs?: Array<{ estado: string; numero: string }>;
  escritorio?: string;
  cnpjEscritorio?: string;
  enderecoEscritorio?: string;
}

export interface ClienteDoc {
  nome: string;
  tipo_pessoa?: "fisica" | "juridica";
  cpf?: string;
  cnpj?: string;
  endereco?: string;
  tratamento?: string;
}

const GOLD: [number, number, number] = [201, 168, 76];
const DARK: [number, number, number] = [26, 23, 20];
const OFF_WHITE: [number, number, number] = [245, 243, 239];
const GRAY_TEXT: [number, number, number] = [90, 85, 78];

function oabString(adv: AdvogadoDoc): string {
  if (adv.oabs && adv.oabs.length > 0) return adv.oabs.map(o => `OAB/${o.estado} ${o.numero}`).join(" – ");
  if (adv.oab) return adv.estado ? `OAB/${adv.estado} ${adv.oab}` : `OAB ${adv.oab}`;
  return "";
}

function qualificacaoCliente(c: ClienteDoc): string {
  const trat = c.tratamento ? `${c.tratamento} ` : "";
  if (c.tipo_pessoa === "juridica") {
    return `${trat}${c.nome}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${c.cnpj || "___________"}, com sede em ${c.endereco || "___________"}`;
  }
  return `${trat}${c.nome}, portador(a) do CPF nº ${c.cpf || "___________"}, residente e domiciliado(a) em ${c.endereco || "___________"}`;
}

async function novoDocumento() {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210;
  const M = 20;
  const CW = PW - 2 * M;

  const HDR_H = 26;
  pdf.setFillColor(...DARK);
  pdf.rect(0, 0, PW, HDR_H, "F");
  pdf.setFillColor(...GOLD);
  pdf.rect(0, 0, PW, 1.2, "F");

  return { pdf, PW, M, CW, HDR_H };
}

function titulo(pdf: import("jspdf").jsPDF, PW: number, texto: string) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(...GOLD);
  pdf.text(texto, PW / 2, 16, { align: "center" });
}

function subEscritorio(pdf: import("jspdf").jsPDF, PW: number, adv: AdvogadoDoc) {
  const linha = [adv.escritorio, adv.nome].filter(Boolean).join(" — ");
  if (!linha) return;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...OFF_WHITE);
  pdf.text(linha, PW / 2, 22, { align: "center" });
}

function escreverParagrafo(pdf: import("jspdf").jsPDF, texto: string, M: number, CW: number, y: number, negrito = false): number {
  pdf.setFont("helvetica", negrito ? "bold" : "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...DARK);
  const linhas = pdf.splitTextToSize(texto, CW);
  if (y + linhas.length * 5.2 > 275) { pdf.addPage(); y = 20; }
  pdf.text(linhas, M, y, { align: "justify", maxWidth: CW });
  return y + linhas.length * 5.2 + 6;
}

function escreverAssinaturas(pdf: import("jspdf").jsPDF, PW: number, M: number, CW: number, y: number, papeis: { label: string; nome: string; sub?: string }[]) {
  if (y + 30 > 280) { pdf.addPage(); y = 20; }
  y += 10;
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...DARK);
  pdf.text(`Local e data: ______________________, ${hoje}.`, M, y);
  y += 20;

  const largura = CW / papeis.length;
  papeis.forEach((papel, i) => {
    const cx = M + largura * i + largura / 2;
    pdf.setDrawColor(...GOLD);
    pdf.setLineWidth(0.5);
    pdf.line(cx - 35, y, cx + 35, y);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(papel.nome, cx, y + 5, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...GRAY_TEXT);
    pdf.text(papel.label, cx, y + 9.5, { align: "center" });
    if (papel.sub) pdf.text(papel.sub, cx, y + 13.5, { align: "center" });
    pdf.setTextColor(...DARK);
  });
}

function rodape(pdf: import("jspdf").jsPDF, M: number, PW: number, nomeDoc: string) {
  const pageCount = (pdf as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(...GRAY_TEXT);
    pdf.text(`Legallis · ${nomeDoc}`, M, 293);
    if (pageCount > 1) pdf.text(`Página ${i} / ${pageCount}`, PW - M, 293, { align: "right" });
  }
}

export async function generateProcuracaoPDF(cliente: ClienteDoc, advogado: AdvogadoDoc) {
  const { pdf, PW, M, CW, HDR_H } = await novoDocumento();
  titulo(pdf, PW, "PROCURAÇÃO");
  subEscritorio(pdf, PW, advogado);
  let y = HDR_H + 12;

  y = escreverParagrafo(pdf, `OUTORGANTE: ${qualificacaoCliente(cliente)}.`, M, CW, y);

  const oab = oabString(advogado);
  y = escreverParagrafo(
    pdf,
    `OUTORGADO(A): ${advogado.nome || "___________"}, advogado(a) inscrito(a) na ${oab || "OAB"}${advogado.escritorio ? `, com escritório profissional em ${advogado.escritorio}` : ""}${advogado.enderecoEscritorio ? `, situado em ${advogado.enderecoEscritorio}` : ""}.`,
    M, CW, y
  );

  y = escreverParagrafo(pdf,
    "PODERES: Pelo presente instrumento particular de mandato, o(a) outorgante nomeia e constitui seu bastante procurador o(a) outorgado(a) acima qualificado(a), a quem confere amplos poderes para o foro em geral, com a cláusula \"ad judicia et extra\", podendo atuar em qualquer Juízo, Instância ou Tribunal, propor as ações competentes e defender o(a) outorgante nas contrárias, seguindo umas e outras até final decisão, usando os recursos legais e acompanhando-os, conferindo-lhe ainda poderes especiais para confessar, desistir, transigir, firmar compromissos ou acordos, receber e dar quitação, agindo em conjunto ou separadamente, podendo substabelecer esta a outrem, com ou sem reserva de poderes, dando tudo por bom, firme e valioso.",
    M, CW, y
  );

  escreverAssinaturas(pdf, PW, M, CW, y, [
    { label: "Outorgante", nome: cliente.nome },
    { label: "Outorgado(a)", nome: advogado.nome || "", sub: oab },
  ]);

  rodape(pdf, M, PW, "Procuração");
  pdf.save(`procuracao_${cliente.nome.replace(/\s+/g, "_").toLowerCase()}.pdf`);
}

export async function generateContratoHonorariosPDF(
  cliente: ClienteDoc,
  advogado: AdvogadoDoc,
  opts: { processoNumero?: string; objeto?: string; percentual?: number } = {}
) {
  const percentual = opts.percentual ?? 30;
  const { pdf, PW, M, CW, HDR_H } = await novoDocumento();
  titulo(pdf, PW, "CONTRATO DE HONORÁRIOS ADVOCATÍCIOS");
  subEscritorio(pdf, PW, advogado);
  let y = HDR_H + 12;

  const oab = oabString(advogado);
  y = escreverParagrafo(pdf, `CONTRATANTE: ${qualificacaoCliente(cliente)}.`, M, CW, y);
  y = escreverParagrafo(
    pdf,
    `CONTRATADO(A): ${advogado.nome || "___________"}, advogado(a) inscrito(a) na ${oab || "OAB"}${advogado.escritorio ? `, com escritório profissional em ${advogado.escritorio}` : ""}${advogado.enderecoEscritorio ? `, situado em ${advogado.enderecoEscritorio}` : ""}.`,
    M, CW, y
  );

  y = escreverParagrafo(pdf, "Pelo presente instrumento particular de contrato de prestação de serviços advocatícios, as partes acima identificadas têm entre si justo e contratado o seguinte:", M, CW, y);

  y = escreverParagrafo(pdf, "CLÁUSULA 1ª – DO OBJETO", M, CW, y, true);
  y = escreverParagrafo(
    pdf,
    `O(A) CONTRATADO(A) prestará serviços advocatícios ao(à) CONTRATANTE relativos a ${opts.objeto || "ação judicial a ser ajuizada"}${opts.processoNumero ? `, processo nº ${opts.processoNumero}` : ""}.`,
    M, CW, y
  );

  y = escreverParagrafo(pdf, "CLÁUSULA 2ª – DOS HONORÁRIOS", M, CW, y, true);
  y = escreverParagrafo(
    pdf,
    `Pelos serviços prestados, o(a) CONTRATANTE pagará ao(à) CONTRATADO(A) honorários advocatícios no percentual de ${percentual}% (${percentual === 30 ? "trinta" : percentual} por cento) sobre o proveito econômico obtido, a título de honorários contratuais, sem prejuízo dos honorários de sucumbência que vierem a ser fixados judicialmente, os quais pertencerão integralmente ao(à) CONTRATADO(A).`,
    M, CW, y
  );

  y = escreverParagrafo(pdf, "CLÁUSULA 3ª – DAS OBRIGAÇÕES", M, CW, y, true);
  y = escreverParagrafo(pdf, "O(A) CONTRATADO(A) obriga-se a empregar todos os esforços técnicos para a boa condução da causa, mantendo o(a) CONTRATANTE informado(a) sobre o andamento processual.", M, CW, y);

  y = escreverParagrafo(pdf, "CLÁUSULA 4ª – DO FORO", M, CW, y, true);
  y = escreverParagrafo(pdf, "Fica eleito o foro do domicílio do(a) CONTRATANTE para dirimir quaisquer dúvidas oriundas do presente contrato.", M, CW, y);

  y = escreverParagrafo(pdf, "E por estarem assim justos e contratados, firmam o presente instrumento.", M, CW, y);

  escreverAssinaturas(pdf, PW, M, CW, y, [
    { label: "Contratante", nome: cliente.nome },
    { label: "Contratado(a)", nome: advogado.nome || "", sub: oab },
  ]);

  rodape(pdf, M, PW, "Contrato de Honorários");
  pdf.save(`contrato_honorarios_${cliente.nome.replace(/\s+/g, "_").toLowerCase()}.pdf`);
}
