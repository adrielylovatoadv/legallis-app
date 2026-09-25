import { parseBRL } from "@/components/ui/CurrencyInput";

describe("parseBRL", () => {
  it.each([
    ["5.370,00", 5370],
    ["5370,50", 5370.5],
    ["5370.50", 5370.5],
    ["5370", 5370],
    ["5.370", 5370],
    ["1.234.567,89", 1234567.89],
    ["0,5", 0.5],
    ["5372.77", 5372.77],
    ["5.370,555", 5370.56],
    ["", 0],
    ["abc", 0],
  ])("%s → %d", (entrada, esperado) => {
    expect(parseBRL(entrada)).toBe(esperado);
  });
});
