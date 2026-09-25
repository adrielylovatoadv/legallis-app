// Gênero gramatical usado no cadastro de clientes e na qualificação dos advogados
// nos modelos de documento. Só existem duas opções: Feminino e Masculino.

export type Genero = "feminino" | "masculino";

export const GENERO_LABEL: Record<Genero, string> = { feminino: "Feminino", masculino: "Masculino" };

// Aceita o valor novo ("Feminino"/"masculino") e os valores antigos do campo
// "Tratamento" (Senhora, Doutora, Senhor, Doutor...), que eram texto livre.
export function normalizarGenero(v?: string | null): Genero | undefined {
  const s = (v ?? "").trim().toLowerCase();
  if (!s) return undefined;
  if (s === "feminino" || s === "f" || s === "senhora" || s === "doutora" || s === "dra." || s === "dra") return "feminino";
  if (s === "masculino" || s === "m" || s === "senhor" || s === "doutor" || s === "dr." || s === "dr") return "masculino";
  return undefined;
}

// Valor gravado no cadastro do cliente (coluna `tratamento`).
export function generoParaCadastro(v?: string | null): string {
  const g = normalizarGenero(v);
  return g ? GENERO_LABEL[g] : "";
}

// Flexiona marcadores de gênero escritos como "(a)" nos modelos:
//   solteiro(a) → solteira/solteiro · do(a) → da/do · defendê-lo(a) → defendê-la/defendê-lo
//   portador(a) → portadora/portador · ré(u) → ré/réu · ao(à) → à/ao
// Sem gênero definido, o texto fica como está (com "(a)").
export function flexionar(texto: string, g?: Genero): string {
  if (!g) return texto;
  const f = g === "feminino";
  return texto
    .replace(/ao\(à\)/g, f ? "à" : "ao")
    .replace(/ré\(u\)/g, f ? "ré" : "réu")
    .replace(/o\(a\)/g, f ? "a" : "o")
    .replace(/\(a\)/g, f ? "a" : "");
}

// Gênero de um grupo: só é feminino se todos forem feminino; se houver algum
// masculino, vale o masculino (regra gramatical). Sem informação → indefinido.
export function generoDoGrupo(generos: Array<Genero | undefined>): Genero | undefined {
  if (generos.length === 0 || generos.some(g => !g)) return undefined;
  return generos.every(g => g === "feminino") ? "feminino" : "masculino";
}

// Tratamento de cortesia para exibição ("Dra."/"Dr.").
export function tituloAdvogado(g?: Genero): string {
  return g === "feminino" ? "Dra." : g === "masculino" ? "Dr." : "";
}
