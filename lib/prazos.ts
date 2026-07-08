// Calculadora de prazos processuais — feriados nacionais, estaduais e recesso forense (CPC art. 220).
// Ferramenta de referência: não substitui a conferência do calendário forense do tribunal/comarca específico.

export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;
export type UF = (typeof UFS)[number];

export const UF_LABEL: Record<UF, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
  MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
  PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

// Data magna / feriado estadual mais relevante de cada UF (uma data fixa por estado).
const FERIADO_ESTADUAL: Partial<Record<UF, { mes: number; dia: number; nome: string }>> = {
  AC: { mes: 6, dia: 15, nome: "Aniversário do Acre" },
  AL: { mes: 9, dia: 16, nome: "Emancipação Política de Alagoas" },
  AM: { mes: 9, dia: 5, nome: "Elevação do Amazonas a Província" },
  BA: { mes: 7, dia: 2, nome: "Independência da Bahia" },
  CE: { mes: 3, dia: 25, nome: "Abolição da Escravidão no Ceará" },
  MA: { mes: 7, dia: 28, nome: "Adesão do Maranhão à Independência" },
  MS: { mes: 10, dia: 11, nome: "Criação do Estado de Mato Grosso do Sul" },
  PA: { mes: 8, dia: 15, nome: "Adesão do Grão-Pará à Independência" },
  PB: { mes: 8, dia: 5, nome: "Fundação do Estado da Paraíba" },
  PR: { mes: 12, dia: 19, nome: "Emancipação Política do Paraná" },
  PE: { mes: 3, dia: 6, nome: "Data Magna de Pernambuco" },
  PI: { mes: 10, dia: 19, nome: "Data Magna do Piauí" },
  RJ: { mes: 4, dia: 23, nome: "São Jorge / Data Magna do Rio de Janeiro" },
  RS: { mes: 9, dia: 20, nome: "Revolução Farroupilha" },
  RO: { mes: 1, dia: 4, nome: "Criação do Estado de Rondônia" },
  RR: { mes: 10, dia: 5, nome: "Criação do Estado de Roraima" },
  SC: { mes: 8, dia: 11, nome: "Criação da Capitania de Santa Catarina" },
  SP: { mes: 7, dia: 9, nome: "Revolução Constitucionalista de 1932" },
  SE: { mes: 7, dia: 8, nome: "Emancipação Política de Sergipe" },
  TO: { mes: 10, dia: 5, nome: "Criação do Estado do Tocantins" },
};

const FERIADOS_NACIONAIS_FIXOS = [
  { mes: 1, dia: 1, nome: "Confraternização Universal" },
  { mes: 4, dia: 21, nome: "Tiradentes" },
  { mes: 5, dia: 1, nome: "Dia do Trabalho" },
  { mes: 9, dia: 7, nome: "Independência do Brasil" },
  { mes: 10, dia: 12, nome: "Nossa Senhora Aparecida" },
  { mes: 11, dia: 2, nome: "Finados" },
  { mes: 11, dia: 15, nome: "Proclamação da República" },
  { mes: 11, dia: 20, nome: "Dia Nacional de Zumbi e da Consciência Negra" },
  { mes: 12, dia: 25, nome: "Natal" },
];

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Algoritmo de Gauss/Meeus para a Páscoa (calendário gregoriano).
function pascoa(ano: number): { mes: number; dia: number } {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { mes, dia };
}

function addDias(y: number, m: number, d: number, delta: number): { mes: number; dia: number; ano: number } {
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return { ano: dt.getUTCFullYear(), mes: dt.getUTCMonth() + 1, dia: dt.getUTCDate() };
}

