/**
 * Testes das fórmulas da calculadora jurídica.
 * Validados contra o app.py de referência (Streamlit).
 */
import path from "path";
import fs from "fs";

// Carrega índices reais (mesmo arquivo usado em produção)
const idxPath = path.join(process.cwd(), "data", "indices_juridicos.json");
const INDICES = JSON.parse(fs.readFileSync(idxPath, "utf-8"));

// Importa as funções diretamente (sem o loadIndices que usa cache singleton)
import {
  calculateCharge,
  calcTaxaImplicita,
  calcPMT,
  calcCorrecaoHonorario,
  calcCorrigirExcesso,
} from "../lib/calc-formulas";

// Helpers
function d(s: string) { return new Date(s + "T12:00:00"); }
function r2(v: number) { return Math.round(v * 100) / 100; }

// ── 1. Juros simples ──────────────────────────────────────────────────────────
describe("calculateCharge — TJMG (INPC/IPCA-E)", () => {
  test("data_cobranca >= data_calculo retorna valor original sem correção", () => {
    const res = calculateCharge(1000, d("2025-06-15"), d("2025-06-15"), INDICES, "TJMG");
    expect(res.corrected).toBe(1000);
    expect(res.correction_factor).toBe(1);
    expect(res.interest_pct).toBe(0);
    expect(res.total).toBe(1000);
    expect(res.months).toBe(0);
  });

  test("cobrança 1 mês antes — retorna juros de ~1%", () => {
    // Jan/2024 → Fev/2024 = 1 mês cheio de juros a 1% + rateio por dia no mês final (dia 1/31)
    const res = calculateCharge(1000, d("2024-01-01"), d("2024-02-01"), INDICES, "TJMG");
    expect(res.months).toBe(1);
    expect(res.interest_pct).toBe(1.0345);
    // juros sobre valor corrigido
    expect(res.interest_value).toBeGreaterThan(0);
    expect(res.total).toBeGreaterThan(res.corrected);
  });

  test("correção usa INPC até ago/2024", () => {
    const res = calculateCharge(1000, d("2023-01-01"), d("2023-06-01"), INDICES, "TJMG");
    expect(res.indice_label).toBe("INPC");
    expect(res.months).toBe(5);
    expect(res.correction_factor).toBeGreaterThan(1);
  });

  test("correção usa IPCA + Taxa Legal a partir de set/2024 (Lei 14.905/2024)", () => {
    const res = calculateCharge(1000, d("2024-09-01"), d("2024-12-01"), INDICES, "TJMG");
    expect(res.indice_label).toBe("IPCA/Taxa Legal");
    expect(res.months).toBe(3);
  });

  test("juros simples acumulam corretamente ao longo de 12 meses", () => {
    const res = calculateCharge(1000, d("2023-01-01"), d("2024-01-01"), INDICES, "TJMG");
    // 12 meses × 1% (antes da Lei 14.905) + rateio por dia no mês final (dia 1/31) = 12,0323%
    expect(res.interest_pct).toBe(12.0323);
    expect(res.months).toBe(12);
    expect(res.interest_value).toBeGreaterThan(0);
    // total = corrigido + interest_pct% do corrigido
    const esperado = r2(res.corrected + (res.corrected * res.interest_pct) / 100);
    expect(res.total).toBe(esperado);
  });

  test("arredondamento financeiro para 2 casas decimais", () => {
    const res = calculateCharge(333.33, d("2022-01-01"), d("2022-04-01"), INDICES, "TJMG");
    expect(res.total.toString()).toMatch(/^\d+\.\d{1,2}$|^\d+$/);
    expect(res.corrected).toBe(r2(res.corrected));
    expect(res.interest_value).toBe(r2(res.interest_value));
  });
});

// ── 2. TJSP ───────────────────────────────────────────────────────────────────
describe("calculateCharge — TJSP (Tabela Prática)", () => {
  test("usa Tabela Prática TJSP e retorna label correto", () => {
    const res = calculateCharge(1000, d("2022-01-01"), d("2023-01-01"), INDICES, "TJSP");
    expect(res.indice_label).toBe("Tabela Prática TJSP");
    expect(res.correction_factor).toBeGreaterThan(1);
    expect(res.total).toBeGreaterThan(1000);
  });

  test("TJSP: fator de correção é razão entre fatores acumulados", () => {
    const res = calculateCharge(1000, d("2020-01-01"), d("2021-01-01"), INDICES, "TJSP");
    // Fator deve ser positivo e > 1 para período com inflação
    expect(res.correction_factor).toBeGreaterThan(0);
    expect(res.corrected).toBeGreaterThan(0);
  });
});

