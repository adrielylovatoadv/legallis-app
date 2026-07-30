// Conversão de valores em reais para texto por extenso (padrão usado em recibos).

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function centenaPorExtenso(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(" e ");
}

// Grupos de 3 dígitos, do menos ao mais significativo: unidades, milhares, milhões, bilhões.
const ESCALAS = [
  { singular: "", plural: "" },
  { singular: "mil", plural: "mil" },
  { singular: "milhão", plural: "milhões" },
  { singular: "bilhão", plural: "bilhões" },
];

function inteiroPorExtenso(n: number): { texto: string; precisaDe: boolean } {
  if (n === 0) return { texto: "zero", precisaDe: false };
  const grupos: number[] = [];
  let resto = n;
  while (resto > 0) { grupos.push(resto % 1000); resto = Math.floor(resto / 1000); }

  const partes: string[] = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i];
    if (g === 0) continue;
    const escala = ESCALAS[i];
    const texto = centenaPorExtenso(g);
    if (i === 1 && g === 1) partes.push("mil");
    else partes.push(escala.singular ? `${texto} ${g === 1 ? escala.singular : escala.plural}` : texto);
  }

  // Grupo mais significativo não-zero — se for milhão/bilhão e for o único grupo
  // presente (nenhum milhar/unidade abaixo dele), a palavra seguinte ("reais"/
  // "centavos") precisa do conectivo "de" (ex.: "um milhão de reais").
  const idxTopo = grupos.length - 1 - grupos.slice().reverse().findIndex(g => g > 0);
  const precisaDe = idxTopo >= 2 && partes.length === 1;

  if (partes.length === 1) return { texto: partes[0], precisaDe };
  const ultima = partes[partes.length - 1];
  const ultimoGrupo = grupos[0];
  // "e" antes do último grupo quando ele é < 100 (e não é a única parte) — regra usual do português.
  const conector = ultimoGrupo > 0 && ultimoGrupo < 100 ? " e " : ", ";
  return { texto: partes.slice(0, -1).join(", ") + conector + ultima, precisaDe: false };
}

export function valorPorExtenso(valor: number): string {
  const v = Math.round(Math.abs(valor) * 100) / 100;
  const reais = Math.floor(v);
  const centavos = Math.round((v - reais) * 100);

  let parteReais = "";
  if (reais > 0 || centavos === 0) {
    const { texto, precisaDe } = inteiroPorExtenso(reais);
    parteReais = `${texto} ${precisaDe ? "de " : ""}${reais === 1 ? "real" : "reais"}`;
  }
  let parteCentavos = "";
  if (centavos > 0) {
    const { texto, precisaDe } = inteiroPorExtenso(centavos);
    parteCentavos = `${texto} ${precisaDe ? "de " : ""}${centavos === 1 ? "centavo" : "centavos"}`;
  }

  if (parteReais && parteCentavos) return `${parteReais} e ${parteCentavos}`;
  return parteReais || parteCentavos;
}
