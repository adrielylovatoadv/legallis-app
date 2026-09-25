// Geração de modelos de documento (Procuração, Contrato de Honorários, Declaração
// de Isenção de IR, Declaração de Hipossuficiência) em .docx, com dados mesclados
// do cliente/processo/advogado. Estrutura e texto seguem os modelos reais usados
// pelo escritório (fornecidos como referência), mantendo a mesma redação e formatação.
// Os marcadores de gênero "(a)" são flexionados conforme o gênero do cliente
// (cadastro > Tratamento) e o sexo de cada advogado (Configurações > Perfil).

import { flexionar, generoDoGrupo, normalizarGenero, type Genero } from "@/lib/genero";

export interface AdvogadoDoc {
  nome?: string;
  sexo?: string;
  oab?: string;
  estado?: string;
  oabs?: Array<{ estado: string; numero: string }>;
  escritorio?: string;
  enderecoEscritorio?: string;
  cidadeEscritorio?: string;
}

export interface ClienteDoc {
  nome: string;
  tratamento?: string;
  tipo_pessoa?: "fisica" | "juridica";
  cpf?: string;
  cnpj?: string;
  rg?: string;
  nacionalidade?: string;
  estado_civil?: string;
  profissao?: string;
  endereco?: string;
}

function formatOabs(adv: AdvogadoDoc): string {
  const lista = adv.oabs && adv.oabs.length > 0
    ? adv.oabs.map(o => `OAB/${o.estado} ${o.numero}`)
    : adv.oab
      ? [adv.estado ? `OAB/${adv.estado} ${adv.oab}` : `OAB ${adv.oab}`]
      : [];
  if (lista.length === 0) return "OAB ___________";
  if (lista.length === 1) return lista[0];
  return `${lista.slice(0, -1).join(", ")} e ${lista[lista.length - 1]}`;
}

function generoCliente(c: ClienteDoc): Genero | undefined {
  return c.tipo_pessoa === "juridica" ? undefined : normalizarGenero(c.tratamento);
}

function generoAdvogados(advs: AdvogadoDoc[]): Genero | undefined {
  return generoDoGrupo(advs.map(a => normalizarGenero(a.sexo)));
}

// Artigos/substantivos que concordam com o gênero. Sem gênero definido usam a forma "o(a)".
function artigos(g?: Genero) {
  const f = g === "feminino", m = g === "masculino";
  const pick = (fem: string, masc: string, neutro: string) => f ? fem : m ? masc : neutro;
  return {
    o: pick("a", "o", "o(a)"),
    do: pick("da", "do", "do(a)"),
    ao: pick("à", "ao", "ao(à)"),
    pelo: pick("pela", "pelo", "pelo(a)"),
    contratado: pick("CONTRATADA", "CONTRATADO", "CONTRATADO(A)"),
    advogado: pick("advogada", "advogado", "advogado(a)"),
    Advogado: pick("Advogada", "Advogado", "Advogado(a)"),
    esta: pick("esta", "este", "este(a)"),
  };
}

function qualificacaoCliente(c: ClienteDoc): string {
  if (c.tipo_pessoa === "juridica") {
    return `${c.nome}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${c.cnpj || "___________"}, com sede em ${c.endereco || "___________"}`;
  }
  const g = generoCliente(c);
  const partes = [c.nacionalidade || "brasileiro(a)", c.estado_civil, c.profissao].filter(Boolean).map(t => flexionar(t!, g));
  const rgParte = c.rg ? ` e do RG ${c.rg}` : "";
  return `${c.nome}, ${partes.join(", ")}, ${flexionar("portador(a)", g)} do CPF: ${c.cpf || "___________"}${rgParte}, ${flexionar("residente e domiciliado(a)", g)} na ${c.endereco || "___________"}`;
}

function qualificacaoAdvogado(adv: AdvogadoDoc): string {
  const escritorio = adv.enderecoEscritorio
    ? `, com escritório profissional, na ${adv.enderecoEscritorio}`
    : "";
  const qualif = flexionar("advogado(a), inscrito(a) na Ordem dos Advogados do Brasil", normalizarGenero(adv.sexo));
  return `${adv.nome || "___________"}, ${qualif} ${formatOabs(adv)}${escritorio}`;
}

