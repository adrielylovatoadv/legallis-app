import { NextRequest, NextResponse } from "next/server";

// Roda no Edge Runtime (rede diferente da função Node/serverless padrão do Vercel) —
// tentativa de contornar o bloqueio de IP que o comunicaapi.pje.jus.br aplica às funções
// Node normais. Só repassa a consulta pública do DJEN; não expõe nada sensível, mas exige
// um segredo interno pra não virar um proxy aberto pra qualquer um na internet.
export const runtime = "edge";

const DJEN_URL = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (!process.env.INTERNAL_PROXY_SECRET || secret !== process.env.INTERNAL_PROXY_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { search } = new URL(req.url);
  const res = await fetch(`${DJEN_URL}${search}`, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "pt-BR,pt;q=0.9",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Referer: "https://comunica.pje.jus.br/",
      Origin: "https://comunica.pje.jus.br",
    },
  });
  const body = await res.text();
  return new NextResponse(body, { status: res.status, headers: { "Content-Type": "application/json" } });
}
