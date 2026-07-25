// Fórmulas de cálculo jurídico — port TypeScript do app.py de referência
//
// Regra nacional (Lei 14.905/2024, art. 389 e 406 CC, vigente desde 30/08/2024):
// - Correção monetária: IPCA puro (não IPCA-E) quando não há índice convencionado.
// - Juros de mora ("taxa legal"): Selic do mês MENOS o IPCA do mesmo mês (Res. CMN 5.171/2024),
//   uma taxa real — não a Selic cheia. Fonte primária: documento oficial da Contadoria Judicial
//   do TJSC ("Adequação do módulo de cálculos judiciais às novas regras de atualização
//   monetária no Código Civil"), que cita os artigos e confirma a metodologia na prática.
// Antes de 30/08/2024, cada tribunal seguia seu próprio índice — ver PRE_LEI14905_INDEX abaixo.
// TJSP é o único com tabela própria (fatores acumulados, não decorre de INPC/IPCA-E puro).

import fs from "fs";
import path from "path";

export interface Indices {
  inpc: Record<string, number>;
  ipcae: Record<string, number>;
  ipca: Record<string, number>;   // IPCA mensal IBGE — usado para calcular Selic real (Lei 14.905/2024)
  selic: Record<string, number>;
  tjsp_inpc: Record<string, number>;
  tjsp_14905: Record<string, number>;
  ultima_atualizacao?: string;
}

let _cachedIndices: Indices | null = null;

