import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isOwner } from "@/lib/users";
import { getSql, hasDb, dbInit } from "@/lib/db";
import * as XLSX from "xlsx";

// Rota de importação TEMPORÁRIA — recupera senha_gov/senha_serasa a partir de uma planilha
// (aba "CLIENTES", colunas NOME / SENHA GOV / SENHA SERASA), incidente de 22/08/2026 (perda da
// FIELD_ENCRYPT_KEY). Só sobrescreve clientes cujo campo já está vazio ou ilegível (prefixo
// "enc:") — nunca troca uma senha que já esteja legível. Nunca retorna nenhuma senha na
// resposta, só nomes e status. Remover depois de concluída a recuperação.

function normNome(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

function precisaRecuperar(valor: string | null): boolean {
  return !valor || valor.startsWith("enc:");
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const ownerOk = isOwner({ id: session.user.id, tenantId: session.user.tenantId });
  if (!ownerOk && session.user.plan !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  if (!hasDb()) return NextResponse.json({ error: "Sem banco configurado" }, { status: 400 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = wb.SheetNames.find(n => n.toUpperCase() === "CLIENTES") ?? wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" }) as unknown[][];

  const porNome = new Map<string, { senha_gov: string; senha_serasa: string; duplicado: boolean }>();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const nome = String(row[0] || "").trim();
    if (!nome) continue;
    const key = normNome(nome);
    const senha_gov = String(row[5] || "").trim();
    const senha_serasa = String(row[6] || "").trim();
    if (!senha_gov && !senha_serasa) continue;
    if (porNome.has(key)) {
      porNome.get(key)!.duplicado = true;
    } else {
      porNome.set(key, { senha_gov, senha_serasa, duplicado: false });
    }
  }

  await dbInit();
  const sql = getSql()!;
  const tid = session.user.tenantId;
  const clientes = await sql`
    SELECT id, nome, senha_gov, senha_serasa FROM clientes WHERE tenant_id = ${tid}
  ` as { id: string; nome: string; senha_gov: string; senha_serasa: string }[];

  const recuperados: string[] = [];
  const limpos: string[] = [];
  const ambiguos: string[] = [];
  const semAlteracao: string[] = [];
  const naoEncontradosNaPlanilha: string[] = [];

  for (const c of clientes) {
    const key = normNome(c.nome);
    const match = porNome.get(key);
    const govPrecisa = precisaRecuperar(c.senha_gov);
    const serasaPrecisa = precisaRecuperar(c.senha_serasa);
    if (!govPrecisa && !serasaPrecisa) { semAlteracao.push(c.nome); continue; }

    if (match?.duplicado) { ambiguos.push(c.nome); continue; }

    const novoGov = govPrecisa ? (match?.senha_gov || "") : c.senha_gov;
    const novoSerasa = serasaPrecisa ? (match?.senha_serasa || "") : c.senha_serasa;

    if (novoGov === c.senha_gov && novoSerasa === c.senha_serasa) {
      naoEncontradosNaPlanilha.push(c.nome);
      continue;
    }

    await sql`UPDATE clientes SET senha_gov = ${novoGov}, senha_serasa = ${novoSerasa} WHERE tenant_id = ${tid} AND id = ${c.id}`;
    if (match) recuperados.push(c.nome);
    else limpos.push(c.nome);
  }

  return NextResponse.json({
    totalClientesNoSistema: clientes.length,
    totalLinhasNaPlanilha: porNome.size,
    recuperados: { total: recuperados.length, nomes: recuperados },
    limposSemCorrespondencia: { total: limpos.length, nomes: limpos },
    ambiguosNaPlanilha: { total: ambiguos.length, nomes: ambiguos },
    naoEncontradosNaPlanilha: { total: naoEncontradosNaPlanilha.length, nomes: naoEncontradosNaPlanilha },
    jaEstavamOk: semAlteracao.length,
  });
}
