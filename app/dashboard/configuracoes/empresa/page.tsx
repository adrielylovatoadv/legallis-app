"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { BOTOES_MODELO, MODELOS_PADRAO, TIPOS_DOCUMENTO, type BotaoModelo, type TipoDocumento } from "@/lib/document-templates";

interface Colega { id: string; name: string }

export default function EmpresaPage() {
  const { data: session } = useSession();
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [address, setAddress] = useState("");
  const [cidade, setCidade] = useState("");
  const [modelos, setModelos] = useState<Record<string, string>>({});
  const [tipoModelo, setTipoModelo] = useState<TipoDocumento>("procuracao");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [signerIds, setSignerIds] = useState<string[]>([]);
  const [colegas, setColegas] = useState<Colega[]>([]);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/usuarios/${session?.user?.id}`);
      if (res.ok) {
        const u = await res.json();
        setCompanyName(u.company?.name ?? "");
        setCnpj(u.company?.cnpj ?? "");
        setAddress(u.company?.address ?? "");
        setCidade(u.company?.cidade ?? "");
        setModelos(u.company?.modelos ?? {});
        setSignerIds(u.company?.defaultPdfSignerIds?.length ? u.company.defaultPdfSignerIds : [u.company?.defaultPdfSignerId ?? u.id ?? ""].filter(Boolean));
      }
    };
    if (session?.user?.id) load();
  }, [session?.user?.id]);

  useEffect(() => {
    fetch("/api/usuarios/escritorio")
      .then(r => r.ok ? r.json() : [])
      .then(d => Array.isArray(d) && setColegas(d))
      .catch(() => {});
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    const res = await fetch(`/api/usuarios/${session?.user?.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: {
          name: companyName, cnpj, address, defaultPdfSignerId: signerIds[0] ?? "", defaultPdfSignerIds: signerIds, cidade: cidade.trim(),
          // só guarda textos preenchidos; o que estiver vazio volta ao modelo padrão
          modelos: Object.fromEntries(Object.entries(modelos).filter(([, t]) => t.trim())),
        },
      }),
    });
    setLoading(false);
    if (res.ok) setMsg({ type: "ok", text: "Dados da empresa salvos." });
    else setMsg({ type: "err", text: "Erro ao salvar." });
  };

  // Insere o botão clicado no texto do modelo, no ponto onde está o cursor.
  const inserir = (b: BotaoModelo) => {
    const area = areaRef.current;
    const atual = modelos[tipoModelo] ?? "";
    const ini = area?.selectionStart ?? atual.length;
    const fim = area?.selectionEnd ?? atual.length;
    let novo: string;
    let cursor: number;
    if (b.tipo === "linha") {
      const inicioLinha = atual.lastIndexOf("\n", ini - 1) + 1;
      // troca um prefixo de formatação que já exista na linha (# , > ou | )
      const semPrefixo = atual.slice(inicioLinha).replace(/^(# |> |\| )/, "");
      const removido = atual.slice(inicioLinha).length - semPrefixo.length;
      novo = atual.slice(0, inicioLinha) + b.texto + semPrefixo;
      cursor = ini - removido + b.texto.length;
    } else if (b.tipo === "bloco") {
      const antes = atual.slice(0, ini).replace(/\s+$/, "");
      const depois = atual.slice(fim).replace(/^\s+/, "");
      const ins = `${antes ? "\n\n" : ""}${b.texto}${depois ? "\n\n" : ""}`;
      novo = antes + ins + depois;
      cursor = antes.length + ins.length;
    } else if (b.tipo === "negrito") {
      const sel = atual.slice(ini, fim) || "texto";
      novo = `${atual.slice(0, ini)}**${sel}**${atual.slice(fim)}`;
      cursor = ini + 2 + sel.length + 2;
    } else {
      novo = atual.slice(0, ini) + b.texto + atual.slice(fim);
      cursor = ini + b.texto.length;
    }
    setModelos({ ...modelos, [tipoModelo]: novo });
    requestAnimationFrame(() => { area?.focus(); area?.setSelectionRange(cursor, cursor); });
  };

  const inp = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors";
  const inpStyle = { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" };

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="rounded-2xl p-6 space-y-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold" style={{ color: "var(--text)" }}>Dados da Empresa</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Nome da empresa / escritório</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)}
              placeholder="Sobrenome & Associados Advocacia" className={inp} style={inpStyle}
              onFocus={e => (e.target.style.borderColor = "var(--gold)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>
              CNPJ <span style={{ color: "var(--text3)" }}>(opcional)</span>
            </label>
            <input value={cnpj} onChange={e => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00" className={inp} style={inpStyle}
              onFocus={e => (e.target.style.borderColor = "var(--gold)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>Endereço</label>
            <input value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Rua, número, cidade - UF" className={inp} style={inpStyle}
              onFocus={e => (e.target.style.borderColor = "var(--gold)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")} />
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "var(--text3)" }}>
            Cidade/UF do escritório (local dos documentos e foro do contrato)
          </label>
          <input value={cidade} onChange={e => setCidade(e.target.value)}
            placeholder="Itamogi/MG" className={inp} style={inpStyle}
            onFocus={e => (e.target.style.borderColor = "var(--gold)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")} />
          <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>
            Aparece na data das procurações, contratos e declarações (&quot;Itamogi/MG, 25 de setembro de 2026&quot;) e na cláusula do foro da comarca. Em branco, os documentos saem com uma linha para preencher.
          </p>
        </div>

        {/* Modelos de documentos */}
        <div className="pt-4 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
          <div>
            <label className="text-xs uppercase tracking-wider block" style={{ color: "var(--text3)" }}>
              Modelos de documentos
            </label>
            <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>
              Por padrão o sistema usa um modelo genérico. Se preferir, personalize o texto de cada documento abaixo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TIPOS_DOCUMENTO.map(t => (
              <button key={t.tipo} type="button" onClick={() => setTipoModelo(t.tipo)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{
                  background: tipoModelo === t.tipo ? "rgba(201,168,76,0.15)" : "var(--surface2)",
                  color: tipoModelo === t.tipo ? "var(--gold)" : "var(--text2)",
                  border: `1px solid ${tipoModelo === t.tipo ? "var(--gold)" : "var(--border)"}`,
                }}>
                {t.label}{modelos[t.tipo]?.trim() ? " ✎" : ""}
              </button>
            ))}
          </div>
          {modelos[tipoModelo] !== undefined ? (
            <>
              <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <p className="text-xs" style={{ color: "var(--text3)" }}>
                  Clique no texto onde quer inserir e depois no botão. Os trechos entre {"{{ }}"} são preenchidos sozinhos com os dados de cada cliente ao gerar o documento.
                </p>
                {BOTOES_MODELO.map((g, i) => {
                  const avancado = i === BOTOES_MODELO.length - 1;
                  const grupo = (
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-xs w-full sm:w-auto sm:mr-1 uppercase tracking-wider" style={{ color: "var(--text3)", minWidth: "8.5rem" }}>{g.grupo}</span>
                      {g.botoes.map(b => (
                        <button key={b.label} type="button" onMouseDown={e => e.preventDefault()} onClick={() => inserir(b)}
                          className="text-xs px-2.5 py-1 rounded-lg"
                          style={{ background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border)" }}>
                          {b.label}
                        </button>
                      ))}
                    </div>
                  );
                  return avancado
                    ? <details key={g.grupo}><summary className="cursor-pointer text-xs" style={{ color: "var(--text2)" }}>Mais opções ({g.grupo.toLowerCase()})</summary><div className="mt-2">{grupo}</div></details>
                    : <div key={g.grupo}>{grupo}</div>;
                })}
              </div>
              <textarea ref={areaRef} value={modelos[tipoModelo]} rows={16}
                onChange={e => setModelos({ ...modelos, [tipoModelo]: e.target.value })}
                className={inp + " font-mono"} style={{ ...inpStyle, fontSize: "12px", lineHeight: 1.5 }} />
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs" style={{ color: "var(--gold)" }}>Usando o seu modelo personalizado.</span>
                <button type="button" onClick={() => { if (confirm("Voltar ao modelo padrão? O seu texto será descartado.")) { setModelos(Object.fromEntries(Object.entries(modelos).filter(([k]) => k !== tipoModelo))); } }}
                  className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>
                  Restaurar modelo padrão
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-xl p-4 flex flex-wrap gap-3 items-center" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <span className="text-sm" style={{ color: "var(--text2)" }}>Usando o modelo padrão do sistema.</span>
              <button type="button" onClick={() => setModelos({ ...modelos, [tipoModelo]: MODELOS_PADRAO[tipoModelo] })}
                className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "var(--gold)", color: "#000" }}>
                Personalizar a partir do padrão
              </button>
            </div>
          )}
        </div>

        {/* Assinatura padrão nos PDFs */}
        {colegas.length > 1 && (
          <div className="pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <label className="text-xs uppercase tracking-wider mb-3 block" style={{ color: "var(--text3)" }}>
              Advogado(s) padrão na assinatura dos documentos
            </label>
            <p className="text-xs mb-3" style={{ color: "var(--text3)" }}>
              Quando um cálculo ou um documento de cliente (procuração, contrato, declarações) for exportado, aparecem por padrão o(s) advogado(s) marcado(s) abaixo — você pode marcar mais de um (nos documentos de cliente todos entram na qualificação e na assinatura; cálculos e recibos usam o primeiro). Pode ser alterado na hora da exportação.
            </p>
            <div className="flex flex-wrap gap-2">
              {colegas.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSignerIds(prev => prev.includes(u.id) ? (prev.length > 1 ? prev.filter(id => id !== u.id) : prev) : [...prev, u.id])}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                  style={{
                    background: signerIds.includes(u.id) ? "rgba(201,168,76,0.15)" : "var(--surface2)",
                    color: signerIds.includes(u.id) ? "var(--gold)" : "var(--text2)",
                    border: `1px solid ${signerIds.includes(u.id) ? "var(--gold)" : "var(--border)"}`,
                  }}>
                  {signerIds.includes(u.id) && (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {u.name}
                  {u.id === session?.user?.id && (
                    <span className="text-xs opacity-50">(você)</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {msg && (
          <div className="text-sm px-4 py-2.5 rounded-lg"
            style={{
              background: msg.type === "ok" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              border: `1px solid ${msg.type === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              color: msg.type === "ok" ? "#4ade80" : "#f87171",
            }}>
            {msg.text}
          </div>
        )}

        <button type="submit" disabled={loading}
          className="px-6 py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: "var(--gold)", color: "#000", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Salvando..." : "Salvar empresa"}
        </button>
      </form>
    </div>
  );
}