// ── 2b. Novos tribunais (Grupo 1 — cadeia nacional INPC/IPCA-E → IPCA) ────────
describe("calculateCharge — novos tribunais (Grupo 1)", () => {
  test.each([
    ["TJSC", "INPC"], ["TJDFT", "INPC"], ["TJMT", "INPC"], ["TJGO", "INPC"],
    ["TJRS", "INPC"], ["TJPR", "INPC"], ["TJMA", "INPC"],
  ])("%s usa INPC até ago/2024", (tribunal, esperado) => {
    const res = calculateCharge(1000, d("2023-01-01"), d("2023-06-01"), INDICES, tribunal);
    expect(res.indice_label).toBe(esperado);
  });

  test.each(["TJRJ", "TJAM", "TJPE"])("%s usa IPCA-E (não INPC) até ago/2024", (tribunal) => {
    const res = calculateCharge(1000, d("2023-01-01"), d("2023-06-01"), INDICES, tribunal);
    expect(res.indice_label).toBe("IPCA-E");
  });

  test.each(["TJSC", "TJDFT", "TJMT", "TJGO", "TJRS", "TJPR", "TJMA", "TJRJ", "TJAM", "TJPE"])(
    "%s usa IPCA + Taxa Legal a partir de set/2024, igual a TJMG",
    (tribunal) => {
      const res = calculateCharge(1000, d("2024-09-01"), d("2024-12-01"), INDICES, tribunal);
      const mg = calculateCharge(1000, d("2024-09-01"), d("2024-12-01"), INDICES, "TJMG");
      expect(res.indice_label).toBe("IPCA/Taxa Legal");
      // Regra pós-14.905 é nacional — mesmo resultado que TJMG no mesmo período
      expect(res.corrected).toBe(mg.corrected);
      expect(res.interest_pct).toBe(mg.interest_pct);
    }
  );

  test("tribunal desconhecido cai no padrão INPC (mesmo comportamento de antes da mudança)", () => {
    const res = calculateCharge(1000, d("2023-01-01"), d("2023-06-01"), INDICES, "TJXX");
    expect(res.indice_label).toBe("INPC");
  });
});

// ── 3. PMT / Taxa Implícita ───────────────────────────────────────────────────
describe("Fórmulas de Revisional", () => {
  test("calcPMT — Price com taxa 1% e 12 parcelas", () => {
    // PV=10000, i=1%a.m., n=12 → PMT ≈ R$888,49
    const pmt = calcPMT(10000, 1, 12);
    expect(pmt).toBeCloseTo(888.49, 1);
  });

  test("calcPMT — taxa zero divide igualmente", () => {
    const pmt = calcPMT(1200, 0, 12);
    expect(pmt).toBe(100);
  });

  test("calcPMT — n=0 retorna 0", () => {
    expect(calcPMT(1000, 1, 0)).toBe(0);
  });

  test("calcTaxaImplicita — recupera taxa de 1% a.m.", () => {
    const pmt = calcPMT(10000, 1, 36);
    const taxa = calcTaxaImplicita(10000, pmt, 36);
    expect(taxa).not.toBeNull();
    expect(taxa!).toBeCloseTo(1, 3);
  });

  test("calcTaxaImplicita — PV/PMT/N inválidos retorna null", () => {
    expect(calcTaxaImplicita(0, 500, 12)).toBeNull();
    expect(calcTaxaImplicita(10000, 0, 12)).toBeNull();
    expect(calcTaxaImplicita(10000, 500, 0)).toBeNull();
  });

  test("calcTaxaImplicita — taxa implícita é maior que taxa justa quando abusiva", () => {
    // Banco cobra PMT = R$400 para PV=10000 em 36x
    // Taxa justa seria ~1%: PMT ≈ R$332
    // Taxa implícita deve ser > 1%
    const taxa = calcTaxaImplicita(10000, 400, 36);
    expect(taxa).not.toBeNull();
    expect(taxa!).toBeGreaterThan(1);
  });

  test("calcCorrigirExcesso — data venc >= data calc retorna sem correção", () => {
    const resultado = calcCorrigirExcesso(100, d("2025-07-01"), d("2025-06-15"), INDICES);
    expect(resultado).toBe(100);
  });

  test("calcCorrigirExcesso — valor zero retorna zero", () => {
    const resultado = calcCorrigirExcesso(0, d("2022-01-01"), d("2025-01-01"), INDICES);
    expect(resultado).toBe(0);
  });

  test("calcCorrigirExcesso — corrige com juros para período passado", () => {
    const resultado = calcCorrigirExcesso(100, d("2022-01-01"), d("2023-01-01"), INDICES);
    expect(resultado).toBeGreaterThan(100);
  });
});

