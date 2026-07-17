// Heurística para sinalizar se uma publicação/intimação capturada tende a abrir prazo — não
// substitui a leitura do teor completo, só ajuda a priorizar o que revisar primeiro.

export type SinalPrazo = "sim" | "nao" | "revisar";

export interface ClassificacaoPrazo {
  sinal: SinalPrazo;
  motivo: string;
}

// Tipos de comunicação do DJEN que são só registro/ciência, sem ato que abra prazo.
const TIPOS_SEM_PRAZO = new Set(["Lista de distribuição"]);

// Expressões que costumam acompanhar um ato com prazo (citação, intimação para manifestação,
// recurso, impugnação etc.), independentemente do tipoComunicacao informado pelo tribunal.
const REGEX_PRAZO = /\bprazo de\s*\d+|\bno prazo\b|manifest(e|ar)-se|contesta[çc][ãa]o|conteste|\brecurso\b|embargos|cumpra-se|intime-se|cite-se|impugna[çc][ãa]o/i;

// Entidades HTML mais comuns no teor vindo do DJEN (acentuação e pontuação em pt-BR).
const HTML_ENTIDADES: Record<string, string> = {
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  acirc: "â", ecirc: "ê", ocirc: "ô", Acirc: "Â", Ecirc: "Ê", Ocirc: "Ô",
  atilde: "ã", otilde: "õ", Atilde: "Ã", Otilde: "Õ",
  agrave: "à", Agrave: "À", ccedil: "ç", Ccedil: "Ç",
  ordm: "º", ordf: "ª", deg: "°", sect: "§", nbsp: " ",
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ndash: "–", mdash: "—",
};

function limparTexto(texto: string): string {
  return texto
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, nome) => HTML_ENTIDADES[nome] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

export function resumoTexto(texto?: string, max = 220): string {
  if (!texto) return "";
  const limpo = limparTexto(texto);
  return limpo.length > max ? `${limpo.slice(0, max).trimEnd()}…` : limpo;
}

export function classificarPrazo(pub: { tipoComunicacao?: string; texto?: string }): ClassificacaoPrazo {
  const tipo = pub.tipoComunicacao ?? "";
  const texto = limparTexto(pub.texto ?? "");

  if (TIPOS_SEM_PRAZO.has(tipo)) {
    return { sinal: "nao", motivo: "Lista de distribuição: apenas registra o processo, sem ato que abra prazo." };
  }
  if (REGEX_PRAZO.test(texto)) {
    return { sinal: "sim", motivo: "O teor menciona prazo/ato processual — confira o prazo indicado no texto." };
  }
  if (tipo === "Citação" || tipo === "Intimação" || tipo === "Edital") {
    return { sinal: "revisar", motivo: `${tipo} costuma abrir prazo — revise o teor completo para confirmar.` };
  }
  return { sinal: "revisar", motivo: "Não identificamos automaticamente — revise o teor para confirmar se gera prazo." };
}
