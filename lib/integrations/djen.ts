// DJEN — Diário de Justiça Eletrônico Nacional (CNJ), consultado via a API pública que também
// serve o portal https://comunica.pje.jus.br. Não exige chave/token: é o mesmo mecanismo que
// sistemas como Astrea/AdvBox usam por baixo para captura automática de publicação/intimação
// por OAB, cobrindo nacionalmente os tribunais que aderiram ao PJe (a grande maioria hoje).
//
// Doc oficial: https://comunicaapi.pje.jus.br/api/v1 (sem autenticação para consulta, CORS
// aberto — access-control-allow-origin: *, confirmado via curl em 2026-07-16).
//
// IMPORTANTE: chamar esta função a partir de um componente "use client" (navegador), nunca do
// servidor. O CNJ bloqueia por WAF as chamadas vindas de IPs de datacenter/cloud (confirmado em
// produção em 2026-07-12: 403 "The request could not be satisfied" ao chamar a partir de funções
// Vercel, tanto Node quanto Edge — tentativas de proxy/spoofing de headers não resolveram). O
// próprio comunica.pje.jus.br é só uma SPA que roda essa mesma consulta direto no navegador de
// quem está usando o site; replicamos exatamente esse caminho aqui, então o fetch precisa sair
// da máquina da usuária, não do servidor do Legallis.

const DJEN_URL = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";

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
  meiocompleto?: string;
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
  texto?: string; // busca no teor da comunicação
  siglaTribunal?: string; // ex: TJMG
  meio?: string; // "D" (Diário de Justiça Eletrônico) ou "E" (Plataforma Nacional de Editais)
  numeroProcesso?: string; // com ou sem máscara
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
    if (params.texto) qs.set("texto", params.texto);
    if (params.siglaTribunal) qs.set("siglaTribunal", params.siglaTribunal);
    if (params.meio) qs.set("meio", params.meio);
    if (params.numeroProcesso) qs.set("numeroProcesso", params.numeroProcesso);

    const res = await fetch(`${DJEN_URL}?${qs.toString()}`, {
      headers: { Accept: "application/json" },
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
