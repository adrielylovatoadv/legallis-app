import { flexionar, generoDoGrupo, generoParaCadastro, normalizarGenero } from "@/lib/genero";

describe("genero", () => {
  it("normaliza valores antigos de tratamento", () => {
    expect(generoParaCadastro("Senhora")).toBe("Feminino");
    expect(generoParaCadastro("Doutora")).toBe("Feminino");
    expect(generoParaCadastro("Senhor")).toBe("Masculino");
    expect(generoParaCadastro("Doutor")).toBe("Masculino");
    expect(generoParaCadastro("masculino")).toBe("Masculino");
    expect(generoParaCadastro("Excelentíssimo")).toBe("");
    expect(generoParaCadastro(null)).toBe("");
  });

  it("flexiona marcadores (a)", () => {
    const t = "solteiro(a), portador(a) do CPF, domiciliado(a), do(a) outorgante, defendê-lo(a), autor(a) como ré(u), ao(à)";
    expect(flexionar(t, "feminino")).toBe("solteira, portadora do CPF, domiciliada, da outorgante, defendê-la, autora como ré, à");
    expect(flexionar(t, "masculino")).toBe("solteiro, portador do CPF, domiciliado, do outorgante, defendê-lo, autor como réu, ao");
    expect(flexionar(t, undefined)).toBe(t);
  });

  it("gênero do grupo de advogados", () => {
    expect(generoDoGrupo(["feminino", "feminino"])).toBe("feminino");
    expect(generoDoGrupo(["feminino", "masculino"])).toBe("masculino");
    expect(generoDoGrupo(["feminino", undefined])).toBeUndefined();
    expect(normalizarGenero("")).toBeUndefined();
  });
});
