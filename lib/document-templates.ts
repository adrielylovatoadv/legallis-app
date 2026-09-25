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
    a: pick("a", "o", "o(a)"),
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

// ── Modelos (texto editável) ─────────────────────────────────────────────────
//
// Cada documento é um texto com marcadores. O escritório pode salvar o próprio texto
// (Configurações > Empresa > Modelos de documentos); sem texto próprio vale o padrão abaixo.
//
// Sintaxe (blocos separados por linha em branco):
//   # Título              → título centralizado em negrito
//   > texto               → parágrafo centralizado
//   | texto               → parágrafo justificado sem recuo
//   texto                 → parágrafo justificado com recuo
//   **negrito**           → trecho em negrito
//   [assinatura]          → linha de assinatura do cliente
//   [assinatura-dupla]    → assinatura do cliente e do(s) advogado(s)
//   [testemunhas]         → campos de duas testemunhas
// Marcadores {{...}} são substituídos pelos dados; "(a)" concorda com o gênero do cliente.

export type TipoDocumento = "procuracao" | "contrato" | "isencao_ir" | "hipossuficiencia";

export const TIPOS_DOCUMENTO: Array<{ tipo: TipoDocumento; label: string }> = [
  { tipo: "procuracao", label: "Procuração" },
  { tipo: "contrato", label: "Contrato de Honorários" },
  { tipo: "isencao_ir", label: "Declaração de Isenção de IR" },
  { tipo: "hipossuficiencia", label: "Declaração de Hipossuficiência" },
];

export const MARCADORES_MODELO: Array<{ chave: string; descricao: string }> = [
  { chave: "{{cliente}}", descricao: "Nome do cliente" },
  { chave: "{{qualificacao_cliente}}", descricao: "Nome, nacionalidade, estado civil, CPF/CNPJ e endereço do cliente" },
  { chave: "{{qualificacao_advogados}}", descricao: "Nome, OAB e endereço do(s) advogado(s)" },
  { chave: "{{advogados}}", descricao: "Nome(s) do(s) advogado(s)" },
  { chave: "{{oabs}}", descricao: "OAB do(s) advogado(s)" },
  { chave: "{{cidade}}", descricao: "Cidade/UF do escritório (local e foro)" },
  { chave: "{{data}}", descricao: "Data de hoje por extenso" },
  { chave: "{{local_data}}", descricao: "Cidade/UF e data" },
  { chave: "{{cpf}} {{cnpj}} {{rg}}", descricao: "Documentos do cliente" },
  { chave: "{{contratado}}", descricao: "CONTRATADA ou CONTRATADO (gênero do advogado)" },
  { chave: "{{advogado}}", descricao: "advogada ou advogado" },
  { chave: "{{o_cliente}} {{do_cliente}} {{pelo_cliente}}", descricao: "Artigos conforme o gênero do cliente" },
  { chave: "{{o_advogado}} {{do_advogado}} {{ao_advogado}} {{pelo_advogado}}", descricao: "Artigos conforme o gênero do advogado" },
  { chave: "{{pct_exito}} {{pct_exito_extenso}} {{pct_acordo}} {{pct_acordo_extenso}}", descricao: "Percentuais de honorários (35% e 10%)" },
];

const PROCURACAO_PADRAO = `# PROCURAÇÃO "AD JUDICIA"

{{qualificacao_cliente}}, nomeia e constitui {{qualificacao_advogados}}, a quem confere amplos poderes para o foro em geral, inclusive os da cláusula "ad judicia", e mais os poderes de desistir, transigir, firmar compromisso, acordar, receber e dar quitação, substabelecer, com ou sem reservas de iguais poderes, para em qualquer juízo, instância, ou tribunal, representar e defender os direitos e interesses do(a) outorgante no foro em geral, podendo propor contra quem de direito as ações competentes, defendê-lo(a) nas que lhe forem movidas, seguindo umas e outras até final decisão, usando dos recursos legais, produzindo provas, podendo ainda, requerer em seu nome pedido de Assistência Judiciária Gratuita, variar de ações, requerer medidas preventivas, preparatórias e incidentes, praticar todos os atos necessários ao bom, fiel e cabal cumprimento deste mandato em todos os processos judiciais onde seja parte, tanto autor(a) como ré(u) em especial, para

> {{local_data}}

[assinatura]`;

