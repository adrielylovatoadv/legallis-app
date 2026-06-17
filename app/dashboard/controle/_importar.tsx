"use client";

import { useRef, useState } from "react";

interface FileSlot {
  key: string;
  label: string;
  desc: string;
  colunas: string;
}

const SLOTS: FileSlot[] = [
  {
    key: "clientes_processos",
    label: "Clientes e Processos (Modelo Unificado)",
    desc: "Importa clientes e cria processos vinculados automaticamente",
    colunas: "Nome do cliente · CPF · Telefone · E-mail · Número do processo · Vara · Tribunal · Status · Data de distribuição · Observações",
  },
  {
    key: "processos",
    label: "Processos",
    desc: "Lista de processos ativos",
    colunas: "Autor · Réu · Objeto · Processo · Data · Hora · Andamento · Observações · Responsável · Atenção",
  },
  {
    key: "iniciais",
    label: "Iniciais",
    desc: "Iniciais pendentes",
    colunas: "Cliente · Réu · Objeto · Status · Responsável · Observações",
  },
  {
    key: "finalizados_sem_honorario",
    label: "Finalizados sem honorário",
    desc: "Processos encerrados sem cobrança",
    colunas: "Cliente · Réu · Processo · Objeto · Data Finalização · Motivo",
  },
  {
    key: "finalizados_acordos",
    label: "Finalizados com acordo",
    desc: "Acordos e honorários recebidos",
    colunas: "Mês · Data Pagamento · Cliente · Réu · Objeto · Valor Acordo · Honorários · Status · Processo · Repasse ao Cliente",
  },
];

type Status = "idle" | "loading" | "success" | "error";

