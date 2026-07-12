// DJEN — Diário de Justiça Eletrônico Nacional (CNJ), consultado via a API pública
// que também serve o portal https://comunica.pje.jus.br. Não exige chave/token: é o mesmo
// mecanismo que sistemas como Astrea/AdvBox usam por baixo para captura automática de
// publicação/intimação por OAB, cobrindo nacionalmente os tribunais que aderiram ao PJe
// (a grande maioria hoje). Confirmado contra a API real em 2026-07-12 — ver formato de
// resposta abaixo em DjenComunicacao.
//
// Doc oficial: https://comunicaapi.pje.jus.br/api/v1 (sem autenticação para consulta).

const BASE_URL = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";

export interface DjenAdvogado {
  id: number;
  nome: string;
  numero_oab: string;
  uf_oab: string;
}

export interface DjenDestinatarioAdvogado {
  id: number;
  comunicacao_id: number;
  advogado_id: number;
  advogado?: DjenAdvogado;
}

export interface DjenComunicacao {
  id: number;
  data_disponibilizacao: string;
  siglaTribunal: string;
  tipoComunicacao: string;
  nomeOrgao: string;
  texto: string;
  numero_processo: string;
  numeroprocessocommascara?: string;
  meio: string;
  link?: string;
  tipoDocumento?: string;
  numeroComunicacao?: number;
  destinatarios?: { polo: string; nome: string }[];
  destinatarioadvogados?: DjenDestinatarioAdvogado[];
}

interface DjenResponse {
  status: string;
  message: string;
  count: number;
  items: DjenComunicacao[];
}

export interface BuscarDjenParams {
  numeroOab: string;
  ufOab: string;
  dataDisponibilizacaoInicio?: string; // YYYY-MM-DD
  dataDisponibilizacaoFim?: string; // YYYY-MM-DD
}

// Busca todas as páginas (a API pagina em blocos de até 100 itens por padrão).
export async function buscarComunicacoesPorOab(params: BuscarDjenParams): Promise<DjenComunicacao[]> {
  const itensPorPagina = 100;
  let pagina = 1;
  const acumulado: DjenComunicacao[] = [];

  while (true) {
    const qs = new URLSearchParams({
      numeroOab: params.numeroOab,
      ufOab: params.ufOab,
      itensPorPagina: String(itensPorPagina),
      pagina: String(pagina),
    });
    if (params.dataDisponibilizacaoInicio) qs.set("dataDisponibilizacaoInicio", params.dataDisponibilizacaoInicio);
    if (params.dataDisponibilizacaoFim) qs.set("dataDisponibilizacaoFim", params.dataDisponibilizacaoFim);

    const res = await fetch(`${BASE_URL}?${qs.toString()}`, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Referer: "https://comunica.pje.jus.br/",
        Origin: "https://comunica.pje.jus.br",
      },
    });
    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      throw new Error(`DJEN respondeu ${res.status}${corpo ? `: ${corpo.slice(0, 300)}` : ""}`);
    }
    const data = (await res.json()) as DjenResponse;
    acumulado.push(...(data.items ?? []));

    if (acumulado.length >= data.count || (data.items?.length ?? 0) < itensPorPagina) break;
    pagina++;
    if (pagina > 50) break; // trava de segurança
  }

  return acumulado;
}
