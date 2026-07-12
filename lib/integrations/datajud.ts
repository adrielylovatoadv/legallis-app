// DataJud (CNJ) — base pública de metadados processuais, organizada por tribunal (cada
// tribunal tem seu próprio índice/endpoint, ex: api_publica_tjsp, api_publica_trf1...).
// Usado aqui como fonte complementar ao DJEN (lib/integrations/djen.ts): o DJEN traz a
// publicação/intimação por OAB, o DataJud enriquece com metadados do processo (classe,
// assunto, movimentações, órgão julgador) quando já se tem o número do processo.
//
// A chave pública é divulgada pelo próprio CNJ em https://datajud-wiki.cnj.jus.br/api-publica/
// e é a mesma para todos os consumidores — mas o CNJ já trocou essa chave antes, então ela
// fica em env var (DATAJUD_API_KEY) em vez de hardcoded no código. Configurar em .env.local.

const TRIBUNAL_ALIASES: Record<string, string> = {
  TJSP: "tjsp", TJRJ: "tjrj", TJMG: "tjmg", TJRS: "tjrs", TJPR: "tjpr", TJSC: "tjsc",
  TJBA: "tjba", TJGO: "tjgo", TJDFT: "tjdft", TJPE: "tjpe", TJCE: "tjce", TJES: "tjes",
  TRF1: "trf1", TRF2: "trf2", TRF3: "trf3", TRF4: "trf4", TRF5: "trf5", TRF6: "trf6",
  TRT1: "trt1", TRT2: "trt2", TRT15: "trt15",
  TST: "tst", STJ: "stj",
};

export interface DatajudMovimento {
  nome?: string;
  dataHora?: string;
  complementosTabelados?: unknown[];
}

export interface DatajudProcesso {
  numeroProcesso: string;
  classe?: { nome?: string };
  orgaoJulgador?: { nome?: string };
  assuntos?: { nome?: string }[];
  movimentos?: DatajudMovimento[];
  [key: string]: unknown;
}

export class DatajudNaoConfiguradoError extends Error {
  constructor() {
    super("DATAJUD_API_KEY não configurada — obtenha a chave pública em https://datajud-wiki.cnj.jus.br/api-publica/ e defina em .env.local");
    this.name = "DatajudNaoConfiguradoError";
  }
}

export async function buscarProcessoPorNumero(sigla: string, numeroProcesso: string): Promise<DatajudProcesso[]> {
  const apiKey = process.env.DATAJUD_API_KEY;
  if (!apiKey) throw new DatajudNaoConfiguradoError();

  const alias = TRIBUNAL_ALIASES[sigla.toUpperCase()];
  if (!alias) throw new Error(`Tribunal "${sigla}" não mapeado em TRIBUNAL_ALIASES (lib/integrations/datajud.ts)`);

  const res = await fetch(`https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`, {
    method: "POST",
    headers: { Authorization: `APIKey ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ size: 5, query: { match: { numeroProcesso } } }),
  });
  if (!res.ok) throw new Error(`DataJud respondeu ${res.status} para ${sigla}/${numeroProcesso}`);
  const data = await res.json();
  return (data.hits?.hits ?? []).map((h: { _source: DatajudProcesso }) => h._source);
}