// ── 4. Honorário ─────────────────────────────────────────────────────────────
describe("calcCorrecaoHonorario", () => {
  test("data igual retorna valor original sem atualização", () => {
    const res = calcCorrecaoHonorario(5000, d("2025-06-15"), d("2025-06-15"), INDICES, "TJMG");
    expect(res.valor_corrigido).toBe(5000);
    expect(res.corr_factor).toBe(1);
    expect(res.meses_corr).toBe(0);
  });

  test("atualiza honorário com INPC em 12 meses", () => {
    const res = calcCorrecaoHonorario(10000, d("2023-01-01"), d("2024-01-01"), INDICES, "TJMG");
    expect(res.meses_corr).toBe(12);
    expect(res.valor_corrigido).toBeGreaterThan(10000);
    expect(res.corr_factor).toBeGreaterThan(1);
    expect(res.variacao_pct).toBeGreaterThan(0);
  });

  test("percentual 20% do valor corrigido", () => {
    const res = calcCorrecaoHonorario(50000, d("2022-06-01"), d("2024-06-01"), INDICES, "TJMG");
    const honorario = r2(res.valor_corrigido * 0.2);
    expect(honorario).toBeGreaterThan(10000); // 20% de >50000
  });

  test("label TJSP para tribunal TJSP", () => {
    const res = calcCorrecaoHonorario(5000, d("2022-01-01"), d("2023-01-01"), INDICES, "TJSP");
    expect(res.indice_label).toBe("Tabela Prática TJSP");
  });
});

// ── 5. Casos extremos / validações ───────────────────────────────────────────
describe("Casos extremos", () => {
  test("valor zero produz zero em todos os campos", () => {
    const res = calculateCharge(0, d("2022-01-01"), d("2023-01-01"), INDICES, "TJMG");
    expect(res.corrected).toBe(0);
    expect(res.interest_value).toBe(0);
    expect(res.total).toBe(0);
  });

  test("fator de correção sempre >= 1 (índices positivos)", () => {
    // INPC/IPCA-E são positivos na série histórica
    const res = calculateCharge(1000, d("2010-01-01"), d("2023-01-01"), INDICES, "TJMG");
    expect(res.correction_factor).toBeGreaterThanOrEqual(1);
  });

  test("period muito longo (10 anos) não trava", () => {
    const res = calculateCharge(1000, d("2014-01-01"), d("2024-01-01"), INDICES, "TJMG");
    expect(res.months).toBe(120);
    expect(res.total).toBeGreaterThan(1000);
  });
});

