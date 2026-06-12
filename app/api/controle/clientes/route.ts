import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync as getData, saveDataAsync as saveData, newId, normNome, isFinalizado } from "@/lib/controle-data";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const busca = searchParams.get("busca") || "";
  const comProcessos = searchParams.get("com_processos") === "1";

  const data = await getData(tid);
  let lista = [...data.clientes].sort((a, b) => a.nome.localeCompare(b.nome));

  if (busca) {
    const b = busca.toLowerCase();
    lista = lista.filter(c =>
      (c.nome || "").toLowerCase().includes(b) ||
      (c.cpf || "").toLowerCase().includes(b) ||
      (c.telefone || "").toLowerCase().includes(b)
    );
  }

  if (comProcessos) {
    return NextResponse.json(lista.map(c => {
      const cn = normNome(c.nome);
      const procs = data.processos.filter(p => normNome(p.autor || "").includes(cn));
      const ativos = procs.filter(p => !isFinalizado(p));
      const finalizados = procs.filter(p => isFinalizado(p));
      const iniciais = data.iniciais.filter(i => normNome(i.cliente || "").includes(cn));
      return { ...c, _ativos: ativos, _finalizados: finalizados, _iniciais: iniciais };
    }));
  }

  return NextResponse.json(lista);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const body = await req.json();
  const data = await getData(tid);
  const novo = {
    id: newId(), nome: body.nome || "", telefone: body.telefone || "",
    cpf: body.cpf || "", email: body.email || "", endereco: body.endereco || "",
    tipo_aposentadoria: body.tipo_aposentadoria || "", informacoes: body.informacoes || "",
    senha_gov: body.senha_gov || "", senha_serasa: body.senha_serasa || "",
    criado_em: new Date().toISOString(),
  };
  data.clientes.push(novo);
  await saveData(data, tid);
  return NextResponse.json(novo, { status: 201 });
}
