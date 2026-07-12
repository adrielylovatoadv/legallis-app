// DJEN — Diário de Justiça Eletrônico Nacional (CNJ), consultado via a API pública
// que também serve o portal https://comunica.pje.jus.br. Não exige chave/token: é o mesmo
// mecanismo que sistemas como Astrea/AdvBox usam por baixo para captura automática de
// publicação/intimação por OAB, cobrindo nacionalmente os tribunais que aderiram ao PJe
// (a grande maioria hoje). Confirmado contra a API real em 2026-07-12 — ver formato de
// resposta abaixo em DjenComunicacao.
//
// Doc oficial: https://comunicaapi.pje.jus.br/api/v1 (sem autenticação para consulta).
//
// A chamada não vai direto pro DJEN: o Vercel (função Node/serverless) é bloqueado por WAF
// do lado do CNJ (403 "The request could not be satisfied"), confirmado em produção em
// 2026-07-12. A função Edge (app/api/internal/djen-proxy) roda numa rede diferente da função
// Node — passamos por ela na tentativa de contornar o bloqueio sem precisar de infraestrutura
// nova (VPS/proxy pago).

// NEXTAUTH_URL é o domínio público estável (app.legallis.app.br) — usar VERCEL_URL aqui seria
// errado: aponta pro hostname *.vercel.app específico do deployment, que tem a "Vercel
// Authentication" (SSO) do próprio Vercel na frente, e a chamada interna levaria 401 do Vercel
// em vez de chegar ao DJEN (confirmado em produção em 2026-07-12).
function proxyBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  return "http://localhost:3000";
}

const BASE_URL = () => `${proxyBaseUrl()}/api/internal/djen-proxy`;

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

    const res = await fetch(`${BASE_URL()}?${qs.toString()}`, {
      headers: {
        Accept: "application/json",
        "x-internal-secret": process.env.INTERNAL_PROXY_SECRET ?? "",
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
