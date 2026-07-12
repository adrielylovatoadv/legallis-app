import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import * as publicacoesRepo from "@/lib/repo/publicacoes";
import { buscarComunicacoesPorOab } from "@/lib/integrations/djen";
import { buscarPublicacoesPorOab as buscarEscavador, escavadorConfigurado } from "@/lib/integrations/escavador";
import { buscarPublicacoesSchema } from "@/lib/validation/publicacoes";
import { parseBody } from "@/lib/validation/helpers";
import type { Publicacao } from "@/lib/controle-data";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const tid = session.user.tenantId;
  const { data: body, error } = parseBody(buscarPublicacoesSchema, await req.json());
  if (error) return error;

  const candidatos: Omit<Publicacao, "id" | "criado_em" | "tratada">[] = [];
  const fontesComErro: string[] = [];

  try {
    const djen = await buscarComunicacoesPorOab({
      numeroOab: body.oabNumero,
      ufOab: body.oabUf,
      dataDisponibilizacaoInicio: body.dataDisponibilizacaoInicio,
      dataDisponibilizacaoFim: body.dataDisponibilizacaoFim,
    });
    for (const item of djen) {
      candidatos.push({
        oabNumero: body.oabNumero,
        oabUf: body.oabUf,
        numeroProcesso: item.numeroprocessocommascara || item.numero_processo,
        orgao: item.nomeOrgao,
        tipoComunicacao: item.tipoComunicacao,
        dataDisponibilizacao: item.data_disponibilizacao,
        texto: item.texto,
        fonte: "djen",
        fonteId: String(item.id),
        raw: item,
      });
    }
  } catch (e) {
    fontesComErro.push("djen");
    console.error("Erro ao buscar publicações no DJEN:", e);
  }

  if (escavadorConfigurado()) {
    try {
      const escavador = await buscarEscavador(body.oabNumero, body.oabUf);
      for (const item of escavador) {
        candidatos.push({
          oabNumero: body.oabNumero,
          oabUf: body.oabUf,
          numeroProcesso: item.numeroProcesso,
          texto: item.texto,
          dataDisponibilizacao: item.data,
          fonte: "escavador",
          fonteId: item.fonteId,
          raw: item,
        });
      }
    } catch (e) {
      fontesComErro.push("escavador");
      console.error("Erro ao buscar publicações no Escavador:", e);
    }
  }

  if (candidatos.length === 0 && fontesComErro.length > 0) {
    return NextResponse.json({ error: `Falha ao consultar: ${fontesComErro.join(", ")}` }, { status: 502 });
  }

  const novas = await publicacoesRepo.upsertNovas(tid, candidatos);
  return NextResponse.json({ novas, total: candidatos.length, fontesComErro });
}
