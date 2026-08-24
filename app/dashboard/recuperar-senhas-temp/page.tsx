"use client";

import { useState } from "react";

type Resultado = {
  totalClientesNoSistema: number;
  totalLinhasNaPlanilha: number;
  recuperados: { total: number; nomes: string[] };
  limposSemCorrespondencia: { total: number; nomes: string[] };
  ambiguosNaPlanilha: { total: number; nomes: string[] };
  naoEncontradosNaPlanilha: { total: number; nomes: string[] };
  jaEstavamOk: number;
};

// Página TEMPORÁRIA — recuperação de senha_gov/senha_serasa a partir da planilha antiga,
// depois do incidente de perda da FIELD_ENCRYPT_KEY (22/08/2026). Remover depois de concluído.
export default function RecuperarSenhasTemp() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState("");

  async function enviar() {
    if (!file) return;
    setLoading(true);
    setErro("");
    setResultado(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/master/import-senhas-planilha", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || "Erro desconhecido"); return; }
      setResultado(data);
    } catch (e) {
      setErro(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 24, fontFamily: "sans-serif", color: "var(--text)" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Recuperar senhas a partir da planilha</h1>
      <p style={{ fontSize: 14, color: "var(--text3)", marginBottom: 20 }}>
        Selecione o arquivo CONTROLE INTERNO ESCRITÓRIO.xlsm. Só preenche clientes cujo campo
        está vazio ou ilegível — nunca sobrescreve uma senha que já esteja legível no sistema.
      </p>

      <input
        type="file"
        accept=".xlsm,.xlsx"
        onChange={e => setFile(e.target.files?.[0] ?? null)}
        style={{ marginBottom: 16, display: "block" }}
      />
      <button
        onClick={enviar}
        disabled={!file || loading}
        style={{ background: "var(--gold)", color: "#000", padding: "10px 20px", borderRadius: 8, fontWeight: 600, border: "none", cursor: "pointer" }}
      >
        {loading ? "Processando..." : "Importar e recuperar"}
      </button>

      {erro && <p style={{ color: "var(--danger)", marginTop: 16 }}>{erro}</p>}

      {resultado && (
        <div style={{ marginTop: 24, fontSize: 14, lineHeight: 1.6 }}>
          <p>Clientes no sistema: {resultado.totalClientesNoSistema} · Linhas com senha na planilha: {resultado.totalLinhasNaPlanilha}</p>
          <p style={{ color: "var(--success)", fontWeight: 600, marginTop: 12 }}>
            ✅ Recuperados: {resultado.recuperados.total}
          </p>
          <p style={{ color: "var(--text3)" }}>{resultado.recuperados.nomes.join(", ") || "—"}</p>

          <p style={{ color: "var(--warning)", fontWeight: 600, marginTop: 12 }}>
            🧹 Limpos (sem correspondência na planilha, ficaram em branco): {resultado.limposSemCorrespondencia.total}
          </p>
          <p style={{ color: "var(--text3)" }}>{resultado.limposSemCorrespondencia.nomes.join(", ") || "—"}</p>

          <p style={{ color: "var(--danger)", fontWeight: 600, marginTop: 12 }}>
            ⚠️ Nome duplicado na planilha (pulei, confira manualmente): {resultado.ambiguosNaPlanilha.total}
          </p>
          <p style={{ color: "var(--text3)" }}>{resultado.ambiguosNaPlanilha.nomes.join(", ") || "—"}</p>

          <p style={{ fontWeight: 600, marginTop: 12 }}>
            Já estavam OK, não precisou mexer: {resultado.jaEstavamOk}
          </p>

          <p style={{ fontWeight: 600, marginTop: 12 }}>
            Precisavam mas não encontrei na planilha: {resultado.naoEncontradosNaPlanilha.total}
          </p>
          <p style={{ color: "var(--text3)" }}>{resultado.naoEncontradosNaPlanilha.nomes.join(", ") || "—"}</p>
        </div>
      )}
    </div>
  );
}
