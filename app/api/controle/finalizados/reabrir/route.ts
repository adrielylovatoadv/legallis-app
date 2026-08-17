import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasControleRestrito } from "@/lib/acl";
import { hasDb, getSql } from "@/lib/db";
import { getDataAsync, saveDataAsync, newId } from "@/lib/controle-data";
import * as processosRepo from "@/lib/repo/processos";
import * as finalizadosRepo from "@/lib/repo/finalizados-sem-honor";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (hasControleRestrito(session.user.cargo)) return NextResponse.json({ error: "Sem permissão para este módulo" }, { status: 403 });
  const tid = session.user.tenantId;
  const { id }: { id: string } = await req.json();

  // Constrói (sem id/criado_em) o processo a recriar quando a entrada finalizada não tem
  // processo correspondente ativo — caso comum de entradas "externas", cadastradas direto
  // em Finalizados sem nunca ter passado pela tabela processos. Sem isso, reabrir uma
  // entrada "externa" apagava o registro e não recriava nada: o processo sumia de vez.
  const buildRecriado = (fields: { cliente: string; reu: string; objeto: string; processo: string }, origem: string) => ({
    autor: fields.cliente || "", reu: fields.reu || "", objeto: fields.objeto || "",
    numero_processo: fields.processo || "", data: "", hora: "", andamento: "",
    responsavel: "", observacoes: `Reaberto de "${origem}"`, atencao: false, finalizado: false,
  });

  // Acordos migrados do Financeiro não têm registro em finalizados_sem_honor — vivem
  // como array simples dentro do blob de controle, identificados por índice (ver
  // app/api/controle/finalizados/route.ts). Reabrir aqui só remove a entrada do array
  // e reabre o processo; não há transação SQL possível entre os dois (blob vs. tabela).
  if (id.startsWith("acordo_")) {
    const idx = Number(id.slice("acordo_".length));
    const data = await getDataAsync(tid);
    const acordos = data.finalizados_externos_acordos || [];
    const alvo = acordos[idx];
    if (!alvo) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    const processos = alvo.processo ? await processosRepo.list(tid) : [];
    const proc = processos.find(p => p.numero_processo === alvo.processo);
    data.finalizados_externos_acordos = acordos.filter((_, i) => i !== idx);
    await saveDataAsync(data, tid);
    if (proc) await processosRepo.update(tid, proc.id, { andamento: "", finalizado: false });
    else await processosRepo.create(tid, buildRecriado(alvo, "Acordo (Financeiro)"));
    return NextResponse.json({ ok: true, processoReaberto: true });
  }

  const entry = await finalizadosRepo.get(tid, id);
  if (!entry) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const processos = entry.processo ? await processosRepo.list(tid) : [];
  const proc = processos.find(p => p.numero_processo === entry.processo);

  // No modo banco, apagar o finalizado e reabrir (ou recriar) o processo viram uma única
  // transação — nunca fica o finalizado removido sem o processo voltar a aparecer como ativo.
  if (hasDb()) {
    const sql = getSql()!;
    const statements = [finalizadosRepo.buildRemoveStatement(tid, id)];
    if (proc) statements.push(processosRepo.buildUpdateStatement(tid, { ...proc, andamento: "", finalizado: false }));
    else statements.push(processosRepo.buildCreateStatement(tid, { ...buildRecriado(entry, "Finalizados sem honorários"), id: newId(), criado_em: new Date().toISOString() }));
    await sql.transaction(statements);
  } else {
    if (proc) await processosRepo.update(tid, proc.id, { andamento: "", finalizado: false });
    else await processosRepo.create(tid, buildRecriado(entry, "Finalizados sem honorários"));
    await finalizadosRepo.remove(tid, id);
  }

  return NextResponse.json({ ok: true, processoReaberto: true });
}
