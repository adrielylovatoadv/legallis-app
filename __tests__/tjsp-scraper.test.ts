/**
 * Testes do parser da Tabela Prática do TJSP (Lei 14.905/2024).
 * O fixture é o texto real extraído (pdf-parse) do PDF oficial publicado em 01/08/2026.
 */
import fs from "fs";
import path from "path";
import { parseTabelaPratica, mergeTjspForward } from "../lib/tjsp-scraper";

const FIXTURE = fs.readFileSync(
  path.join(process.cwd(), "__tests__", "fixtures", "tjsp-tabela-pratica-sample.txt"),
  "utf-8"
);

describe("parseTabelaPratica", () => {
  test("lê o último bloco (mais recente) da tabela, com os meses de 2026 até agosto", () => {
    const result = parseTabelaPratica(FIXTURE);
    expect(result["2026-05"]).toBeCloseTo(104.41444, 6);
    expect(result["2026-06"]).toBeCloseTo(105.061809, 6);
    expect(result["2026-07"]).toBeCloseTo(105.492562, 6);
    expect(result["2026-08"]).toBeCloseTo(105.555857, 6);
  });

  test("não inclui meses futuros ainda não publicados (set/2026 em diante)", () => {
    const result = parseTabelaPratica(FIXTURE);
    expect(result["2026-09"]).toBeUndefined();
  });

  test("também lê anos anteriores do mesmo bloco (2021-2025)", () => {
    const result = parseTabelaPratica(FIXTURE);
    expect(result["2021-05"]).toBeCloseTo(78.793814, 6);
    expect(result["2025-08"]).toBeCloseTo(100.995235, 6);
  });

  test("lança erro se não houver cabeçalho de ano reconhecível", () => {
    expect(() => parseTabelaPratica("nada aqui parece uma tabela")).toThrow();
  });
});

describe("mergeTjspForward", () => {
  const current = { "2026-05": 104.41444, "2026-06": 105.061809 };

  test("adiciona meses novos que vêm depois do último mês já salvo", () => {
    const parsed = { "2026-06": 105.061809, "2026-07": 105.492562, "2026-08": 105.555857 };
    const merged = mergeTjspForward(current, parsed);
    expect(merged["2026-07"]).toBe(105.492562);
    expect(merged["2026-08"]).toBe(105.555857);
  });

  test("nunca sobrescreve um mês já salvo, mesmo que o parse repita o valor", () => {
    const parsed = { "2026-05": 104.41444, "2026-06": 105.061809 };
    const merged = mergeTjspForward(current, parsed);
    expect(merged).toEqual(current);
  });

  test("aborta (lança erro) se o valor parseado para um mês já salvo divergir do atual", () => {
    const parsed = { "2026-06": 999.999999 };
    expect(() => mergeTjspForward(current, parsed)).toThrow();
  });
});
