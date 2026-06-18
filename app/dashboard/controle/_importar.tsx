"use client";

import { useRef, useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

const ABAS_MODELO = [
  { nome: "Clientes", campos: "Nome *, CPF, Telefone, E-mail, Endereço, Tipo Aposentadoria, Informações" },
  { nome: "Processos Ativos", campos: "Autor *, Réu, Objeto, Nº Processo, Data, Hora, Andamento, Responsável, Observações, Atenção" },
  { nome: "Iniciais", campos: "Cliente *, Réu, Objeto, Andamento, Responsável, Observações" },
  { nome: "Finalizados", campos: "Tipo * (Execução / Improcedente / Desistência / Outros), Cliente *, Réu, Nº Processo, Objeto, Data Finalização, Motivo" },
  { nome: "Acordos", campos: "Mês, Data Pagamento, Cliente *, Réu, Nº Processo, Objeto, Valor Acordo, Honorários, Repasse ao Cliente, Status" },
];

export function ImportarTab() {
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<{ stats: Record<string, number>; erros?: string[] } | null>(null);
  const [error, setError] = useState("");

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (!f.name.match(/\.xlsx?$/i)) { setError("Use um arquivo .xlsx"); return; }
    setFile(f);
    setStatus("idle");
    setResult(null);
    setError("");
  };

  const baixarModelo = async () => {
    const res = await fetch("/api/controle/modelo-excel");
    if (!res.ok) { setError("Erro ao gerar modelo."); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_importacao_legallis.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file) return;
    setStatus("loading");
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", file);
      const res = await fetch("/api/controle/importar", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao importar");
      setResult(json);
      setStatus("success");
      setFile(null);
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
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Importar Dados</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text3)" }}>
            Um único arquivo Excel com todas as informações do escritório
          </p>
        </div>
        <button
          onClick={baixarModelo}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shrink-0 transition-opacity hover:opacity-80"
          style={{ background: "rgba(201,168,76,0.12)", color: "var(--gold)", border: "1px solid rgba(201,168,76,0.3)" }}
        >
          ⬇️ Baixar Modelo Excel
        </button>
      </div>

      {/* Abas do modelo */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text3)" }}>
          O modelo contém 5 abas — preencha apenas as que precisar:
        </p>
        <div className="space-y-2">
          {ABAS_MODELO.map(a => (
            <div key={a.nome} className="flex gap-3 items-start">
              <span className="text-xs font-semibold mt-0.5 px-2 py-0.5 rounded shrink-0"
                style={{ background: "rgba(201,168,76,0.12)", color: "var(--gold)", border: "1px solid rgba(201,168,76,0.2)" }}>
                {a.nome}
              </span>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text3)" }}>{a.campos}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => ref.current?.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); handleFile(e.dataTransfer.files[0]); }}
        className="rounded-xl p-8 cursor-pointer transition-all flex flex-col items-center gap-3"
        style={{
          border: `2px dashed ${file ? "var(--gold)" : over ? "var(--gold)" : "var(--border)"}`,
          background: file ? "rgba(201,168,76,0.06)" : over ? "rgba(201,168,76,0.04)" : "var(--surface)",
        }}
      >
        <input ref={ref} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={e => handleFile(e.target.files?.[0] ?? null)} />
        <div className="text-4xl">{file ? "✅" : "📊"}</div>
        {file ? (
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: "var(--gold)" }}>{file.name}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>
              {(file.size / 1024).toFixed(0)} KB · Clique para trocar
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: "var(--text2)" }}>
              Arraste o arquivo Excel aqui ou clique para selecionar
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>
              Formato .xlsx · modelo_importacao_legallis.xlsx
            </p>
          </div>
        )}
      </div>

      {/* Botão importar */}
      <button
        onClick={handleImport}
        disabled={!file || status === "loading"}
        className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
        style={{
          background: file && status !== "loading" ? "var(--gold)" : "var(--surface2)",
          color: file && status !== "loading" ? "#1a1a1a" : "var(--text3)",
          cursor: file && status !== "loading" ? "pointer" : "not-allowed",
        }}
      >
        {status === "loading" ? "Importando… aguarde" : "Importar dados"}
      </button>

      {/* Resultado */}
      {status === "success" && result && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <p className="font-semibold text-sm" style={{ color: "#4ade80" }}>✅ Importação concluída com sucesso!</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {([
              ["Clientes",    result.stats.clientes,    "#22c55e"],
              ["Processos",   result.stats.processos,   "#C9A84C"],
              ["Iniciais",    result.stats.iniciais,    "#818cf8"],
              ["Finalizados", result.stats.finalizados, "#f97316"],
              ["Acordos",     result.stats.acordos,     "#60a5fa"],
            ] as [string, number, string][]).map(([label, val, color]) =>
              val > 0 ? (
                <div key={label} className="rounded-lg p-3 text-center"
                  style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                  <p className="text-2xl font-bold" style={{ color }}>{val}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{label}</p>
                </div>
              ) : null
            )}
          </div>
          {result.erros && result.erros.length > 0 && (
            <div className="rounded-lg p-3 text-xs space-y-1"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
              <p className="font-semibold">⚠️ Linhas ignoradas por erro ({result.erros.length}):</p>
              {result.erros.slice(0, 10).map((e, i) => <p key={i}>· {e}</p>)}
              {result.erros.length > 10 && <p>... e mais {result.erros.length - 10}</p>}
            </div>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl p-4 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
          ❌ {error}
        </div>
      )}
    </div>
  );
}