// ── 6. Valores exatos — validação jurídica ───────────────────────────────────
describe("Valores exatos — casos jurídicos de referência", () => {
  // Caso 1: TJMG clássico (pré-transição)
  // R$1.000 em jan/2022, cálculo jan/2023
  // Correção: INPC jan–dez/2022 = fator 1.059324
  // Juros: 12 meses × 1%/mês (simples) + rateio por dia no mês final (01/01/2023, dia 1/31) = 12,0323%
  // Corrigido: R$1.059,32 | Juros: R$127,46 | Total: R$1.186,78
  test("TJMG clássico jan/2022→jan/2023: INPC + 1%/mês simples (valores exatos)", () => {
    const res = calculateCharge(1000, d("2022-01-01"), d("2023-01-01"), INDICES, "TJMG");
    expect(res.corrected).toBe(1059.32);
    expect(res.interest_pct).toBe(12.0323);
    expect(res.interest_value).toBe(127.46);
    expect(res.total).toBe(1186.78);
    expect(res.months).toBe(12);
    expect(res.indice_label).toBe("INPC");
  });

  // Caso 2: TJMG pós-Lei 14.905/2024
  // R$1.000 em set/2024, cálculo jan/2025
  // Correção: IPCA (puro, não IPCA-E) set+out+nov+dez/2024 = fator 1.019236
  // Juros ("taxa legal" pronta, SGS 29543/BCB): set+out+nov+dez/2024 (4 meses cheios)
  //   + rateio por dia no mês final (01/01/2025, dia 1/31) = 1,9573% simples
  // Corrigido: R$1.019,24 | Juros: R$19,95 | Total: R$1.039,19
  test("TJMG pós-14905 set/2024→jan/2025: IPCA + Taxa Legal simples (valores exatos)", () => {
    const res = calculateCharge(1000, d("2024-09-01"), d("2025-01-01"), INDICES, "TJMG");
    expect(res.corrected).toBe(1019.24);
    expect(res.interest_pct).toBeCloseTo(1.9573, 4);
    expect(res.interest_value).toBe(19.95);
    expect(res.total).toBe(1039.19);
    expect(res.months).toBe(4);
    expect(res.indice_label).toBe("IPCA/Taxa Legal");
  });

  // Caso 3: Juros são SIMPLES, não compostos
  // Verificar que juros = corrigido × (soma das taxas) / 100 — NÃO capitalizado mês a mês
  test("juros são simples (não compostos) — art. 406 CC e súmula 121 STF", () => {
    const res = calculateCharge(1000, d("2023-01-01"), d("2023-07-01"), INDICES, "TJMG");
    // 6 meses × 1% + rateio por dia no mês final (dia 1/31) = 6,0323% simples
    expect(res.interest_pct).toBe(6.0323);
    // juros = sobre o valor JÁ corrigido, não capitalizado mês a mês
    const jurosEsperado = Math.round(res.corrected * (res.interest_pct / 100) * 100) / 100;
    expect(res.interest_value).toBe(jurosEsperado);
    // total NÃO é (1 + 0.01)^6 × base, é base × 1.06 (linear)
    const jurosCompostoHipotetico = Math.round(res.corrected * (Math.pow(1.01, 6) - 1) * 100) / 100;
    expect(res.interest_value).toBeLessThan(jurosCompostoHipotetico);
  });

  // Caso 4: Fronteira da transição — ago/2024 ainda usa INPC + 1%, set/2024 usa IPCA + Taxa Legal
  test("fronteira ago/2024: INPC + 1% | set/2024: IPCA + Taxa Legal", () => {
    const preTransicao = calculateCharge(1000, d("2024-08-01"), d("2024-09-01"), INDICES, "TJMG");
    const posTransicao = calculateCharge(1000, d("2024-09-01"), d("2024-10-01"), INDICES, "TJMG");

    expect(preTransicao.indice_label).toBe("INPC");
    expect(preTransicao.interest_pct).toBe(1.0225); // 1% fixo + rateio por dia no mês final (dia 1/30)

    expect(posTransicao.indice_label).toBe("IPCA/Taxa Legal");
    expect(posTransicao.interest_pct).toBeCloseTo(0.6989, 4); // taxa legal set/2024 (SGS 29543) + rateio no mês final
  });

  // Caso 5: TJSP não confunde correção e juros — são calculados separadamente
  test("TJSP: fator tabela aplicado na correção, Selic nos juros (não dupla contagem)", () => {
    const res = calculateCharge(1000, d("2025-01-01"), d("2025-06-01"), INDICES, "TJSP");
    // Tabela 14905 cobre jan→jun/2025
    expect(res.corrected).toBeGreaterThan(1000);
    expect(res.interest_value).toBeGreaterThan(0);
    // Correção e juros são valores independentes
    expect(res.total).toBeCloseTo(res.corrected + res.interest_value, 2);
    expect(res.indice_label).toBe("Tabela Prática TJSP");
  });

  // Caso 6: dano moral em cumprimento de sentença — correção e juros com marcos DIFERENTES
  // e a citação (marco dos juros) ANTERIOR ao arbitramento (marco da correção).
  // Processo 1021620-17.2025.8.26.0506: R$5.000 arbitrados no acórdão de 04/01/2026 (Súmula 362
  // STJ), juros desde a citação em 02/06/2025, cálculo em 27/08/2026. Conferido contra a série
  // oficial SGS 29543/BCB (Taxa Legal) e a Nova Tabela Prática do TJSP: correção R$175,44,
  // juros R$607,08 (11,73% simples, com rateio de dias em jun/2025 e ago/2026).
  test("dano moral TJSP: juros desde a citação, anterior ao arbitramento (valores exatos)", () => {
    const res = calculateCharge(
      5000,
      d("2026-01-04"), // arbitramento (acórdão) — marco da correção
      d("2026-08-27"), // data do cálculo
      INDICES,
      "TJSP",
      d("2025-06-02")  // citação — marco dos juros, ANTERIOR ao arbitramento
    );
    expect(res.corrected).toBe(5175.44);
    expect(res.interest_pct).toBeCloseTo(11.73, 2);
    expect(res.interest_value).toBe(607.08);
    expect(res.total).toBe(5782.52);
  });
});
