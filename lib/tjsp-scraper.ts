// Busca e interpreta a Nova Tabela Prática do TJSP (Lei nº 14.905/2024) diretamente do PDF
// oficial publicado em tjsp.jus.br. Diferente de INPC/IPCA-E/IPCA/Selic, essa tabela não tem
// série no SGS do Banco Central — o TJSP publica seu próprio fator acumulado em PDF, atualizado
// mensalmente na mesma URL (a página "hub" abaixo é reescrita todo mês, o link do arquivo pode
// mudar de "codigo").
import { PDFParse } from "pdf-parse";

const HUB_URL =
  "https://www.tjsp.jus.br/PrimeiraInstancia/CalculosJudiciais/Comunicado?codigoComunicado=2524&pagina=1";

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

async function findTabelaPraticaUrl(): Promise<string> {
  const res = await fetch(HUB_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`TJSP (página de índices): HTTP ${res.status}`);
  const html = await res.text();
  const m = html.match(/<a[^>]+href="([^"]+FileFetch[^"]+)"[^>]*title="[^"]*14\.905[^"]*"/i);
  if (!m) {
    throw new Error(
      "TJSP: link da Tabela Prática (Lei 14.905/2024) não encontrado na página oficial — o layout pode ter mudado"
    );
  }
  return m[1].replace(/&amp;/g, "&");
}

// Interpreta o texto extraído do PDF oficial. A tabela é composta de vários blocos: uma linha de
// cabeçalho só com dígitos e espaços (ex: "2 0 2 1 2 0 2 2 2 0 2 3 ..."), seguida de até 12 linhas
// JAN..DEZ com um fator por coluna/ano. Só o ÚLTIMO bloco (mais recente) interessa aqui.
export function parseTabelaPratica(text: string): Record<string, number> {
  const lines = text.split("\n").map((l) => l.trim());

  const headerIdxs: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    if (/^[\d\s]+$/.test(l)) {
      const digits = l.replace(/\s/g, "");
      if (digits.length >= 4 && digits.length % 4 === 0) headerIdxs.push(i);
    }
  }
  if (headerIdxs.length === 0) {
    throw new Error("TJSP: nenhum cabeçalho de ano reconhecido no PDF — o layout da tabela pode ter mudado");
  }

  const headerIdx = headerIdxs[headerIdxs.length - 1];
  const digits = lines[headerIdx].replace(/\s/g, "");
  const years: number[] = [];
  for (let i = 0; i < digits.length; i += 4) years.push(parseInt(digits.slice(i, i + 4), 10));

  const result: Record<string, number> = {};
  let mesIdx = 0;
  for (let i = headerIdx + 1; i < lines.length && mesIdx < 12; i++) {
    const l = lines[i];
    if (!l || /^--\s*\d+\s*of\s*\d+\s*--$/.test(l)) continue; // linha em branco/marcador de página do pdf-parse

    const mes = MESES[mesIdx];
    if (!l.startsWith(mes + " ")) break; // sequência JAN..DEZ quebrou — parar por segurança

    const tokens = l.slice(mes.length).trim().split(/\s+/);
    tokens.forEach((tok, colIdx) => {
      const year = years[colIdx];
      if (year === undefined) return;
      const value = parseFloat(tok.replace(/\./g, "").replace(",", "."));
      if (!isNaN(value)) result[`${year}-${String(mesIdx + 1).padStart(2, "0")}`] = value;
    });
    mesIdx++;
  }

  if (Object.keys(result).length === 0) {
    throw new Error("TJSP: cabeçalho de ano encontrado, mas nenhuma linha JAN..DEZ pôde ser lida em seguida");
  }
  return result;
}

export async function fetchTjspTabelaPratica(): Promise<Record<string, number>> {
  const url = await findTabelaPraticaUrl();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`TJSP (PDF da tabela): HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const parser = new PDFParse({ data: buf });
  try {
    const { text } = await parser.getText();
    return parseTabelaPratica(text);
  } finally {
    await parser.destroy();
  }
}

// Só estende a série para a frente (meses novos). Nunca sobrescreve um mês já salvo — se um valor
// parseado para um mês já conhecido divergir do que já está gravado, algo mudou na tabela do TJSP
// (layout, colunas) e é mais seguro abortar do que arriscar gravar um fator errado.
export function mergeTjspForward(
  current: Record<string, number>,
  parsed: Record<string, number>
): Record<string, number> {
  const currentKeys = Object.keys(current).sort();
  const lastCurrentKey = currentKeys.at(-1);
  const anchors = currentKeys.slice(-3);

  for (const k of anchors) {
    if (k in parsed && Math.abs(parsed[k] - current[k]) > 0.0005) {
      throw new Error(
        `TJSP: fator parseado para ${k} (${parsed[k]}) diverge do valor já confirmado (${current[k]}) — abortando merge`
      );
    }
  }

  const merged = { ...current };
  for (const [k, v] of Object.entries(parsed)) {
    if (!lastCurrentKey || k > lastCurrentKey) merged[k] = v;
  }
  return merged;
}