const CONTRATO_PADRAO = `# CONTRATO DE PRESTAÇÃO DE SERVIÇOS E HONORÁRIOS ADVOCATÍCIOS

| Pelo presente instrumento particular e na melhor forma de direito, as partes, de um lado;

| CONTRATANTE: {{qualificacao_cliente}};

| E, de outro lado;

| {{contratado}}: {{qualificacao_advogados}};

| Sendo {{o_cliente}} CONTRATANTE e {{o_advogado}} {{contratado}} doravante designados, individualmente, como "Parte" e, em conjunto, como "Partes"; Resolvem, de comum acordo, firmar o presente Contrato de Prestação de Serviços e Honorários Advocatícios ("Contrato"), mediante as seguintes cláusulas e condições:

**Cláusula 1ª:** {{O_CLIENTE}} CONTRATANTE, por meio do presente Contrato, contrata os serviços profissionais {{do_advogado}} {{contratado}} para tentativas administrativas e para ingressar com ação judicial de ___________

**Cláusula 2ª:** Não haverá remuneração inicial para início dos trabalhos.

**Parágrafo primeiro:** Os honorários de êxito, serão no importe de {{pct_exito}}% ({{pct_exito_extenso}} por cento) sobre o proveito econômico efetivamente obtido, compreendendo indenização por danos morais e materiais, repetição de indébito, exclusão de débitos ou negativações e qualquer outra vantagem patrimonial reconhecida em favor {{do_cliente}} CONTRATANTE.

**Parágrafo segundo:** Em caso de acordo extrajudicial celebrado antes ou depois do ajuizamento da ação ou da instauração do procedimento administrativo referidos no parágrafo primeiro, os honorários corresponderão a {{pct_acordo}}% ({{pct_acordo_extenso}} por cento) adicionais sobre o proveito econômico obtido, cumulativos com o percentual do parágrafo primeiro. Esta cumulatividade não se aplica aos casos de negociação de dívidas.

**Parágrafo terceiro:** Nos casos de negociação de dívidas, renegociação extrajudicial ou defesa em execuções, os honorários corresponderão a {{pct_exito}}% ({{pct_exito_extenso}} por cento) sobre o proveito econômico auferido {{pelo_cliente}} CONTRATANTE, entendido como a diferença entre o valor original da dívida, atualizado monetariamente, e o valor final pago ou reconhecido, incluindo reduções de principal, juros, multas e demais encargos.

**Parágrafo quarto:** Os honorários de sucumbência eventualmente fixados judicialmente em favor {{do_advogado}} {{contratado}} pertencem exclusivamente {{ao_advogado}} {{advogado}}, nos termos do art. 22 da Lei nº 8.906/94, sendo cumulativos e não compensáveis com os honorários contratuais ora pactuados.

**Parágrafo quinto:** Na hipótese de êxito parcial, os honorários contratuais incidirão proporcionalmente sobre o proveito econômico efetivamente obtido {{pelo_cliente}} CONTRATANTE.

**Cláusula 3ª:** As custas processuais, salários periciais, ônus sucumbenciais e demais despesas (viagens, fotocópias, taxas, certidões, registros, correspondência, honorários de correspondente etc.) serão totalmente suportadas {{pelo_cliente}} CONTRATANTE.

**Parágrafo único:** Se for o caso, haverá ressarcimento de despesas pagas {{pelo_advogado}} {{contratado}}.

**Cláusula 4ª:** Na hipótese de revogação do mandato {{pelo_cliente}} CONTRATANTE, os honorários serão devidos {{ao_advogado}} {{contratado}} proporcionalmente aos serviços já prestados até a data da revogação, independentemente do motivo alegado.

**Cláusula 5ª:** O presente Contrato configura, para todos os fins de Direito, título executivo extrajudicial líquido, certo e exigível, representando crédito privilegiado na falência, concurso de credores, insolvência civil e liquidação extrajudicial, podendo a execução dos honorários prosseguir nos mesmos autos em que tenham sido prestados os serviços ora contratados, nos termos do que dispõem o art. 24 da Lei 8.906/94 e o art. 784 do Código de Processo Civil (2015).

**Cláusula 6ª:** {{O_ADVOGADO}} {{contratado}} se obriga a prestar informações sobre o andamento do feito sempre que solicitado {{pelo_cliente}} CONTRATANTE.

**Cláusula 7ª:** {{O_CLIENTE}} CONTRATANTE fora orientado(a) {{pelo_advogado}} {{contratado}} sobre a obrigação de manter {{esta_advogado}} informad{{a_advogado}} sobre seus endereços eletrônicos (e-mails) e comercial, além dos telefones para contato, dada a eventual necessidade de comunicação de intimações e providências necessárias cuja intimação é feita na pessoa dos advogados, assumindo a obrigação de, sempre que houver alteração dos mesmos, informar {{o_advogado}} {{contratado}} por escrito dos novos endereços (físico e eletrônico) e telefones.

**Parágrafo único:** {{O_CLIENTE}} CONTRATANTE concorda que, ao manter seus dados de contato atualizados, estes servirão para receber qualquer informação e notificação por parte {{do_advogado}} {{contratado}}, inclusive sobre renúncia de mandato, sendo que, neste caso, {{o_advogado}} {{Advogado}} ficará responsável pelo processo até o prazo de 10 (dez) dias após o envio do e-mail, carta ou qualquer outra forma de comunicação possível.

**Cláusula 8ª:** As Partes elegem o Foro da Comarca de {{cidade}}, por mais privilegiado que outro possa ser, a fim de dirimir eventuais dúvidas originárias deste Contrato.

| E por estarem as Partes firmes e acordadas, assinam o presente, para que produza um só efeito de direito.

> {{local_data}}

[assinatura-dupla]

[testemunhas]`;

