// Escavador — fonte paga (com franquia gratuita limitada em trial), cobre publicações e
// processos fora do alcance do DJEN (tribunais que não aderiram ao PJe, dados históricos).
// Ainda não configurado: a usuária não tem token hoje. Este stub deixa o encaixe pronto —
// quando houver ESCAVADOR_API_TOKEN em .env.local, implementar a chamada real aqui seguindo
// a documentação em https://api.escavador.com/docs (endpoint de busca de processos por OAB).
// Enquanto não configurado, buscarPublicacoesPorOab() retorna [] silenciosamente — a busca
// principal (DJEN) não deve falhar por causa desta fonte opcional.

export interface EscavadorPublicacao {
  numeroProcesso?: string;
  texto?: string;
  data?: string;
  fonteId?: string;
  [key: string]: unknown;
}

export function escavadorConfigurado(): boolean {
  return !!process.env.ESCAVADOR_API_TOKEN;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function buscarPublicacoesPorOab(_numeroOab: string, _ufOab: string): Promise<EscavadorPublicacao[]> {
  if (!escavadorConfigurado()) return [];
  // TODO: implementar a chamada real assim que houver token — ver docs acima.
  return [];
}
