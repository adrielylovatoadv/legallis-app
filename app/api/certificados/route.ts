import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import * as certificadosRepo from "@/lib/repo/certificados";
import { newId } from "@/lib/controle-data";

const ALLOWED_EXT = ["pfx", "p12"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function statusCertificado(validade?: string): "ativo" | "expirado" | "sem_validade" {
  if (!validade) return "sem_validade";
  return validade < new Date().toISOString().slice(0, 10) ? "expirado" : "ativo";
}

// Metadados públicos ao front — nunca inclui senha nem blobPath (evita expor caminho do
// arquivo privado ou a senha, mesmo que já criptografada em repouso).
function toPublico(c: Awaited<ReturnType<typeof certificadosRepo.list>>[number]) {
  return {
    id: c.id,
    tipo: c.tipo,
    apelido: c.apelido,
    nomeArquivo: c.nomeArquivo,
    titular: c.titular,
    validade: c.validade,
    criado_em: c.criado_em,
    temArquivo: !!c.blobPath,
    status: statusCertificado(c.validade),
  };
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const lista = await certificadosRepo.list(session.user.tenantId);
  return NextResponse.json(lista.map(toPublico));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;

  const formData = await req.formData();
  const tipo = String(formData.get("tipo") || "");
  const apelido = String(formData.get("apelido") || "").trim();
  const titular = String(formData.get("titular") || "").trim();
  const validade = String(formData.get("validade") || "").trim();
  const senha = String(formData.get("senha") || "");
  const arquivo = formData.get("arquivo") as File | null;

  if (tipo !== "A1" && tipo !== "A3") {
    return NextResponse.json({ error: "Tipo deve ser A1 ou A3" }, { status: 400 });
  }
  if (!apelido) return NextResponse.json({ error: "Apelido é obrigatório" }, { status: 400 });

  if (tipo === "A3") {
    const novo = await certificadosRepo.create(tid, {
      userId: session.user.id, tipo, apelido, titular: titular || undefined, validade: validade || undefined,
    });
    return NextResponse.json(toPublico(novo), { status: 201 });
  }

  // A1: exige arquivo .pfx/.p12 + senha
  if (!arquivo) return NextResponse.json({ error: "Arquivo do certificado é obrigatório para A1" }, { status: 400 });
  const ext = arquivo.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: "Formato não suportado. Use .pfx ou .p12" }, { status: 400 });
  }
  if (arquivo.size > MAX_SIZE) return NextResponse.json({ error: "Arquivo muito grande. Máximo 10MB." }, { status: 400 });
  if (!senha) return NextResponse.json({ error: "Senha do certificado é obrigatória" }, { status: 400 });

  const id = newId();
  const pathname = `certificados/${tid}/${id}.${ext}`;
  try {
    await put(pathname, arquivo, { access: "private", addRandomSuffix: false });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar arquivo do certificado." }, { status: 500 });
  }

  const novo = await certificadosRepo.create(tid, {
    userId: session.user.id, tipo, apelido, titular: titular || undefined, validade: validade || undefined,
    nomeArquivo: arquivo.name, blobPath: pathname, senha,
  });
  return NextResponse.json(toPublico(novo), { status: 201 });
}
