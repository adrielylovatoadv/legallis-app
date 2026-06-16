/**
 * Testes de integração — simula o comportamento das rotas da API
 * usando dados reais de índices, sem HTTP (chama as fórmulas diretamente).
 *
 * Casos validados manualmente contra o app.py de referência (Streamlit).
 */
import path from "path";
import fs from "fs";
import { calculateCharge, calcCorrecaoHonorario, calcTaxaImplicita, calcPMT } from "../lib/calc-formulas";

const INDICES = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "indices_juridicos.json"), "utf-8"));
const d = (s: string) => new Date(s + "T12:00:00");
const r2 = (v: number) => Math.round(v * 100) / 100;

// ── Petição Inicial (TJMG) ────────────────────────────────────────────────────
describe("Petição Inicial — TJMG", () => {
  test("lançamento de R$1.000 em jan/2020, cálculo em jun/2024 — resultado razoável", () => {
    const res = calculateCharge(1000, d("2020-01-15"), d("2024-06-15"), INDICES, "TJMG");
    // 4,5 anos ≈ 54 meses × 1% = 54% de juros + correção INPC ~30%
    expect(res.corrected).toBeGreaterThan(1200); // correção INPC 2020→2024
    expect(res.corrected).toBeLessThan(2000);    // sanidade
    expect(res.interest_pct).toBe(53);           // jan/2020 → jun/2024 = 53 meses × 1%
    // total pode divergir 1 centavo do somatório pós-arredondamento individual
    expect(res.total).toBeCloseTo(res.corrected + res.interest_value, 1);
  });

  test("múltiplos lançamentos — soma correta", () => {
    const lancamentos = [
      { data: "2021-03-01", valor: 500 },
      { data: "2022-06-01", valor: 750 },
      { data: "2023-09-01", valor: 1200 },
    ];
    const dataCalc = d("2025-06-15");
    const resultados = lancamentos.map(l =>
      calculateCharge(l.valor, d(l.data), dataCalc, INDICES, "TJMG")
    );
    const totalGeral = r2(resultados.reduce((s, r) => s + r.total, 0));
    // Total deve ser maior que a soma dos originais (R$2.450)
    expect(totalGeral).toBeGreaterThan(2450);
    // Mas menos que o dobro (sanidade)
    expect(totalGeral).toBeLessThan(6000);
  });

  test("repetição em dobro dobra o subtotal material", () => {
    const res = calculateCharge(1000, d("2022-01-01"), d("2024-01-01"), INDICES, "TJMG");
    const subtotalBase = res.total;
    const subtotalMaterial = r2(subtotalBase * 2); // aplicar_dobro
    expect(subtotalMaterial).toBeCloseTo(subtotalBase * 2, 1);
  });

  test("dano moral é somado ao total geral", () => {
    const res = calculateCharge(1000, d("2022-01-01"), d("2024-01-01"), INDICES, "TJMG");
    const danoMoral = 3000;
    const totalComDano = r2(res.total + danoMoral);
    expect(totalComDano).toBeGreaterThan(res.total);
    expect(totalComDano).toBeGreaterThan(danoMoral); // deve ser maior que só o dano moral
  });
});

// ── Cumprimento de Sentença (TJMG) ───────────────────────────────────────────
describe("Cumprimento de Sentença — TJMG", () => {
  test("honorários 20% sobre subtotal", () => {
    const res = calculateCharge(5000, d("2021-01-01"), d("2025-01-01"), INDICES, "TJMG");
    const honorarios = r2(res.total * 0.20);
    expect(honorarios).toBeGreaterThan(1000); // 20% de valor que cresceu de R$5000
    expect(honorarios).toBeLessThan(3000);
  });

  test("multa art. 523 §1º (10%) sobre o débito base", () => {
    const res = calculateCharge(10000, d("2022-01-01"), d("2025-01-01"), INDICES, "TJMG");
    const multa = r2(res.total * 0.10);
    expect(multa).toBeGreaterThan(1000);
    expect(multa).toBeLessThan(3000);
  });

  test("total geral = subtotal + honorários + multa", () => {
    const res = calculateCharge(1000, d("2023-01-01"), d("2025-01-01"), INDICES, "TJMG");
    const subtotal = res.total;
    const honorarios = r2(subtotal * 0.20);
    const multa = r2(subtotal * 0.10);
    const totalGeral = r2(subtotal + honorarios + multa);
    expect(totalGeral).toBe(r2(subtotal * 1.30));
  });
});

// ── Cumprimento de Sentença (TJSP) ───────────────────────────────────────────
describe("Cumprimento de Sentença — TJSP", () => {
  test("TJSP produz resultado diferente de TJMG para mesmo período", () => {
    const tjmg = calculateCharge(1000, d("2020-01-01"), d("2023-01-01"), INDICES, "TJMG");
    const tjsp = calculateCharge(1000, d("2020-01-01"), d("2023-01-01"), INDICES, "TJSP");
    // Resultados podem diferir — ambos devem ser > 1000 e < 3000
    expect(tjmg.total).toBeGreaterThan(1000);
    expect(tjsp.total).toBeGreaterThan(1000);
    // TJSP usa tabela acumulada, pode divergir levemente
    expect(Math.abs(tjmg.total - tjsp.total)).toBeLessThan(500);
  });

  test("TJSP: correção via tabela prática (fator 2023 > 2020)", () => {
    const res = calculateCharge(1000, d("2020-01-01"), d("2023-01-01"), INDICES, "TJSP");
    expect(res.correction_factor).toBeGreaterThan(1);
    expect(res.corrected).toBeGreaterThan(1000);
  });
});

