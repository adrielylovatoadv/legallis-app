import { resolveSucumbencia, calcExecucao } from "@/lib/financeiro-data";

describe("resolveSucumbencia", () => {
  it("calcula sobre o percebido quando há % arbitrado", () => {
    expect(resolveSucumbencia("processo_completo", 10000, 10, 0)).toBe(1000);
  });

  it("usa o valor em R$ (equidade) quando não há %", () => {
    expect(resolveSucumbencia("processo_completo", 10000, 0, 1500)).toBe(1500);
    expect(resolveSucumbencia("processo_completo", 10000, undefined, 1500)).toBe(1500);
  });

  it("em honorários somente, sempre usa o valor em R$", () => {
    expect(resolveSucumbencia("honorarios_somente", 5000, 10, 800)).toBe(800);
  });

  it("equidade + contratual 35%: honorários = 35% do percebido + sucumbência fixa", () => {
    const suc = resolveSucumbencia("processo_completo", 10000, 0, 1500);
    expect(calcExecucao(10000, suc, "processo_completo", 35)).toBe(5000);
  });
});