export function loadIndices(): Indices {
  if (_cachedIndices) return _cachedIndices;
  const file = path.join(process.cwd(), "data", "indices_juridicos.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as Indices;
  _cachedIndices = raw;
  return raw;
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function nextMonth(year: number, month: number): [number, number] {
  return month === 12 ? [year + 1, 1] : [year, month + 1];
}

function* iterMonths(start: Date, end: Date): Generator<[number, number]> {
  let cy = start.getFullYear(), cm = start.getMonth() + 1;
  const ey = end.getFullYear(), em = end.getMonth() + 1;
  while (cy < ey || (cy === ey && cm < em)) {
    yield [cy, cm];
    [cy, cm] = nextMonth(cy, cm);
  }
}

// Índice usado por cada tribunal ANTES do corte de 30/08/2024 (Lei 14.905/2024). Tribunais não
// listados usam INPC (padrão histórico da maioria dos estados pesquisados — ver memória do
// projeto). A partir de 30/08/2024 todos usam IPCA puro, por força da lei federal.
const PRE_LEI14905_INDEX: Record<string, "inpc" | "ipcae"> = {
  TJRJ: "ipcae", // Lei 6.899/81 já usava IPCA-E como padrão histórico no RJ
  TJAM: "ipcae", // Manual MCALC/TJAM: IPCA-E como último elo da cadeia histórica (desde 2015)
  TJPE: "ipcae", // Manual de Cálculos da Justiça Federal, adotado pelo TJPE p/ condenações cíveis gerais
};

export function getPreIndexKey(tribunal: string): "inpc" | "ipcae" {
  return PRE_LEI14905_INDEX[tribunal] ?? "inpc";
}

function getCorrectionIndex(year: number, month: number, idx: Indices, tribunal = "TJMG"): number {
  const key = monthKey(year, month);
  if (year < 2024 || (year === 2024 && month <= 8)) {
    return idx[getPreIndexKey(tribunal)][key] ?? 0;
  }
  return idx.ipca[key] ?? 0;
}

function getTJSPFactor(key: string, idx: Indices): number | null {
  const y = parseInt(key.slice(0, 4));
  const m = parseInt(key.slice(5, 7));
  if (y < 2024 || (y === 2024 && m <= 8)) {
    return idx.tjsp_inpc[key] ?? null;
  }
  return idx.tjsp_14905[key] ?? null;
}

function calcCorrecaoTJSP(
  value: number,
  dateStart: Date,
  dateEnd: Date,
  idx: Indices
): [number, number, number] {
  const kStart = monthKey(dateStart.getFullYear(), dateStart.getMonth() + 1);
  const kEnd = monthKey(dateEnd.getFullYear(), dateEnd.getMonth() + 1);
  const fStart = getTJSPFactor(kStart, idx);
  const fEnd = getTJSPFactor(kEnd, idx);

  if (fStart && fEnd && fStart > 0) {
    const fator = fEnd / fStart;
    const meses = Array.from(iterMonths(dateStart, dateEnd)).length;
    return [round2(value * fator), round6(fator), meses];
  }

  // fallback: mês a mês com INPC/IPCA-E
  let cf = 1.0;
  let meses = 0;
  for (const [y, m] of iterMonths(dateStart, dateEnd)) {
    cf *= 1 + getCorrectionIndex(y, m, idx) / 100;
    meses++;
  }
  return [round2(value * cf), round6(cf), meses];
}

function getInterestRate(year: number, month: number, idx: Indices): number {
  if (year <= 2002) return 0.5;
  if (year < 2024 || (year === 2024 && month <= 8)) return 1.0;
  // Lei 14.905/2024, art. 406 §1º CC: "taxa legal" = Selic do mês MENOS o IPCA do mesmo mês
  // (Res. CMN 5.171/2024) — taxa real, não a Selic cheia (que já é aplicada, em separado,
  // como correção monetária via getCorrectionIndex/idx.ipca).
  const key = monthKey(year, month);
  const selic = idx.selic[key] ?? 0;
  const ipca = idx.ipca[key] ?? 0;
  return selic - ipca;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function round6(v: number): number {
  return Math.round(v * 1_000_000) / 1_000_000;
}
function round4(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

export interface ChargeResult {
  corrected: number;
  correction_factor: number;
  interest_pct: number;
  interest_value: number;
  total: number;
  months: number;
  indice_label: string;
}

export function calculateCharge(
  value: number,
  dateCharge: Date,
  dateCalc: Date,
  idx: Indices,
  tribunal = "TJMG",
  dataMora?: Date   // termo inicial dos juros (ex: data da citação). Se omitido = dateCharge
): ChargeResult {
  if (dateCharge >= dateCalc) {
    return { corrected: value, correction_factor: 1, interest_pct: 0, interest_value: 0, total: value, months: 0, indice_label: "Sem atualização" };
  }

  const isTJSP = tribunal.includes("TJSP");
  // Mora começa em dataMora (se posterior ao débito e anterior ao cálculo), senão no débito
  const moraStart = (dataMora && dataMora > dateCharge && dataMora < dateCalc)
    ? dataMora : dateCharge;

  let corrected: number, correctionFactor: number, months: number;
  let totalInterestPct = 0;
  const indicesUsados: string[] = [];

  if (isTJSP) {
    // Correção: Tabela Prática TJSP (dateCharge → dateCalc)
    [corrected, correctionFactor, months] = calcCorrecaoTJSP(value, dateCharge, dateCalc, idx);
    // Juros: a partir de moraStart
    for (const [y, m] of iterMonths(moraStart, dateCalc)) {
      totalInterestPct += getInterestRate(y, m, idx);
      indicesUsados.push(y < 2024 || (y === 2024 && m <= 8) ? "TJSP-INPC" : "TJSP-14905/Taxa Legal");
    }
  } else {
    // Correção: índice pré-Lei 14.905/2024 do tribunal (INPC ou IPCA-E, ver PRE_LEI14905_INDEX)
    // até 30/08/2024, IPCA puro a partir daí (dateCharge → dateCalc)
    const preLabel = getPreIndexKey(tribunal) === "ipcae" ? "IPCA-E" : "INPC";
    correctionFactor = 1.0;
    months = 0;
    for (const [y, m] of iterMonths(dateCharge, dateCalc)) {
      const corrIdx = getCorrectionIndex(y, m, idx, tribunal);
      correctionFactor *= 1 + corrIdx / 100;
      months++;
      indicesUsados.push(y < 2024 || (y === 2024 && m <= 8) ? preLabel : "IPCA/Taxa Legal");
    }
    corrected = value * correctionFactor;
    // Juros: a partir de moraStart (pode ser data da citação)
    for (const [y, m] of iterMonths(moraStart, dateCalc)) {
      totalInterestPct += getInterestRate(y, m, idx);
    }
    if (moraStart > dateCharge) indicesUsados.push("Selic/1%");
  }

  const interestValue = corrected * totalInterestPct / 100;
  const total = corrected + interestValue;

  const uniq = [...new Set(indicesUsados)];
  const indice_label = isTJSP ? "Tabela Prática TJSP" : uniq.join("/");

  return {
    corrected: round2(corrected),
    correction_factor: round6(correctionFactor),
    interest_pct: round4(totalInterestPct),
    interest_value: round2(interestValue),
    total: round2(total),
    months,
    indice_label,
  };
}

// ── Revisional — taxa implícita (Newton-Raphson) ──────────────────────────────
export function calcTaxaImplicita(pv: number, pmt: number, n: number): number | null {
  if (pv <= 0 || pmt <= 0 || n <= 0) return null;
  let i = (pmt * n / pv - 1) / n;
  if (i <= 0) i = 0.01;
  for (let iter = 0; iter < 1000; iter++) {
    const ir = i;
    const denom = 1 - Math.pow(1 + ir, -n);
    if (Math.abs(denom) < 1e-15) break;
    const fi = pmt - pv * ir / denom;
    const dfNumer = denom - ir * n * Math.pow(1 + ir, -n - 1);
    const dfi = -pv * dfNumer / (denom * denom);
    if (Math.abs(dfi) < 1e-15) break;
    let iNovo = ir - fi / dfi;
    if (iNovo <= 0) iNovo = ir / 2;
    if (Math.abs(iNovo - ir) < 1e-10) { i = iNovo; break; }
    i = iNovo;
  }
  return i > 0 ? i * 100 : null;
}

export function calcPMT(pv: number, i: number, n: number): number {
  if (n === 0) return 0;
  if (i === 0) return round2(pv / n);
  const ir = i / 100;
  return round2(pv * ir / (1 - Math.pow(1 + ir, -n)));
}

export function calcCorrigirExcesso(
  excesso: number,
  dataVenc: Date,
  dataCalc: Date,
  idx: Indices,
  tribunal = "TJMG"
): number {
  if (dataVenc >= dataCalc || excesso <= 0) return excesso;
  let fatorCorr = 1.0;
  let totalMoraPct = 0;
  for (const [y, m] of iterMonths(dataVenc, dataCalc)) {
    fatorCorr *= 1 + getCorrectionIndex(y, m, idx, tribunal) / 100;
    totalMoraPct += getInterestRate(y, m, idx); // taxa legal (Selic − IPCA) pós-set/2024 (Lei 14.905/2024)
  }
  const corrigido = excesso * fatorCorr;
  return round2(corrigido + corrigido * totalMoraPct / 100);
}

// ── Correção de honorário ─────────────────────────────────────────────────────
export function calcCorrecaoHonorario(
  valor: number,
  dataOrigem: Date,
  dataCalculo: Date,
  idx: Indices,
  tribunal = "TJMG"
): {
  valor_corrigido: number;
  corr_factor: number;
  variacao_pct: number;
  meses_corr: number;
  indice_label: string;
} {
  if (dataOrigem >= dataCalculo) {
    return { valor_corrigido: valor, corr_factor: 1, variacao_pct: 0, meses_corr: 0, indice_label: "Sem atualização" };
  }

  const isTJSP = tribunal.includes("TJSP");
  let corr_factor: number, meses_corr: number;
  const indicesUsados: string[] = [];

  if (isTJSP) {
    [, corr_factor, meses_corr] = calcCorrecaoTJSP(valor, dataOrigem, dataCalculo, idx);
  } else {
    const preLabel = getPreIndexKey(tribunal) === "ipcae" ? "IPCA-E" : "INPC";
    corr_factor = 1.0;
    meses_corr = 0;
    for (const [y, m] of iterMonths(dataOrigem, dataCalculo)) {
      corr_factor *= 1 + getCorrectionIndex(y, m, idx, tribunal) / 100;
      meses_corr++;
      indicesUsados.push(y < 2024 || (y === 2024 && m <= 8) ? preLabel : "IPCA/Taxa Legal");
    }
  }

  const valor_corrigido = round2(valor * corr_factor);
  const variacao_pct = round4((corr_factor - 1) * 100);
  const uniq = [...new Set(indicesUsados)];
  const indice_label = isTJSP ? "Tabela Prática TJSP" : uniq.join("/");

  return { valor_corrigido, corr_factor: round6(corr_factor), variacao_pct, meses_corr, indice_label };
}