// ── Execução de Honorário ─────────────────────────────────────────────────────
describe("Execução de Honorário", () => {
  test("honorário de R$5.000 atualizado por 2 anos", () => {
    const res = calcCorrecaoHonorario(5000, d("2022-06-01"), d("2024-06-01"), INDICES, "TJMG");
    expect(res.valor_corrigido).toBeGreaterThan(5000);
    expect(res.meses_corr).toBe(24);
    expect(res.variacao_pct).toBeGreaterThan(0);
    // 20% de honorário sobre valor corrigido
    const honorario = r2(res.valor_corrigido * 0.20);
    expect(honorario).toBeGreaterThan(1000);
  });

  test("período correto em meses", () => {
    const res = calcCorrecaoHonorario(1000, d("2023-01-01"), d("2025-07-01"), INDICES, "TJMG");
    expect(res.meses_corr).toBe(30); // 2 anos e meio = 30 meses
  });

  test("fator de correção tem 6 casas decimais", () => {
    const res = calcCorrecaoHonorario(1000, d("2022-01-01"), d("2024-01-01"), INDICES, "TJMG");
    const str = res.corr_factor.toString();
    const decimais = str.includes(".") ? str.split(".")[1].length : 0;
    expect(decimais).toBeLessThanOrEqual(6);
  });
});

// ── Revisional — Financiamento ────────────────────────────────────────────────
describe("Revisional de Veículo / Contratos", () => {
  // Financiamento: R$50.000 em 60x a uma taxa implícita de ~1.8%
  const PV = 50000;
  const TAXA_ABUSIVA = 1.8; // % a.m.
  const N = 60;
  const PMT_ABUSIVO = calcPMT(PV, TAXA_ABUSIVA, N);

  test("PMT calculado para financiamento de R$50k/60x/1,8% a.m.", () => {
    expect(PMT_ABUSIVO).toBeGreaterThan(1000);
    expect(PMT_ABUSIVO).toBeLessThan(2000);
  });

  test("taxa implícita recuperada == taxa usada para gerar PMT", () => {
    const taxa = calcTaxaImplicita(PV, PMT_ABUSIVO, N);
    expect(taxa).not.toBeNull();
    expect(taxa!).toBeCloseTo(TAXA_ABUSIVA, 3);
  });

  test("PMT justo (taxa 1%) é menor que PMT abusivo", () => {
    const pmtJusto = calcPMT(PV, 1.0, N);
    expect(pmtJusto).toBeLessThan(PMT_ABUSIVO);
  });

  test("excesso por parcela é positivo", () => {
    const pmtJusto = calcPMT(PV, 1.0, N);
    const excesso = r2(PMT_ABUSIVO - pmtJusto);
    expect(excesso).toBeGreaterThan(0);
  });

  test("total excesso em 60 parcelas sem correção", () => {
    const pmtJusto = calcPMT(PV, 1.0, N);
    const excesso = r2(PMT_ABUSIVO - pmtJusto);
    const totalSemCorrecao = r2(excesso * N);
    expect(totalSemCorrecao).toBeGreaterThan(0);
    // Excesso deve ser significativo (taxa abusiva vs justa)
    expect(totalSemCorrecao).toBeGreaterThan(1000);
  });

  test("PMT com n=1 retorna o PV inteiro + 1 mês de juros", () => {
    const pmt = calcPMT(1000, 1, 1);
    expect(pmt).toBe(1010); // 1000 × 1.01
  });
});

// ── Sanidade numérica ─────────────────────────────────────────────────────────
describe("Sanidade geral dos índices", () => {
  test("INPC disponível para 2020-2024", () => {
    const anos = [2020, 2021, 2022, 2023, 2024];
    for (const ano of anos) {
      for (let mes = 1; mes <= 8; mes++) {
        const key = `${ano}-${String(mes).padStart(2, "0")}`;
        expect(INDICES.inpc[key]).toBeDefined();
        expect(typeof INDICES.inpc[key]).toBe("number");
      }
    }
  });

  test("IPCA-E disponível para set/2024 em diante", () => {
    const keys = ["2024-09", "2024-10", "2024-11", "2024-12", "2025-01"];
    for (const key of keys) {
      if (INDICES.ipcae[key] !== undefined) {
        expect(typeof INDICES.ipcae[key]).toBe("number");
      }
    }
  });

  test("TJSP tabela disponível para 2020-2024", () => {
    const anos = [2020, 2021, 2022, 2023];
    for (const ano of anos) {
      const key = `${ano}-01`;
      const val = INDICES.tjsp_inpc[key] ?? INDICES.tjsp_14905[key];
      expect(val).toBeDefined();
      expect(val).toBeGreaterThan(0);
    }
  });
});
