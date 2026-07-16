import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { normNome, isFinalizado } from "@/lib/controle-data";
import { normText } from "@/lib/controle";
import * as clientesRepo from "@/lib/repo/clientes";
import * as processosRepo from "@/lib/repo/processos";
import * as iniciaisRepo from "@/lib/repo/iniciais";
import * as atendimentosRepo from "@/lib/repo/atendimentos";
import { clienteCreateSchema } from "@/lib/validation/controle";
import { parseBody } from "@/lib/validation/helpers";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const busca = searchParams.get("busca") || "";
  const comProcessos = searchParams.get("com_processos") === "1";

  let lista = (await clientesRepo.list(tid)).sort((a, b) => a.nome.localeCompare(b.nome));

  if (busca) {
    const b = normText(busca);
    lista = lista.filter(c =>
      normText(c.nome).includes(b) ||
      normText(c.cpf).includes(b) ||
      normText(c.telefone).includes(b)
    );
  }

  // Nunca expor senhas nem dados bancários sensíveis de clientes na API principal —
  // ver /api/controle/clientes/[id]/senhas e /dados-bancarios para acesso sob demanda.
  const sanitize = ({ senha_gov: _g, senha_serasa: _s, conta: _c, chave_pix: _p, ...rest }: typeof lista[number]) => rest;

  if (comProcessos) {
    const [processos, iniciaisTodas, atendimentosTodos] = await Promise.all([
      processosRepo.list(tid), iniciaisRepo.list(tid), atendimentosRepo.list(tid),
    ]);
    return NextResponse.json(lista.map(c => {
      const cn = normNome(c.nome);
      const procs = processos.filter(p => normNome(p.autor || "").includes(cn));
      const ativos = procs.filter(p => !isFinalizado(p));
      const finalizados = procs.filter(p => isFinalizado(p));
      const iniciais = iniciaisTodas.filter(i => normNome(i.cliente || "").includes(cn));
      const atendimentos = atendimentosTodos.filter(a =>
        a.cliente_id ? a.cliente_id === c.id : normNome(a.cliente || "").includes(cn)
      );
      return { ...sanitize(c), _ativos: ativos, _finalizados: finalizados, _iniciais: iniciais, _atendimentos: atendimentos };
    }));
  }

  return NextResponse.json(lista.map(sanitize));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { data: body, error } = parseBody(clienteCreateSchema, await req.json());
  if (error) return error;
  const novo = await clientesRepo.create(tid, body);
  return NextResponse.json(novo, { status: 201 });
}