function qualificacaoAdvogados(advs: AdvogadoDoc[]): string {
  const lista = advs.length > 0 ? advs : [{}];
  const textos = lista.map(qualificacaoAdvogado);
  if (textos.length === 1) return textos[0];
  return `${textos.slice(0, -1).join("; ")}; e ${textos[textos.length - 1]}`;
}

function nomesAdvogados(advs: AdvogadoDoc[]): string {
  const nomes = advs.map(a => a.nome || "___________");
  if (nomes.length <= 1) return nomes[0] || "___________";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

function oabsAdvogadosResumo(advs: AdvogadoDoc[]): string {
  return advs.map(formatOabs).join(" · ");
}

function localEData(cidade?: string): string {
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  return `${cidade || "___________"}, ${hoje}.`;
}

// ── Construção do documento (docx-js) ───────────────────────────────────────

type DocxModule = typeof import("docx");

async function criarDoc(mod: DocxModule) {
  return mod;
}

function paragrafoTitulo(mod: DocxModule, texto: string) {
  return new mod.Paragraph({
    alignment: mod.AlignmentType.CENTER,
    spacing: { after: 280 },
    children: [new mod.TextRun({ text: texto, bold: true, size: 26 })],
  });
}

function paragrafoTexto(mod: DocxModule, texto: string, opts: { indent?: boolean; bold?: boolean; align?: "center" | "justify" } = {}) {
  const { indent = true, bold = false, align = "justify" } = opts;
  return new mod.Paragraph({
    alignment: align === "center" ? mod.AlignmentType.CENTER : mod.AlignmentType.JUSTIFIED,
    spacing: { line: 360, lineRule: "auto", after: 200 },
    indent: indent ? { firstLine: 1134 } : undefined,
    children: [new mod.TextRun({ text: texto, bold, size: 24 })],
  });
}

function paragrafoCentralizado(mod: DocxModule, texto: string, bold = false) {
  return paragrafoTexto(mod, texto, { indent: false, bold, align: "center" });
}

// Parágrafos do contrato de honorários usam espaçamento simples (sem "after" nem
// entrelinha 1,5, ao contrário de paragrafoTexto) para caber em 2 páginas, igual
// ao modelo real do escritório (que não tem <w:spacing> nos parágrafos do corpo).
function paragrafoContrato(mod: DocxModule, texto: string, opts: { indent?: boolean; align?: "center" | "justify" } = {}) {
  const { indent = true, align = "justify" } = opts;
  return new mod.Paragraph({
    alignment: align === "center" ? mod.AlignmentType.CENTER : mod.AlignmentType.JUSTIFIED,
    indent: indent ? { firstLine: 1134 } : undefined,
    children: [new mod.TextRun({ text: texto, size: 24 })],
  });
}

function clausulaContrato(mod: DocxModule, rotulo: string, resto: string) {
  return new mod.Paragraph({
    alignment: mod.AlignmentType.JUSTIFIED,
    indent: { firstLine: 1134 },
    children: [
      new mod.TextRun({ text: rotulo, bold: true, size: 24 }),
      new mod.TextRun({ text: resto, size: 24 }),
    ],
  });
}

function blocoAssinaturaUnica(mod: DocxModule, nome: string, sublabel?: string) {
  const linhas = [
    new mod.Paragraph({ spacing: { before: 480, after: 0 }, alignment: mod.AlignmentType.CENTER,
      children: [new mod.TextRun({ text: "____________________________________________", size: 24 })] }),
    new mod.Paragraph({ alignment: mod.AlignmentType.CENTER,
      children: [new mod.TextRun({ text: nome, bold: true, size: 24 })] }),
  ];
  if (sublabel) {
    linhas.push(new mod.Paragraph({ alignment: mod.AlignmentType.CENTER,
      children: [new mod.TextRun({ text: sublabel, size: 20 })] }));
  }
  return linhas;
}

function blocoAssinaturaDupla(mod: DocxModule, esquerda: { nome: string; sub?: string }, direita: { nome: string; sub?: string }) {
  const coluna = (lado: { nome: string; sub?: string }) => [
    new mod.Paragraph({ alignment: mod.AlignmentType.CENTER, spacing: { before: 120 },
      children: [new mod.TextRun({ text: "________________________________", size: 22 })] }),
    new mod.Paragraph({ alignment: mod.AlignmentType.CENTER,
      children: [new mod.TextRun({ text: lado.nome, bold: true, size: 22 })] }),
    ...(lado.sub ? [new mod.Paragraph({ alignment: mod.AlignmentType.CENTER,
      children: [new mod.TextRun({ text: lado.sub, size: 18 })] })] : []),
  ];
  const semBorda = { style: mod.BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const bordas = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };
  return new mod.Table({
    width: { size: 9360, type: mod.WidthType.DXA },
    columnWidths: [4680, 4680],
    borders: bordas,
    rows: [new mod.TableRow({ children: [
      new mod.TableCell({ borders: bordas, width: { size: 4680, type: mod.WidthType.DXA }, children: coluna(esquerda) }),
      new mod.TableCell({ borders: bordas, width: { size: 4680, type: mod.WidthType.DXA }, children: coluna(direita) }),
    ] })],
  });
}

function blocoTestemunhas(mod: DocxModule) {
  const coluna = (rotulo: string) => [
    new mod.Paragraph({ alignment: mod.AlignmentType.CENTER, spacing: { before: 120 },
      children: [new mod.TextRun({ text: "________________________________", size: 22 })] }),
    new mod.Paragraph({ alignment: mod.AlignmentType.CENTER,
      children: [new mod.TextRun({ text: rotulo, bold: true, size: 22 })] }),
    new mod.Paragraph({ alignment: mod.AlignmentType.CENTER, children: [] }),
    new mod.Paragraph({ alignment: mod.AlignmentType.CENTER,
      children: [new mod.TextRun({ text: "Nome: _______________________________", size: 20 })] }),
    new mod.Paragraph({ alignment: mod.AlignmentType.CENTER,
      children: [new mod.TextRun({ text: "CPF: ______________", size: 20 })] }),
  ];
  const semBorda = { style: mod.BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const bordas = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };
  return [
    new mod.Paragraph({ spacing: { before: 400 },
      children: [new mod.TextRun({ text: "TESTEMUNHAS:", bold: true, size: 24 })] }),
    new mod.Paragraph({ spacing: { before: 200 }, children: [] }),
    new mod.Table({
      width: { size: 9360, type: mod.WidthType.DXA },
      columnWidths: [4680, 4680],
      borders: bordas,
      rows: [new mod.TableRow({ children: [
        new mod.TableCell({ borders: bordas, width: { size: 4680, type: mod.WidthType.DXA }, children: coluna("Testemunha 1") }),
        new mod.TableCell({ borders: bordas, width: { size: 4680, type: mod.WidthType.DXA }, children: coluna("Testemunha 2") }),
      ] })],
    }),
  ];
}

const PAGINA = {
  size: { width: 11906, height: 16838 }, // A4
  margin: { top: 1134, right: 1701, bottom: 1702, left: 1701 },
};

// Margens mais estreitas para o contrato de honorários caber em 2 folhas.
const PAGINA_CONTRATO = {
  size: { width: 11906, height: 16838 }, // A4
  margin: { top: 922, right: 1080, bottom: 738, left: 1080 },
};

async function gerarEBaixar(mod: DocxModule, children: unknown[], nomeArquivo: string, pagina: typeof PAGINA = PAGINA) {
  const doc = new mod.Document({
    styles: { default: { document: { run: { font: "Calibri", size: 24 } } } },
    sections: [{ properties: { page: pagina }, children: children as InstanceType<typeof mod.Paragraph>[] }],
  });
  const blob = await mod.Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeArquivo}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

function nomeArquivoDe(nome: string, prefixo: string) {
  return `${prefixo}_${nome.replace(/\s+/g, "_").toLowerCase()}`;
}

// ── Procuração "Ad Judicia" ──────────────────────────────────────────────────

export async function generateProcuracaoDocx(cliente: ClienteDoc, advogados: AdvogadoDoc[]) {
  const mod = await criarDoc(await import("docx"));
  const gc = generoCliente(cliente);

  const children = [
    paragrafoTitulo(mod, 'PROCURAÇÃO "AD JUDICIA"'),
    paragrafoTexto(mod,
      `${qualificacaoCliente(cliente)}, nomeia e constitui ${qualificacaoAdvogados(advogados)}` +
      flexionar(`, a quem confere amplos poderes para o foro em geral, inclusive os da cláusula "ad judicia", e mais os poderes de desistir, transigir, firmar compromisso, acordar, receber e dar quitação, substabelecer, com ou sem reservas de iguais poderes, para em qualquer juízo, instância, ou tribunal, representar e defender os direitos e interesses do(a) outorgante no foro em geral, podendo propor contra quem de direito as ações competentes, defendê-lo(a) nas que lhe forem movidas, seguindo umas e outras até final decisão, usando dos recursos legais, produzindo provas, podendo ainda, requerer em seu nome pedido de Assistência Judiciária Gratuita, variar de ações, requerer medidas preventivas, preparatórias e incidentes, praticar todos os atos necessários ao bom, fiel e cabal cumprimento deste mandato em todos os processos judiciais onde seja parte, tanto autor(a) como ré(u) em especial, para`, gc)
    ),
    paragrafoCentralizado(mod, localEData(advogados[0]?.cidadeEscritorio)),
    ...blocoAssinaturaUnica(mod, cliente.nome),
  ];

  await gerarEBaixar(mod, children, nomeArquivoDe(cliente.nome, "procuracao"));
}

// ── Contrato de Prestação de Serviços e Honorários Advocatícios ─────────────

export async function generateContratoHonorariosDocx(
  cliente: ClienteDoc,
  advogados: AdvogadoDoc[],
  opts: { percentualExito?: number; percentualAcordo?: number } = {}
) {
  const mod = await criarDoc(await import("docx"));
  const pExito = opts.percentualExito ?? 35;
  const pAcordo = opts.percentualAcordo ?? 10;
  const extenso = (n: number) => n === 35 ? "trinta e cinco" : n === 10 ? "dez" : String(n);
  const gc = generoCliente(cliente);
  const ga = generoAdvogados(advogados);
  const cli = artigos(gc);
  const adv = artigos(ga);
  const CONTRATADO = adv.contratado;

  const children = [
    paragrafoTitulo(mod, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS E HONORÁRIOS ADVOCATÍCIOS"),
    paragrafoContrato(mod, "Pelo presente instrumento particular e na melhor forma de direito, as partes, de um lado;", { indent: false }),
    paragrafoContrato(mod, `CONTRATANTE: ${qualificacaoCliente(cliente)};`, { indent: false }),
    paragrafoContrato(mod, "E, de outro lado;", { indent: false }),
    paragrafoContrato(mod, `${CONTRATADO}: ${qualificacaoAdvogados(advogados)};`, { indent: false }),
    paragrafoContrato(mod,
      `Sendo ${cli.o} CONTRATANTE e ${adv.o} ${CONTRATADO} doravante designados, individualmente, como "Parte" e, em conjunto, como "Partes"; Resolvem, de comum acordo, firmar o presente Contrato de Prestação de Serviços e Honorários Advocatícios ("Contrato"), mediante as seguintes cláusulas e condições:`,
      { indent: false }
    ),
    clausulaContrato(mod, "Cláusula 1ª:", ` ${cli.o.toUpperCase()} CONTRATANTE, por meio do presente Contrato, contrata os serviços profissionais ${adv.do} ${CONTRATADO} para tentativas administrativas e para ingressar com ação judicial de ___________`),
    clausulaContrato(mod, "Cláusula 2ª:", " Não haverá remuneração inicial para início dos trabalhos."),
    clausulaContrato(mod, "Parágrafo primeiro:", ` Os honorários de êxito, serão no importe de ${pExito}% (${extenso(pExito)} por cento) sobre o proveito econômico efetivamente obtido, compreendendo indenização por danos morais e materiais, repetição de indébito, exclusão de débitos ou negativações e qualquer outra vantagem patrimonial reconhecida em favor ${cli.do} CONTRATANTE.`),
    clausulaContrato(mod, "Parágrafo segundo:", ` Em caso de acordo extrajudicial celebrado antes ou depois do ajuizamento da ação ou da instauração do procedimento administrativo referidos no parágrafo primeiro, os honorários corresponderão a ${pAcordo}% (${extenso(pAcordo)} por cento) adicionais sobre o proveito econômico obtido, cumulativos com o percentual do parágrafo primeiro. Esta cumulatividade não se aplica aos casos de negociação de dívidas.`),
    clausulaContrato(mod, "Parágrafo terceiro:", ` Nos casos de negociação de dívidas, renegociação extrajudicial ou defesa em execuções, os honorários corresponderão a ${pExito}% (${extenso(pExito)} por cento) sobre o proveito econômico auferido ${cli.pelo} CONTRATANTE, entendido como a diferença entre o valor original da dívida, atualizado monetariamente, e o valor final pago ou reconhecido, incluindo reduções de principal, juros, multas e demais encargos.`),
    clausulaContrato(mod, "Parágrafo quarto:", ` Os honorários de sucumbência eventualmente fixados judicialmente em favor ${adv.do} ${CONTRATADO} pertencem exclusivamente ${adv.ao} ${adv.advogado}, nos termos do art. 22 da Lei nº 8.906/94, sendo cumulativos e não compensáveis com os honorários contratuais ora pactuados.`),
    clausulaContrato(mod, "Parágrafo quinto:", ` Na hipótese de êxito parcial, os honorários contratuais incidirão proporcionalmente sobre o proveito econômico efetivamente obtido ${cli.pelo} CONTRATANTE.`),
    clausulaContrato(mod, "Cláusula 3ª:", ` As custas processuais, salários periciais, ônus sucumbenciais e demais despesas (viagens, fotocópias, taxas, certidões, registros, correspondência, honorários de correspondente etc.) serão totalmente suportadas ${cli.pelo} CONTRATANTE.`),
    clausulaContrato(mod, "Parágrafo único:", ` Se for o caso, haverá ressarcimento de despesas pagas ${adv.pelo} ${CONTRATADO}.`),
    clausulaContrato(mod, "Cláusula 4ª:", ` Na hipótese de revogação do mandato ${cli.pelo} CONTRATANTE, os honorários serão devidos ${adv.ao} ${CONTRATADO} proporcionalmente aos serviços já prestados até a data da revogação, independentemente do motivo alegado.`),
    clausulaContrato(mod, "Cláusula 5ª:", " O presente Contrato configura, para todos os fins de Direito, título executivo extrajudicial líquido, certo e exigível, representando crédito privilegiado na falência, concurso de credores, insolvência civil e liquidação extrajudicial, podendo a execução dos honorários prosseguir nos mesmos autos em que tenham sido prestados os serviços ora contratados, nos termos do que dispõem o art. 24 da Lei 8.906/94 e o art. 784 do Código de Processo Civil (2015)."),
    clausulaContrato(mod, "Cláusula 6ª:", ` ${adv.o.toUpperCase()} ${CONTRATADO} se obriga a prestar informações sobre o andamento do feito sempre que solicitado ${cli.pelo} CONTRATANTE.`),
    clausulaContrato(mod, "Cláusula 7ª:", ` ${cli.o.toUpperCase()} CONTRATANTE fora ${flexionar("orientado(a)", gc)} ${adv.pelo} ${CONTRATADO} sobre a obrigação de manter ${adv.esta} ${flexionar("informado(a)", ga)} sobre seus endereços eletrônicos (e-mails) e comercial, além dos telefones para contato, dada a eventual necessidade de comunicação de intimações e providências necessárias cuja intimação é feita na pessoa dos advogados, assumindo a obrigação de, sempre que houver alteração dos mesmos, informar ${adv.o} ${CONTRATADO} por escrito dos novos endereços (físico e eletrônico) e telefones.`),
    clausulaContrato(mod, "Parágrafo único:", ` ${cli.o.toUpperCase()} CONTRATANTE concorda que, ao manter seus dados de contato atualizados, estes servirão para receber qualquer informação e notificação por parte ${adv.do} ${CONTRATADO}, inclusive sobre renúncia de mandato, sendo que, neste caso, ${adv.o} ${adv.Advogado} ficará responsável pelo processo até o prazo de 10 (dez) dias após o envio do e-mail, carta ou qualquer outra forma de comunicação possível.`),
    clausulaContrato(mod, "Cláusula 8ª:", ` As Partes elegem o Foro da Comarca de ${advogados[0]?.cidadeEscritorio || "___________"}, por mais privilegiado que outro possa ser, a fim de dirimir eventuais dúvidas originárias deste Contrato.`),
    paragrafoContrato(mod, "E por estarem as Partes firmes e acordadas, assinam o presente, para que produza um só efeito de direito.", { indent: false }),
    paragrafoContrato(mod, localEData(advogados[0]?.cidadeEscritorio), { indent: false, align: "center" }),
    new mod.Paragraph({ spacing: { before: 200 }, children: [] }),
    blocoAssinaturaDupla(mod,
      { nome: cliente.nome, sub: cliente.tipo_pessoa === "juridica" ? `CNPJ: ${cliente.cnpj || ""}` : `CPF: ${cliente.cpf || ""}` },
      { nome: nomesAdvogados(advogados), sub: oabsAdvogadosResumo(advogados) }
    ),
    ...blocoTestemunhas(mod),
  ];

  await gerarEBaixar(mod, children, nomeArquivoDe(cliente.nome, "contrato_honorarios"), PAGINA_CONTRATO);
}

// ── Declaração de Isenção do Imposto de Renda ────────────────────────────────

export async function generateDeclaracaoIsencaoIRDocx(cliente: ClienteDoc, advogados: AdvogadoDoc[]) {
  const mod = await criarDoc(await import("docx"));
  const gc = generoCliente(cliente);

  const children = [
    paragrafoTitulo(mod, "DECLARAÇÃO DE ISENÇÃO DO IMPOSTO DE RENDA PESSOA FÍSICA (IRPF)"),
    paragrafoTexto(mod,
      `${qualificacaoCliente(cliente)}, DECLARO ser ${flexionar("isento(a)", gc)} da apresentação da Declaração do Imposto de Renda Pessoa Física (DIRPF) por não incorrer em nenhuma das hipóteses de obrigatoriedade estabelecidas pelas Instruções Normativas (IN) da Receita Federal do Brasil (RFB). Esta declaração está em conformidade com a IN RFB nº 1548/2015 e a Lei nº 7.115/83. Declaro ainda, sob as penas da lei, serem verdadeiras todas as informações acima prestadas.`
    ),
    paragrafoCentralizado(mod, localEData(advogados[0]?.cidadeEscritorio)),
    ...blocoAssinaturaUnica(mod, cliente.nome),
  ];

  await gerarEBaixar(mod, children, nomeArquivoDe(cliente.nome, "declaracao_isencao_ir"));
}

// ── Declaração de Hipossuficiência ───────────────────────────────────────────

export async function generateDeclaracaoHipossuficienciaDocx(cliente: ClienteDoc, advogados: AdvogadoDoc[]) {
  const mod = await criarDoc(await import("docx"));

  const children = [
    paragrafoTitulo(mod, "DECLARAÇÃO DE HIPOSSUFICIÊNCIA"),
    paragrafoTexto(mod,
      `${qualificacaoCliente(cliente)}; declaro, sob as penas da lei, para fins de obtenção dos benefícios da justiça gratuita, que não possuo condições financeiras de arcar com as custas processuais e demais despesas do processo, sem prejuízo do meu próprio sustento ou de minha família.`
    ),
    paragrafoTexto(mod, "Por ser a expressão da verdade, firmo a presente declaração para que produza os efeitos legais cabíveis."),
    paragrafoCentralizado(mod, localEData(advogados[0]?.cidadeEscritorio)),
    ...blocoAssinaturaUnica(mod, cliente.nome),
  ];

  await gerarEBaixar(mod, children, nomeArquivoDe(cliente.nome, "declaracao_hipossuficiencia"));
}
