"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Input, FieldLabel as Lbl, Select } from "@/components/ui";

interface Certificado {
  id: string;
  tipo: "A1" | "A3";
  apelido: string;
  nomeArquivo?: string;
  titular?: string;
  validade?: string;
  criado_em: string;
  temArquivo: boolean;
  status: "ativo" | "expirado" | "sem_validade";
}

const STATUS_LABEL: Record<Certificado["status"], { text: string; color: string }> = {
  ativo: { text: "Válido", color: "#4ade80" },
  expirado: { text: "Expirado", color: "#f87171" },
  sem_validade: { text: "Validade não informada", color: "var(--text3)" },
};

export default function CertificadoPage() {
  const [lista, setLista] = useState<Certificado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [tipo, setTipo] = useState<"A1" | "A3">("A1");
  const [apelido, setApelido] = useState("");
  const [titular, setTitular] = useState("");
  const [validade, setValidade] = useState("");
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/certificados");
      if (res.ok) setLista(await res.json());
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const limparForm = () => {
    setApelido(""); setTitular(""); setValidade(""); setSenha("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const salvar = async () => {
    if (!apelido.trim()) { setMsg({ type: "err", text: "Informe um apelido para identificar o certificado." }); return; }
    if (tipo === "A1" && (!fileRef.current?.files?.[0] || !senha)) {
      setMsg({ type: "err", text: "Para A1, envie o arquivo (.pfx/.p12) e informe a senha." });
      return;
    }
    setSalvando(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("tipo", tipo);
      fd.append("apelido", apelido.trim());
      if (titular.trim()) fd.append("titular", titular.trim());
      if (validade) fd.append("validade", validade);
      if (tipo === "A1") {
        fd.append("senha", senha);
        if (fileRef.current?.files?.[0]) fd.append("arquivo", fileRef.current.files[0]);
      }
      const res = await fetch("/api/certificados", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: "err", text: data.error || "Erro ao salvar certificado." }); return; }
      setMsg({ type: "ok", text: "Certificado cadastrado com sucesso." });
      limparForm();
      carregar();
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir este certificado? Essa ação não pode ser desfeita.")) return;
    setLista(prev => prev.filter(c => c.id !== id));
    await fetch(`/api/certificados/${id}`, { method: "DELETE" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-lg font-semibold" style={{ color: "var(--text)" }}>Certificado Digital</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>
          Cadastre o certificado A1 (arquivo .pfx/.p12 + senha) ou A3 (token/cartão físico) usado nos tribunais.
          A senha fica criptografada e nunca é exibida novamente.
        </p>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Lbl>Tipo</Lbl>
            <Select value={tipo} onChange={e => setTipo(e.target.value as "A1" | "A3")}>
              <option value="A1">A1 (arquivo)</option>
              <option value="A3">A3 (token/cartão)</option>
            </Select>
          </div>
          <div>
            <Lbl>Apelido *</Lbl>
            <Input value={apelido} onChange={e => setApelido(e.target.value)} placeholder="Ex: Certificado Adriely 2026" />
          </div>
          <div>
            <Lbl>Titular</Lbl>
            <Input value={titular} onChange={e => setTitular(e.target.value)} placeholder="Nome no certificado" />
          </div>
          <div>
            <Lbl>Validade</Lbl>
            <Input type="date" value={validade} onChange={e => setValidade(e.target.value)} />
          </div>
          {tipo === "A1" && (
            <>
              <div>
                <Lbl>Arquivo (.pfx ou .p12) *</Lbl>
                <input ref={fileRef} type="file" accept=".pfx,.p12"
                  className="w-full text-sm rounded-lg px-3 py-2"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />
              </div>
              <div>
                <Lbl>Senha do certificado *</Lbl>
                <Input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Senha do arquivo" />
              </div>
            </>
          )}
          {tipo === "A3" && (
            <div className="md:col-span-2">
              <p className="text-xs" style={{ color: "var(--text3)" }}>
                O A3 fica em um token/cartão físico conectado ao computador — não há arquivo para enviar.
                Este cadastro serve para identificar qual certificado usar em cada assinatura.
              </p>
            </div>
          )}
        </div>

        {msg && <p className="text-xs mt-3" style={{ color: msg.type === "ok" ? "#4ade80" : "#f87171" }}>{msg.text}</p>}

        <button onClick={salvar} disabled={salvando}
          className="mt-4 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--gold)", color: "#1a1a1a" }}>
          {salvando ? "Salvando..." : "Cadastrar certificado"}
        </button>
      </Card>

      <div>
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text2)" }}>Certificados cadastrados</h3>
        {carregando ? (
          <p className="text-sm" style={{ color: "var(--text3)" }}>Carregando...</p>
        ) : lista.length === 0 ? (
          <Card><p className="text-sm text-center py-6" style={{ color: "var(--text3)" }}>Nenhum certificado cadastrado ainda.</p></Card>
        ) : (
          <div className="space-y-2">
            {lista.map(c => (
              <Card key={c.id} padding="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{c.apelido}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(201,168,76,0.12)", color: "var(--gold)" }}>{c.tipo}</span>
                      <span className="text-xs" style={{ color: STATUS_LABEL[c.status].color }}>{STATUS_LABEL[c.status].text}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>
                      {c.titular ? `${c.titular} · ` : ""}{c.validade ? `válido até ${c.validade.split("-").reverse().join("/")}` : ""}
                      {c.nomeArquivo ? ` · ${c.nomeArquivo}` : ""}
                    </p>
                  </div>
                  <button onClick={() => excluir(c.id)} className="text-xs px-3 py-1.5 rounded-lg whitespace-nowrap"
                    style={{ border: "1px solid var(--border)", color: "#f87171" }}>
                    Excluir
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
