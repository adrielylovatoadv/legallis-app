import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync, saveDataAsync, newId, type ControleData } from "@/lib/controle-data";
import * as XLSX from "xlsx";

function clean(v: unknown): string {
  if (v === null || v === undefined || (typeof v === "number" && isNaN(v))) return "";
  return String(v).trim();
}

function fmtDate(v: unknown): string {
  if (!v || v === "" || v === "NaN") return "";
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return "";
}

function fmtHora(v: unknown): string {
  if (!v || v === "") return "";
  if (typeof v === "number") {
    const total = Math.round(v * 24 * 60);
    const h = Math.floor(total / 60);
    const min = total % 60;
    return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}`;
  }
  const s = String(v).trim();
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  return "";
}

function getSheet(wb: XLSX.WorkBook, names: string[]): Record<string, unknown>[] {
  for (const n of names) {
    const ws = wb.Sheets[n];
    if (ws) return XLSX.utils.sheet_to_json(ws, { defval: "" });
  }
  return [];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const tid = session.user.tenantId;
  const formData = await req.formData();
  const data = await getDataAsync(tid);

  const stats = { clientes: 0, processos: 0, iniciais: 0, finalizados: 0, acordos: 0 };
  const erros: string[] = [];

  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo) return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });

  const buf = await arquivo.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });

  // ── Clientes ──────────────────────────────────────────────────────────────
  const rowsClientes = getSheet(wb, ["Clientes", "clientes", "CLIENTES"]);
  const byNomeCpf = new Map(data.clientes.map(c => [`${c.nome.toUpperCase().trim()}|${c.cpf.replace(/\D/g,"")}`, c]));

  for (let i = 0; i < rowsClientes.length; i++) {
    const r = rowsClientes[i];
    const nome = clean(r["Nome *"] ?? r["Nome"] ?? "");
    if (!nome) { erros.push(`Clientes linha ${i + 2}: Nome ausente`); continue; }
    const cpf = clean(r["CPF"] ?? "");
    const chave = `${nome.toUpperCase().trim()}|${cpf.replace(/\D/g,"")}`;
    const fields = {
      nome,
      cpf,
      telefone:          clean(r["Telefone"] ?? ""),
      email:             clean(r["E-mail"] ?? r["Email"] ?? ""),
      endereco:          clean(r["Endereço"] ?? r["Endereco"] ?? ""),
      tipo_aposentadoria: clean(r["Tipo Aposentadoria"] ?? ""),
      informacoes:       clean(r["Informações"] ?? r["Informacoes"] ?? ""),
    };
    if (byNomeCpf.has(chave)) {
      Object.assign(byNomeCpf.get(chave)!, fields);
    } else {
      const novo = { id: newId(), criado_em: new Date().toISOString(), senha_gov: "", senha_serasa: "", ...fields };
      data.clientes.push(novo);
      byNomeCpf.set(chave, novo);
      stats.clientes++;
    }
  }

  // ── Processos Ativos ─────────────────────────────────────────────────────
  const rowsProcessos = getSheet(wb, ["Processos Ativos", "Processos", "processos", "PROCESSOS"]);
  const byNum = new Map(data.processos.map(p => [p.numero_processo, p]));

  for (let i = 0; i < rowsProcessos.length; i++) {
    const r = rowsProcessos[i];
    const autor = clean(r["Autor *"] ?? r["Autor"] ?? "");
    if (!autor) { erros.push(`Processos linha ${i + 2}: Autor ausente`); continue; }
    const num = clean(r["Nº Processo"] ?? r["Processo"] ?? r["numero_processo"] ?? "");
    const atencao = clean(r["Atenção (SIM/NÃO)"] ?? r["Atencao"] ?? "").toUpperCase() === "SIM";
    const fields = {
      autor,
      reu:             clean(r["Réu"] ?? r["Reu"] ?? ""),
      objeto:          clean(r["Objeto"] ?? ""),
      numero_processo: num,
      data:            fmtDate(r["Data (DD/MM/AAAA)"] ?? r["Data"] ?? ""),
      hora:            fmtHora(r["Hora (HH:MM)"] ?? r["Hora"] ?? ""),
      andamento:       clean(r["Andamento"] ?? ""),
      responsavel:     clean(r["Responsável"] ?? r["Responsavel"] ?? ""),
      observacoes:     clean(r["Observações"] ?? r["Observacoes"] ?? ""),
      atencao,
      finalizado:      false,
    };
    if (num && byNum.has(num)) {
      Object.assign(byNum.get(num)!, fields);
    } else {
      const novo = { id: newId(), criado_em: new Date().toISOString(), dashboard_ok: false, ...fields };
      data.processos.push(novo);
      if (num) byNum.set(num, novo);
    }
    stats.processos++;
  }

  // ── Iniciais ─────────────────────────────────────────────────────────────
  const rowsIniciais = getSheet(wb, ["Iniciais", "iniciais", "INICIAIS"]);
  const norm = (s: string) => s.toUpperCase().trim();
  const byIniKey = new Map<string, (typeof data.iniciais)[0]>();
  for (const i of data.iniciais) byIniKey.set(`${norm(i.cliente)}|${norm(i.reu)}`, i);

  for (let i = 0; i < rowsIniciais.length; i++) {
    const r = rowsIniciais[i];
    const cliente = clean(r["Cliente *"] ?? r["Cliente"] ?? "");
    if (!cliente) { erros.push(`Iniciais linha ${i + 2}: Cliente ausente`); continue; }
    const reu = clean(r["Réu"] ?? r["Reu"] ?? "");
    const key = `${norm(cliente)}|${norm(reu)}`;
    const fields = {
      cliente,
      reu,
      objeto:      clean(r["Objeto"] ?? ""),
      andamento:   clean(r["Andamento"] ?? "FAZER INICIAL"),
      responsavel: clean(r["Responsável"] ?? r["Responsavel"] ?? ""),
      observacoes: clean(r["Observações"] ?? r["Observacoes"] ?? ""),
    };
    if (byIniKey.has(key)) {
      Object.assign(byIniKey.get(key)!, fields);
    } else {
      const novo = { id: newId(), criado_em: new Date().toISOString(), ...fields };
      data.iniciais.push(novo);
      byIniKey.set(key, novo);
    }
    stats.iniciais++;
  }

  // ── Finalizados ───────────────────────────────────────────────────────────
  const rowsFinalizados = getSheet(wb, ["Finalizados", "finalizados", "FINALIZADOS"]);
  if (rowsFinalizados.length > 0) {
    const existing = (data as ControleData).finalizados_externos_sem_honor ?? [];
    const byKey = new Map(existing.map(f => [`${f.processo}|${f.cliente.toUpperCase()}|${f.reu.toUpperCase()}`, f]));
    for (const r of rowsFinalizados) {
      const tipo = clean(r["Tipo * (Execução / Improcedente / Desistência / Outros)"] ?? r["Tipo"] ?? "").toUpperCase();
      if (tipo === "ACORDO") continue;
      const novo = {
        cliente:  clean(r["Cliente *"] ?? r["Cliente"] ?? ""),
        reu:      clean(r["Réu"] ?? r["Reu"] ?? ""),
        processo: clean(r["Nº Processo"] ?? r["Processo"] ?? ""),
        objeto:   clean(r["Objeto"] ?? ""),
        data_fin: fmtDate(r["Data Finalização (DD/MM/AAAA)"] ?? r["Data Finalização"] ?? ""),
        motivo:   [
          clean(r["Tipo * (Execução / Improcedente / Desistência / Outros)"] ?? r["Tipo"] ?? ""),
          clean(r["Motivo / Observações"] ?? r["Motivo"] ?? ""),
        ].filter(Boolean).join(" — "),
      };
      const key = `${novo.processo}|${novo.cliente.toUpperCase()}|${novo.reu.toUpperCase()}`;
      if (byKey.has(key)) Object.assign(byKey.get(key)!, novo);
      else { existing.push(novo); byKey.set(key, novo); stats.finalizados++; }
    }
    (data as ControleData).finalizados_externos_sem_honor = existing;
  }

  // ── Acordos ───────────────────────────────────────────────────────────────
  const rowsAcordos = getSheet(wb, ["Acordos", "acordos", "ACORDOS"]);
  if (rowsAcordos.length > 0) {
    const existingAc = (data as ControleData).finalizados_externos_acordos ?? [];
    const byAcKey = new Map(existingAc.map(a => [`${a.processo}|${a.cliente.toUpperCase()}|${a.mes}`, a]));
    for (const r of rowsAcordos) {
      const novo = {
        mes:             clean(r["Mês"] ?? r["Mes"] ?? ""),
        data_pagamento:  clean(r["Data Pagamento (DD/MM/AAAA)"] ?? r["Data Pagamento"] ?? ""),
        cliente:         clean(r["Cliente *"] ?? r["Cliente"] ?? ""),
        reu:             clean(r["Réu"] ?? r["Reu"] ?? ""),
        processo:        clean(r["Nº Processo"] ?? r["Processo"] ?? ""),
        objeto:          clean(r["Objeto"] ?? ""),
        valor_acordo:    Number(r["Valor Acordo (R$)"] ?? 0) || 0,
        honorarios:      Number(r["Honorários (R$)"] ?? r["Honorarios (R$)"] ?? 0) || 0,
        repasse_cliente: Number(r["Repasse ao Cliente (R$)"] ?? 0) || 0,
        status:          clean(r["Status (Pago / Pendente)"] ?? r["Status"] ?? ""),
      };
      const key = `${novo.processo}|${novo.cliente.toUpperCase()}|${novo.mes}`;
      if (byAcKey.has(key)) Object.assign(byAcKey.get(key)!, novo);
      else { existingAc.push(novo); byAcKey.set(key, novo); stats.acordos++; }
    }
    (data as ControleData).finalizados_externos_acordos = existingAc;
  }

  await saveDataAsync(data, tid);
  return NextResponse.json({ ok: true, stats, erros: erros.length > 0 ? erros : undefined });
}
