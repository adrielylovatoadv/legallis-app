/**
 * Números vinculados (ex.: cumprimento de sentença no eproc/TJSP, que gera um novo nº CNJ).
 * Regressão principal: um PUT parcial não pode apagar os números já cadastrados — no zod 4
 * o .partial() ainda aplica .default(), por isso o campo não tem default no schema.
 */
import { processoCreateSchema, processoUpdateSchema } from "@/lib/validation/controle";
import { todosNumeros, descricaoNumeros, siglaVinculo, vinculadosPreenchidos } from "@/lib/controle";

const p = {
  numero_processo: "1000123-45.2023.8.26.0100",
  numeros_vinculados: [
    { tipo: "Cumprimento de sentença", numero: "0004567-89.2025.8.26.0100" },
    { tipo: "Agravo de instrumento", numero: "" },
  ],
};

test("PUT sem numeros_vinculados não sobrescreve o campo", () => {
  const r = processoUpdateSchema.parse({ andamento: "AGUARDANDO DESPACHO" });
  expect(r).not.toHaveProperty("numeros_vinculados");
});

test("create aceita a lista e processo antigo sem o campo continua válido", () => {
  expect(processoCreateSchema.parse({ autor: "A", numeros_vinculados: p.numeros_vinculados }).numeros_vinculados).toHaveLength(2);
  expect(processoCreateSchema.parse({ autor: "A" }).numeros_vinculados).toBeUndefined();
});

test("busca considera o número do cumprimento e ignora linhas vazias", () => {
  expect(todosNumeros(p)).toEqual(["1000123-45.2023.8.26.0100", "0004567-89.2025.8.26.0100"]);
  expect(vinculadosPreenchidos(p)).toHaveLength(1);
  expect(todosNumeros({ numero_processo: "X" })).toEqual(["X"]);
});

test("descrição (Google Agenda) inclui o nº do cumprimento", () => {
  expect(descricaoNumeros(p)).toBe(
    "Processo: 1000123-45.2023.8.26.0100 | Cumprimento de sentença: 0004567-89.2025.8.26.0100",
  );
  expect(descricaoNumeros({ numero_processo: "X" })).toBe("Processo: X");
});

test("siglas", () => {
  expect(siglaVinculo("Cumprimento de sentença")).toBe("Cumpr.");
  expect(siglaVinculo("Agravo de instrumento")).toBe("AI");
  expect(siglaVinculo("Processo apensado")).toBe("Apens.");
});