const ISENCAO_IR_PADRAO = `# DECLARAÇÃO DE ISENÇÃO DO IMPOSTO DE RENDA PESSOA FÍSICA (IRPF)

{{qualificacao_cliente}}, DECLARO ser isento(a) da apresentação da Declaração do Imposto de Renda Pessoa Física (DIRPF) por não incorrer em nenhuma das hipóteses de obrigatoriedade estabelecidas pelas Instruções Normativas (IN) da Receita Federal do Brasil (RFB). Esta declaração está em conformidade com a IN RFB nº 1548/2015 e a Lei nº 7.115/83. Declaro ainda, sob as penas da lei, serem verdadeiras todas as informações acima prestadas.

> {{local_data}}

[assinatura]`;

const HIPOSSUFICIENCIA_PADRAO = `# DECLARAÇÃO DE HIPOSSUFICIÊNCIA

{{qualificacao_cliente}}; declaro, sob as penas da lei, para fins de obtenção dos benefícios da justiça gratuita, que não possuo condições financeiras de arcar com as custas processuais e demais despesas do processo, sem prejuízo do meu próprio sustento ou de minha família.

Por ser a expressão da verdade, firmo a presente declaração para que produza os efeitos legais cabíveis.

> {{local_data}}

[assinatura]`;

export const MODELOS_PADRAO: Record<TipoDocumento, string> = {
  procuracao: PROCURACAO_PADRAO,
  contrato: CONTRATO_PADRAO,
  isencao_ir: ISENCAO_IR_PADRAO,
  hipossuficiencia: HIPOSSUFICIENCIA_PADRAO,
};

const PREFIXO_ARQUIVO: Record<TipoDocumento, string> = {
  procuracao: "procuracao",
  contrato: "contrato_honorarios",
  isencao_ir: "declaracao_isencao_ir",
  hipossuficiencia: "declaracao_hipossuficiencia",
};

export interface OpcoesDocumento {
  /** Texto próprio do escritório; sem ele vale o modelo padrão. */
  modelo?: string;
  percentualExito?: number;
  percentualAcordo?: number;
}

const EXTENSO: Record<number, string> = { 35: "trinta e cinco", 10: "dez" };
const extenso = (n: number) => EXTENSO[n] ?? String(n);

function variaveisDoModelo(cliente: ClienteDoc, advogados: AdvogadoDoc[], opts: OpcoesDocumento): Record<string, string> {
  const cli = artigos(generoCliente(cliente));
  const adv = artigos(generoAdvogados(advogados));
  const cidade = advogados.find(a => a.cidadeEscritorio)?.cidadeEscritorio;
  const pExito = opts.percentualExito ?? 35;
  const pAcordo = opts.percentualAcordo ?? 10;
  return {
    cliente: cliente.nome,
    cpf: cliente.cpf || "___________",
    cnpj: cliente.cnpj || "___________",
    rg: cliente.rg || "___________",
    qualificacao_cliente: qualificacaoCliente(cliente),
    qualificacao_advogados: qualificacaoAdvogados(advogados),
    advogados: nomesAdvogados(advogados),
    oabs: oabsAdvogadosResumo(advogados),
    cidade: cidade || "___________",
    data: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
    local_data: localEData(cidade),
    contratante: "CONTRATANTE",
    contratado: adv.contratado,
    advogado: adv.advogado,
    o_cliente: cli.o, do_cliente: cli.do, ao_cliente: cli.ao, pelo_cliente: cli.pelo,
    o_advogado: adv.o, do_advogado: adv.do, ao_advogado: adv.ao, pelo_advogado: adv.pelo,
    esta_advogado: adv.esta, a_advogado: adv.a,
    pct_exito: String(pExito), pct_exito_extenso: extenso(pExito),
    pct_acordo: String(pAcordo), pct_acordo_extenso: extenso(pAcordo),
  };
}