/** Feriados nacionais (fixos + móveis com base na Páscoa) do ano informado, como mapa ISO -> nome. */
function feriadosNacionais(ano: number): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const f of FERIADOS_NACIONAIS_FIXOS) mapa.set(toISO(ano, f.mes, f.dia), f.nome);

  const pa = pascoa(ano);
  const sextaSanta = addDias(ano, pa.mes, pa.dia, -2);
  const carnavalSeg = addDias(ano, pa.mes, pa.dia, -48);
  const carnavalTer = addDias(ano, pa.mes, pa.dia, -47);
  const corpusChristi = addDias(ano, pa.mes, pa.dia, 60);

  mapa.set(toISO(sextaSanta.ano, sextaSanta.mes, sextaSanta.dia), "Sexta-feira Santa");
  mapa.set(toISO(carnavalSeg.ano, carnavalSeg.mes, carnavalSeg.dia), "Segunda-feira de Carnaval");
  mapa.set(toISO(carnavalTer.ano, carnavalTer.mes, carnavalTer.dia), "Terça-feira de Carnaval (não há expediente forense)");
  mapa.set(toISO(corpusChristi.ano, corpusChristi.mes, corpusChristi.dia), "Corpus Christi (ponto facultativo forense)");
  return mapa;
}

/** 20/dez a 20/jan — suspensão de prazos do art. 220 do CPC (recesso forense). */
function emRecessoForense(iso: string): boolean {
  const [, m, d] = iso.split("-").map(Number);
  return (m === 12 && d >= 20) || (m === 1 && d <= 20);
}

export interface MotivoNaoUtil {
  data: string;
  motivo: string;
}

function motivoNaoUtil(iso: string, uf: UF | "", considerarRecesso: boolean): string | null {
  const dt = new Date(iso + "T00:00:00");
  const diaSemana = dt.getDay();
  if (diaSemana === 0) return "Domingo";
  if (diaSemana === 6) return "Sábado";

  const ano = Number(iso.slice(0, 4));
  const nomeFeriado = feriadosNacionais(ano).get(iso);
  if (nomeFeriado) return nomeFeriado;

  if (uf) {
    const fe = FERIADO_ESTADUAL[uf];
    if (fe && iso === toISO(ano, fe.mes, fe.dia)) return fe.nome;
  }

  if (considerarRecesso && emRecessoForense(iso)) return "Recesso forense (art. 220 do CPC)";

  return null;
}

export function isDiaUtil(iso: string, uf: UF | "", considerarRecesso: boolean): boolean {
  return motivoNaoUtil(iso, uf, considerarRecesso) === null;
}

function proximaData(iso: string, delta: number): string {
  const dt = new Date(iso + "T00:00:00");
  dt.setDate(dt.getDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export interface ResultadoPrazo {
  dataInicio: string;
  dataFinal: string;
  diasPulados: MotivoNaoUtil[];
}

export function calcularPrazo(params: {
  dataPublicacao: string; // ISO yyyy-mm-dd
  dias: number;
  uf: UF | "";
  tipoContagem: "uteis" | "corridos";
  considerarRecesso: boolean;
}): ResultadoPrazo {
  const { dataPublicacao, dias, uf, tipoContagem, considerarRecesso } = params;
  const diasPulados: MotivoNaoUtil[] = [];

  // Início da contagem: primeiro dia útil estritamente após a publicação/intimação.
  let inicio = proximaData(dataPublicacao, 1);
  while (true) {
    const motivo = motivoNaoUtil(inicio, uf, considerarRecesso);
    if (!motivo) break;
    diasPulados.push({ data: inicio, motivo });
    inicio = proximaData(inicio, 1);
  }

  let dataFinal: string;
  if (tipoContagem === "uteis") {
    let atual = inicio;
    let contados = 1; // o próprio dia de início já é o 1º dia útil do prazo
    while (contados < dias) {
      atual = proximaData(atual, 1);
      const motivo = motivoNaoUtil(atual, uf, considerarRecesso);
      if (motivo) { diasPulados.push({ data: atual, motivo }); continue; }
      contados++;
    }
    dataFinal = atual;
  } else {
    dataFinal = proximaData(inicio, dias - 1);
    // Se o vencimento cair em dia não útil, prorroga-se para o próximo dia útil (art. 224, §1º, CPC).
    while (true) {
      const motivo = motivoNaoUtil(dataFinal, uf, considerarRecesso);
      if (!motivo) break;
      diasPulados.push({ data: dataFinal, motivo });
      dataFinal = proximaData(dataFinal, 1);
    }
  }

  return { dataInicio: inicio, dataFinal, diasPulados };
}
