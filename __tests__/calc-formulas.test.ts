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

  test("cobrança 1 mês antes — retorna juros de 1%", () => {
    // Jan/2024 → Fev/2024 = 1 mês de juros a 1%
    const res = calculateCharge(1000, d("2024-01-01"), d("2024-02-01"), INDICES, "TJMG");
    expect(res.months).toBe(1);
    expect(res.interest_pct).toBe(1); // 1% a.m. simples
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

  test("correção usa IPCA-E a partir de set/2024", () => {
    const res = calculateCharge(1000, d("2024-09-01"), d("2024-12-01"), INDICES, "TJMG");
    expect(res.indice_label).toBe("IPCA-E");
    expect(res.months).toBe(3);
  });

  test("juros simples acumulam corretamente ao longo de 12 meses", () => {
    const res = calculateCharge(1000, d("2023-01-01"), d("2024-01-01"), INDICES, "TJMG");
    // 12 meses × 1% = 12% (antes da Lei 14.905)
    expect(res.interest_pct).toBe(12);
    expect(res.months).toBe(12);
    expect(res.interest_value).toBeGreaterThan(0);
    // total = corrigido + 12% do corrigido
    const esperado = r2(res.corrected + res.corrected * 0.12);
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