function DropZone({
  slot,
  file,
  onFile,
}: {
  slot: FileSlot;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = (f: File | null) => {
    if (!f) return;
    if (!f.name.match(/\.xlsx?$/i)) return;
    onFile(f);
  };

  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files[0]); }}
      className="rounded-xl p-5 cursor-pointer transition-all"
      style={{
        border: `2px dashed ${file ? "var(--gold)" : over ? "var(--gold)" : "var(--border)"}`,
        background: file ? "rgba(201,168,76,0.06)" : over ? "rgba(201,168,76,0.04)" : "var(--surface)",
      }}
    >
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={e => handle(e.target.files?.[0] ?? null)}
      />
      <div className="flex items-start gap-3">
        <div className="text-2xl mt-0.5">{file ? "✅" : "📄"}</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
            {slot.label}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
            {slot.desc}
          </p>
          {file ? (
            <p className="text-xs mt-1.5 font-medium truncate" style={{ color: "var(--gold)" }}>
              {file.name}
            </p>
          ) : (
            <p className="text-xs mt-1.5" style={{ color: "var(--text3)" }}>
              Clique ou arraste o arquivo .xlsx
            </p>
          )}
          <p className="text-xs mt-1 italic" style={{ color: "var(--text3)", opacity: 0.7 }}>
            {slot.colunas}
          </p>
        </div>
        {file && (
          <button
            onClick={e => { e.stopPropagation(); onFile(null); }}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{ color: "var(--text3)", background: "var(--surface2)" }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function baixarModelo() {
  const csvContent = [
    ["Nome do cliente", "CPF", "Telefone", "E-mail", "Número do processo", "Vara", "Tribunal", "Status", "Data de distribuição", "Observações"],
    ["João Silva", "123.456.789-00", "(31) 99999-0001", "joao@email.com", "0000001-00.2024.8.13.0024", "1ª Vara Cível", "TJMG", "AGUARDANDO DESPACHO", "15/01/2024", "Cobrança indevida Banco XYZ"],
    ["Maria Souza", "987.654.321-00", "(31) 98888-0002", "maria@email.com", "0000002-00.2024.8.13.0024", "2ª Vara Cível", "TJMG", "AIJ - AUDIÊNCIA", "20/02/2024", "Fraude no cartão de crédito"],
  ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

  const bom = "﻿";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_importacao_legallis.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportarTab() {
  const [files, setFiles] = useState<Record<string, File | null>>({
    clientes_processos: null,
    processos: null,
    iniciais: null,
    finalizados_sem_honorario: null,
    finalizados_acordos: null,
  });
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<{ stats: Record<string, number>; erros?: string[] } | null>(null);
  const [error, setError] = useState("");

  const hasAny = Object.values(files).some(Boolean);

  const handleImport = async () => {
    if (!hasAny) return;
    setStatus("loading");
    setError("");
    setResult(null);

    try {
      const fd = new FormData();
      for (const [key, file] of Object.entries(files)) {
        if (file) fd.append(key, file);
      }
      const res = await fetch("/api/controle/importar", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao importar");
      setResult(json);
      setStatus("success");
      setFiles({ clientes_processos: null, processos: null, iniciais: null, finalizados_sem_honorario: null, finalizados_acordos: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
      setStatus("error");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            Importar Planilhas
          </h1>
          <p className="text-sm" style={{ color: "var(--text3)" }}>
            Suba um ou mais arquivos .xlsx para atualizar os dados do sistema
          </p>
        </div>
        <button
          onClick={baixarModelo}
          className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shrink-0"
          style={{ background: "rgba(201,168,76,0.12)", color: "var(--gold)", border: "1px solid rgba(201,168,76,0.3)" }}
        >
          ⬇️ Baixar Modelo Excel
        </button>
      </div>

      {/* Info box */}
      <div className="rounded-xl p-4 text-sm" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", color: "var(--text2)" }}>
        <strong style={{ color: "var(--gold)" }}>Como funciona:</strong> use o <strong>Modelo Unificado</strong> para importar clientes e processos de uma vez, ou suba planilhas individuais por tipo. Os dados existentes são <strong>atualizados</strong>, não apagados.
      </div>

      {/* Drop zones */}
      <div className="space-y-3">
        {SLOTS.map(slot => (
          <DropZone
            key={slot.key}
            slot={slot}
            file={files[slot.key]}
            onFile={f => setFiles(prev => ({ ...prev, [slot.key]: f }))}
          />
        ))}
      </div>

      {/* Action */}
      <button
        onClick={handleImport}
        disabled={!hasAny || status === "loading"}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
        style={{
          background: hasAny && status !== "loading" ? "var(--gold)" : "var(--surface2)",
          color: hasAny && status !== "loading" ? "#1a1a1a" : "var(--text3)",
          cursor: hasAny && status !== "loading" ? "pointer" : "not-allowed",
        }}
      >
        {status === "loading" ? "Importando…" : "Importar dados"}
      </button>

      {/* Result */}
      {status === "success" && result && (
        <div className="rounded-xl p-5 space-y-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <p className="font-semibold text-sm" style={{ color: "#4ade80" }}>✅ Importação concluída!</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Clientes", result.stats.clientes],
              ["Processos", result.stats.processos],
              ["Iniciais", result.stats.iniciais],
              ["Finalizados s/ honor.", result.stats.finalizados_sem],
              ["Acordos", result.stats.finalizados_acordos],
            ].map(([label, val]) =>
              (val as number) > 0 ? (
                <div key={label as string} className="rounded-lg p-3 text-center" style={{ background: "rgba(34,197,94,0.1)" }}>
                  <p className="text-2xl font-bold" style={{ color: "#4ade80" }}>{val}</p>
                  <p className="text-xs" style={{ color: "var(--text3)" }}>{label}</p>
                </div>
              ) : null
            )}
          </div>
          {result.erros && result.erros.length > 0 && (
            <div className="rounded-lg p-3 text-xs space-y-1" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
              <p className="font-semibold">⚠️ Linhas com erro ({result.erros.length}):</p>
              {result.erros.slice(0, 10).map((e, i) => <p key={i}>{e}</p>)}
              {result.erros.length > 10 && <p>... e mais {result.erros.length - 10} erros</p>}
            </div>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl p-4 text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
          ❌ {error}
        </div>
      )}
    </div>
  );
}
