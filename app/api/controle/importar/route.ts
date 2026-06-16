import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataAsync, saveDataAsync, newId } from "@/lib/controle-data";
import * as XLSX from "xlsx";

function clean(v: unknown): string {
  if (v === null || v === undefined || (typeof v === "number" && isNaN(v))) return "";
  return String(v).trim();
}

function fmtDate(v: unknown): string {
  if (!v || v === "" || v === "NaN") return "";
  // xlsx serial date number
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const s = String(v).trim();
  // already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return "";
}

function fmtHora(v: unknown): string {
  if (!v || v === "") return "";
  if (typeof v === "number") {
    // fraction of a day
    const total = Math.round(v * 24 * 60);
    const h = Math.floor(total / 60);
    const min = total % 60;
    return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}`;
  }
  const s = String(v).trim();
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  return "";
}

function parseSheet(buf: ArrayBuffer): Record<string, unknown>[] {
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const tid = session.user.tenantId;
  const formData = await req.formData();
  const data = await getDataAsync(tid);

  const stats = { processos: 0, iniciais: 0, finalizados_sem: 0, finalizados_acordos: 0 };

  // ── PROCESSOS ─────────────────────────────────────────────────────────────
  const fProc = formData.get("processos") as File | null;
  if (fProc) {
    const rows = parseSheet(await fProc.arrayBuffer());
    const byNum = new Map(data.processos.map(p => [p.numero_processo, p]));

    for (const row of rows) {
      const num = clean(row["Processo"] ?? row["Nº Processo"] ?? row["numero_processo"] ?? "");
      if (!num) continue;
      const atencao = clean(row["Atenção"] ?? row["Atencao"] ?? "").toUpperCase() === "SIM";
      const fields = {
        autor:           clean(row["Autor"]),
        reu:             clean(row["Réu"] ?? row["Reu"]),
        objeto:          clean(row["Objeto"]),
        numero_processo: num,
        data:            fmtDate(row["Data"]),
        hora:            fmtHora(row["Hora"]),
        andamento:       clean(row["Andamento"]),
        observacoes:     clean(row["Observações"] ?? row["Observacoes"]),
        responsavel:     clean(row["Responsável"] ?? row["Responsavel"]),
        atencao,
      };
      if (byNum.has(num)) {
        Object.assign(byNum.get(num)!, fields);
      } else {
        data.processos.push({ id: newId(), criado_em: new Date().toISOString(), finalizado: false, dashboard_ok: false, ...fields });
      }
      stats.processos++;
    }
  }

  // ── INICIAIS ──────────────────────────────────────────────────────────────
  const fIni = formData.get("iniciais") as File | null;
  if (fIni) {
    const rows = parseSheet(await fIni.arrayBuffer());
    type IniKey = { cliente: string; reu: string; objeto: string };
    const norm = (s: string) => s.toUpperCase().trim();
    const byKey = new Map<string, (typeof data.iniciais)[0]>();
    for (const i of data.iniciais) {
      byKey.set(`${norm(i.cliente)}|${norm(i.reu)}|${norm(i.objeto)}`, i);
    }

    const seen = new Set<string>();
    for (const row of rows) {
      const cli = clean(row["Cliente"]);
      const reu = clean(row["Réu"] ?? row["Reu"] ?? "");
      const obj = clean(row["Objeto"]);
      const key = `${norm(cli)}|${norm(reu)}|${norm(obj)}`;
      const fields = {
        cliente:     cli,
        reu,
        objeto:      obj,
        andamento:   clean(row["Status"] ?? row["Andamento"]),
        responsavel: clean(row["Responsável"] ?? row["Responsavel"] ?? ""),
        observacoes: clean(row["Observações"] ?? row["Observacoes"] ?? ""),
      };
      seen.add(key);
      if (byKey.has(key)) {
        Object.assign(byKey.get(key)!, fields);
      } else {
        const novo = { id: newId(), criado_em: new Date().toISOString(), ...fields };
        data.iniciais.push(novo);
        byKey.set(key, novo);
      }
      stats.iniciais++;
    }

    // Mark as PROTOCOLADO entries not in the uploaded sheet (they were completed)
    // Only for non-already-protocolado/arquivado entries
    for (const [key, ini] of byKey.entries()) {
      if (!seen.has(key)) {
        const a = (ini.andamento || "").toUpperCase();
        if (a !== "PROTOCOLADO" && a !== "ARQUIVADO") {
          ini.andamento = "PROTOCOLADO";
        }
      }
    }
  }

  // ── FINALIZADOS SEM HONORÁRIO ─────────────────────────────────────────────
  const fFin = formData.get("finalizados_sem_honorario") as File | null;
  if (fFin) {
    const rows = parseSheet(await fFin.arrayBuffer());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).finalizados_externos_sem_honor = rows.map(r => ({
      cliente:  clean(r["Cliente"]),
      reu:      clean(r["Réu"] ?? r["Reu"] ?? ""),
      processo: clean(r["Processo"]),
      objeto:   clean(r["Objeto"]),
      data_fin: fmtDate(r["Data Finalização"] ?? r["Data Finalizacao"] ?? ""),
      motivo:   clean(r["Motivo"]),
    }));
    stats.finalizados_sem = rows.length;
  }

  // ── FINALIZADOS COM ACORDO ────────────────────────────────────────────────
  const fAcordos = formData.get("finalizados_acordos") as File | null;
  if (fAcordos) {
    const rows = parseSheet(await fAcordos.arrayBuffer());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).finalizados_externos_acordos = rows.map(r => ({
      mes:             clean(r["Mês"] ?? r["Mes"] ?? ""),
      data_pagamento:  clean(r["Data Pagamento"] ?? ""),
      cliente:         clean(r["Cliente"]),
      reu:             clean(r["Réu"] ?? r["Reu"] ?? ""),
      objeto:          clean(r["Objeto"]),
      valor_acordo:    Number(r["Valor Acordo (R$)"] ?? 0) || 0,
      honorarios:      Number(r["Honorários (R$)"] ?? r["Honorarios (R$)"] ?? 0) || 0,
      status:          clean(r["Status"]),
      processo:        clean(r["Processo"]),
      repasse_cliente: Number(r["Repasse ao Cliente (R$)"] ?? 0) || 0,
    }));
    stats.finalizados_acordos = rows.length;
  }

  await saveDataAsync(data, tid);
  return NextResponse.json({ ok: true, stats });
}