// {{chave}} minúscula → valor; {{CHAVE}} → MAIÚSCULAS; {{Chave}} → primeira maiúscula.
// Marcador desconhecido fica visível no documento para o usuário perceber o erro de digitação.
function substituirMarcadores(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\{\{\s*([A-Za-z_]+)\s*\}\}/g, (todo, chave: string) => {
    const valor = vars[chave.toLowerCase()];
    if (valor === undefined) return todo;
    if (chave === chave.toUpperCase()) return valor.toUpperCase();
    if (chave[0] === chave[0].toUpperCase()) return valor.charAt(0).toUpperCase() + valor.slice(1);
    return valor;
  });
}

function runsComNegrito(mod: DocxModule, texto: string, size: number) {
  return texto.split(/\*\*(.+?)\*\*/g).map((parte, i) => new mod.TextRun({ text: parte, bold: i % 2 === 1, size }));
}

function renderizarModelo(mod: DocxModule, tipo: TipoDocumento, modelo: string, cliente: ClienteDoc, advogados: AdvogadoDoc[], vars: Record<string, string>) {
  const compacto = tipo === "contrato";
  // "(a)" do texto concorda com o cliente; feito antes de substituir os marcadores para
  // não mexer nos "(a)" que ficam quando o gênero do advogado não foi informado.
  const texto = substituirMarcadores(flexionar(modelo.replace(/\r\n?/g, "\n"), generoCliente(cliente)), vars);
  const blocos = texto.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const children: unknown[] = [];

  for (const bloco of blocos) {
    const linha = bloco.replace(/\n/g, " ");
    if (linha === "[assinatura]") {
      children.push(...blocoAssinaturaUnica(mod, cliente.nome));
    } else if (linha === "[assinatura-dupla]") {
      children.push(new mod.Paragraph({ spacing: { before: 200 }, children: [] }));
      children.push(blocoAssinaturaDupla(mod,
        { nome: cliente.nome, sub: cliente.tipo_pessoa === "juridica" ? `CNPJ: ${cliente.cnpj || ""}` : `CPF: ${cliente.cpf || ""}` },
        { nome: nomesAdvogados(advogados), sub: oabsAdvogadosResumo(advogados) }
      ));
    } else if (linha === "[testemunhas]") {
      children.push(...blocoTestemunhas(mod));
    } else if (linha.startsWith("# ")) {
      children.push(paragrafoTitulo(mod, linha.slice(2)));
    } else {
      const centro = linha.startsWith("> ");
      const semRecuo = linha.startsWith("| ");
      const conteudo = centro || semRecuo ? linha.slice(2) : linha;
      const alignment = centro ? mod.AlignmentType.CENTER : mod.AlignmentType.JUSTIFIED;
      const indent = centro || semRecuo ? undefined : { firstLine: 1134 };
      children.push(new mod.Paragraph({
        alignment,
        indent,
        spacing: compacto ? undefined : { line: 360, lineRule: "auto", after: 200 },
        children: runsComNegrito(mod, conteudo, 24),
      }));
    }
  }
  return children;
}

export async function gerarDocumento(tipo: TipoDocumento, cliente: ClienteDoc, advogados: AdvogadoDoc[], opts: OpcoesDocumento = {}) {
  const mod = await criarDoc(await import("docx"));
  const modelo = opts.modelo?.trim() ? opts.modelo : MODELOS_PADRAO[tipo];
  const vars = variaveisDoModelo(cliente, advogados, opts);
  const children = renderizarModelo(mod, tipo, modelo, cliente, advogados, vars);
  await gerarEBaixar(mod, children, nomeArquivoDe(cliente.nome, PREFIXO_ARQUIVO[tipo]), tipo === "contrato" ? PAGINA_CONTRATO : PAGINA);
}

export const generateProcuracaoDocx = (c: ClienteDoc, a: AdvogadoDoc[], o?: OpcoesDocumento) => gerarDocumento("procuracao", c, a, o);
export const generateContratoHonorariosDocx = (c: ClienteDoc, a: AdvogadoDoc[], o?: OpcoesDocumento) => gerarDocumento("contrato", c, a, o);
export const generateDeclaracaoIsencaoIRDocx = (c: ClienteDoc, a: AdvogadoDoc[], o?: OpcoesDocumento) => gerarDocumento("isencao_ir", c, a, o);
export const generateDeclaracaoHipossuficienciaDocx = (c: ClienteDoc, a: AdvogadoDoc[], o?: OpcoesDocumento) => gerarDocumento("hipossuficiencia", c, a, o);
