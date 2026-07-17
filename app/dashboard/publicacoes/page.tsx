"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, Input, FieldLabel as Lbl, Select } from "@/components/ui";
import { DateField } from "@/components/ui/DateField";
import { buscarComunicacoesPorOab, type DjenComunicacao } from "@/lib/integrations/djen";
import { classificarPrazo, resumoTexto, type SinalPrazo } from "@/lib/publicacao-prazo";

const BR_STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

// Uma advogada pode ter mais de um registro de OAB (ex: inscrição principal em SP e
// suplementar em MG, cada uma com número próprio) — o DJEN identifica o advogado pela dupla
// número+UF, então publicações ligadas ao registro de MG não aparecem buscando só pelo de SP.
// Por isso a busca roda uma vez por registro marcado e junta os resultados.
interface OabAlvo { state: string; number: string; checked: boolean }

function chaveOab(o: { state: string; number: string }): string {
  return `${o.state}:${o.number}`;
}

interface Publicacao {
  id: string;
  oabNumero: string;
  oabUf: string;
  numeroProcesso?: string;
  orgao?: string;
  tipoComunicacao?: string;
  dataDisponibilizacao?: string;
  texto?: string;
  fonte: "djen" | "datajud" | "escavador";
  tratada: boolean;
  criado_em: string;
  raw?: unknown;
}

const FONTE_LABEL: Record<Publicacao["fonte"], string> = { djen: "DJEN", datajud: "DataJud", escavador: "Escavador" };

const SINAL_PRAZO_LABEL: Record<SinalPrazo, string> = { sim: "Pode gerar prazo", nao: "Não gera prazo", revisar: "Revisar prazo" };
const SINAL_PRAZO_COLOR: Record<SinalPrazo, string> = { sim: "#f87171", nao: "#4ade80", revisar: "var(--text3)" };
const SINAL_PRAZO_BG: Record<SinalPrazo, string> = { sim: "rgba(248,113,113,0.12)", nao: "rgba(74,222,128,0.12)", revisar: "rgba(255,255,255,0.06)" };

// Só a fonte DJEN grava esse formato em `raw` (ver lib/integrations/djen.ts); as outras fontes
// não têm partes/advogados/meio estruturados, então voltam undefined e a UI simplesmente omite.
function dadosDjen(p: Publicacao): DjenComunicacao | undefined {
  return p.fonte === "djen" ? (p.raw as DjenComunicacao | undefined) : undefined;
}

function fmtData(iso?: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// Ambos os campos abrem com a data de hoje, igual ao padrão do site oficial
// (comunica.pje.jus.br) — quem precisar de um período maior amplia manualmente a data inicial.
function dataIso(diasAtras: number): string {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString().slice(0, 10);
}

export default function PublicacoesPage() {
  const { data: session } = useSession();
  const [oabsBusca, setOabsBusca] = useState<OabAlvo[]>([{ state: "MG", number: "", checked: true }]);
  const [novoUf, setNovoUf] = useState("MG");
  const [novoNumero, setNovoNumero] = useState("");
  const [dataInicio, setDataInicio] = useState(() => dataIso(0));
  const [dataFim, setDataFim] = useState(() => dataIso(0));
  const [texto, setTexto] = useState("");
  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [siglaTribunal, setSiglaTribunal] = useState("");
  const [meio, setMeio] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [lista, setLista] = useState<Publicacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarTratadas, setMostrarTratadas] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    const loadPerfil = async () => {
      const res = await fetch(`/api/usuarios/${session?.user?.id}`);
      if (res.ok) {
        const u = await res.json();
        const registros: { state: string; number: string }[] = u.oab ?? [];
        if (registros.length > 0) {
          setOabsBusca(registros.map(o => ({ state: o.state, number: o.number, checked: true })));
        }
      }
    };
    if (session?.user?.id) loadPerfil();
  }, [session?.user?.id]);

  const alternarOab = (chave: string) => {
    setOabsBusca(prev => prev.map(o => chaveOab(o) === chave ? { ...o, checked: !o.checked } : o));
  };

  const removerOab = (chave: string) => {
    setOabsBusca(prev => prev.filter(o => chaveOab(o) !== chave));
  };

  const adicionarOab = () => {
    if (!novoNumero.trim()) return;
    const novo = { state: novoUf, number: novoNumero.trim(), checked: true };
    setOabsBusca(prev => prev.some(o => chaveOab(o) === chaveOab(novo)) ? prev : [...prev, novo]);
    setNovoNumero("");
  };

  const carregarLista = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/publicacoes${mostrarTratadas ? "" : "?tratada=false"}`);
      if (res.ok) setLista(await res.json());
    } finally {
      setCarregando(false);
    }
  }, [mostrarTratadas]);

  useEffect(() => { carregarLista(); }, [carregarLista]);

  const buscar = async () => {
    const alvos = oabsBusca.filter(o => o.checked && o.number.trim());
    if (alvos.length === 0) { setMsg({ type: "err", text: "Marque ao menos um registro de OAB para buscar." }); return; }
    if (dataInicio && dataFim && dataInicio > dataFim) {
      setMsg({ type: "err", text: "A data inicial não pode ser depois da data final." });
      return;
    }
    setBuscando(true);
    setMsg(null);
    try {
      let totalEncontradas = 0;
      let totalNovas = 0;
      const fontesComErro = new Set<string>();
      let erroGeral: string | undefined;

      // Um registro de OAB por vez: o DJEN identifica a advogada pela dupla número+UF, então
      // quem tem mais de um registro (ex: SP e MG) precisa de uma busca por registro.
      for (const alvo of alvos) {
        // A busca no DJEN sai daqui do navegador (mesmo caminho que o comunica.pje.jus.br usa),
        // não do servidor — o CNJ bloqueia por WAF as chamadas vindas de IP de datacenter/cloud.
        let djenItems: DjenComunicacao[] = [];
        let djenErro: string | undefined;
        try {
          djenItems = await buscarComunicacoesPorOab({
            numeroOab: alvo.number.trim(), ufOab: alvo.state,
            dataDisponibilizacaoInicio: dataInicio || undefined,
            dataDisponibilizacaoFim: dataFim || undefined,
            texto: texto.trim() || undefined,
            numeroProcesso: numeroProcesso.trim() || undefined,
            siglaTribunal: siglaTribunal.trim() || undefined,
            meio: meio || undefined,
          });
        } catch (e) {
          djenErro = e instanceof Error ? e.message : "Erro ao buscar no DJEN.";
        }
        try {
          const res = await fetch("/api/publicacoes/buscar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              oabNumero: alvo.number.trim(), oabUf: alvo.state,
              dataDisponibilizacaoInicio: dataInicio || undefined,
              dataDisponibilizacaoFim: dataFim || undefined,
              djenItems, djenErro,
            }),
          });
          const data = await res.json();
          if (!res.ok) { erroGeral = data.error || erroGeral; continue; }
          totalEncontradas += data.total ?? 0;
          totalNovas += data.novas?.length ?? 0;
          (data.fontesComErro ?? []).forEach((f: string) => fontesComErro.add(f));
        } catch (e) {
          erroGeral = e instanceof Error ? e.message : "Erro ao buscar publicações.";
        }
      }

      const dica = fontesComErro.has("djen") ? " Enquanto isso, consulte manualmente em comunica.pje.jus.br." : "";
      const partes: string[] = [];
      if (totalEncontradas > 0) {
        partes.push(`${totalEncontradas} ${totalEncontradas > 1 ? "publicações encontradas" : "publicação encontrada"}`);
        partes.push(totalNovas > 0 ? `${totalNovas} ${totalNovas > 1 ? "novas" : "nova"}` : "nenhuma nova");
      } else {
        partes.push("Nenhuma publicação encontrada para os filtros informados");
      }
      setMsg({ type: totalEncontradas > 0 || !erroGeral ? "ok" : "err", text: `${partes.join(" — ")}.` });
      if (fontesComErro.size > 0 || erroGeral) {
        const detalhe = [erroGeral, fontesComErro.size > 0 ? `Falha ao consultar: ${[...fontesComErro].join(", ")}.` : ""].filter(Boolean).join(" ");
        setMsg(prev => ({ type: "err", text: `${prev?.text ?? ""} ${detalhe}${dica}`.trim() }));
      }
      carregarLista();
    } finally {
      setBuscando(false);
    }
  };

  const marcarTratada = async (id: string) => {
    setLista(prev => prev.map(p => p.id === id ? { ...p, tratada: true } : p));
    await fetch(`/api/publicacoes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tratada: true }),
    });
    if (!mostrarTratadas) setLista(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>Publicações</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>
          Captura automática de publicações e intimações por OAB via DJEN (Diário de Justiça Eletrônico Nacional, CNJ).
        </p>
      </div>

      <Card className="mb-6">
        <div>
          <Lbl>Registros de OAB para buscar</Lbl>
          <div className="flex flex-wrap gap-2 mt-1">
            {oabsBusca.map(o => {
              const chave = chaveOab(o);
              return (
                <label key={chave} className="flex items-center gap-1.5 text-xs pl-2.5 pr-1.5 py-1.5 rounded-lg cursor-pointer select-none"
                  style={{ border: "1px solid var(--border)", background: o.checked ? "rgba(201,168,76,0.12)" : "var(--surface2)", color: o.checked ? "var(--gold)" : "var(--text2)" }}>
                  <input type="checkbox" checked={o.checked} onChange={() => alternarOab(chave)} className="accent-current" />
                  {o.state} {o.number || "—"}
                  <button type="button" onClick={e => { e.preventDefault(); removerOab(chave); }}
                    className="ml-1 px-1 rounded" style={{ color: "var(--text3)" }} title="Remover">×</button>
                </label>
              );
            })}
          </div>
          <div className="grid grid-cols-[100px_1fr_auto] gap-2 mt-2 max-w-md">
            <Select value={novoUf} onChange={e => setNovoUf(e.target.value)}>
              {BR_STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </Select>
            <Input value={novoNumero} onChange={e => setNovoNumero(e.target.value)} placeholder="Adicionar outro nº de OAB"
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); adicionarOab(); } }} />
            <button onClick={adicionarOab} type="button"
              className="px-3 py-2 rounded-lg text-sm whitespace-nowrap" style={{ border: "1px solid var(--border)", color: "var(--text2)" }}>
              + Adicionar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-[140px_140px_auto] gap-3 items-end mt-4">
          <DateField label="Data inicial" value={dataInicio} onChange={setDataInicio} />
          <DateField label="Data final" value={dataFim} onChange={setDataFim} />
          <button onClick={buscar} disabled={buscando}
            className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap disabled:opacity-50 col-span-2 md:col-span-1"
            style={{ background: "var(--gold)", color: "#1a1a1a" }}>
            {buscando ? "Buscando..." : "Buscar novas publicações"}
          </button>
        </div>

        <button onClick={() => setMostrarFiltros(v => !v)} className="text-xs mt-3" style={{ color: "var(--gold)" }}>
          {mostrarFiltros ? "Ocultar opções de busca" : "Mais opções de busca"}
        </button>

        {mostrarFiltros && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end mt-3">
            <div className="col-span-2">
              <Lbl>Teor da comunicação</Lbl>
              <Input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Buscar palavra no texto" />
            </div>
            <div>
              <Lbl>Número do processo</Lbl>
              <Input value={numeroProcesso} onChange={e => setNumeroProcesso(e.target.value)} placeholder="0000000-00.0000.0.00.0000" />
            </div>
            <div>
              <Lbl>Tribunal</Lbl>
              <Input value={siglaTribunal} onChange={e => setSiglaTribunal(e.target.value.toUpperCase())} placeholder="Ex: TJMG" />
            </div>
            <div>
              <Lbl>Meio</Lbl>
              <Select value={meio} onChange={e => setMeio(e.target.value)}>
                <option value="">Todos</option>
                <option value="D">Diário de Justiça Eletrônico</option>
                <option value="E">Plataforma Nacional de Editais</option>
              </Select>
            </div>
          </div>
        )}

        <p className="text-xs mt-2" style={{ color: "var(--text3)" }}>
          A busca é limitada ao intervalo de datas acima — amplie o período se não encontrar o que procura.
        </p>
        {msg && (
          <p className="text-xs mt-3" style={{ color: msg.type === "ok" ? "#4ade80" : "#f87171" }}>{msg.text}</p>
        )}
      </Card>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium" style={{ color: "var(--text2)" }}>
          {mostrarTratadas ? "Todas as publicações" : "Pendentes de tratamento"}
        </h2>
        <button onClick={() => setMostrarTratadas(v => !v)} className="text-xs" style={{ color: "var(--gold)" }}>
          {mostrarTratadas ? "Ver só pendentes" : "Ver todas"}
        </button>
      </div>

      {carregando ? (
        <p className="text-sm" style={{ color: "var(--text3)" }}>Carregando...</p>
      ) : lista.length === 0 ? (
        <Card><p className="text-sm text-center py-6" style={{ color: "var(--text3)" }}>Nenhuma publicação encontrada. Use o campo acima para buscar.</p></Card>
      ) : (
        <div className="space-y-2">
          {lista.map(p => {
            const djen = dadosDjen(p);
            const prazo = classificarPrazo({ tipoComunicacao: p.tipoComunicacao, texto: p.texto });
            const textoLimpo = resumoTexto(p.texto, 100000);
            const advogados = (djen?.destinatarioadvogados ?? [])
              .map(a => a.advogado ? `${a.advogado.nome} (OAB ${a.advogado.uf_oab}${a.advogado.numero_oab})` : null)
              .filter((s): s is string => !!s);
            return (
              <Card key={p.id} padding="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(201,168,76,0.12)", color: "var(--gold)" }}>
                        {FONTE_LABEL[p.fonte]}
                      </span>
                      {djen?.siglaTribunal && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--surface2)", color: "var(--text2)" }}>
                          {djen.siglaTribunal}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: "var(--text3)" }}>{fmtData(p.dataDisponibilizacao)}</span>
                      {p.tipoComunicacao && <span className="text-xs" style={{ color: "var(--text3)" }}>· {p.tipoComunicacao}</span>}
                      {djen?.meiocompleto && <span className="text-xs" style={{ color: "var(--text3)" }}>· {djen.meiocompleto}</span>}
                      {p.tratada && <span className="text-xs" style={{ color: "#4ade80" }}>· tratada</span>}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: SINAL_PRAZO_BG[prazo.sinal], color: SINAL_PRAZO_COLOR[prazo.sinal] }}>
                        {SINAL_PRAZO_LABEL[prazo.sinal]}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text3)" }}>{prazo.motivo}</span>
                    </div>

                    <p className="text-sm font-medium mt-1" style={{ color: "var(--text)" }}>{p.numeroProcesso || "Processo não identificado"}</p>
                    {p.orgao && <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{p.orgao}</p>}
                    <p className={`text-sm mt-2 ${expandido === p.id ? "" : "line-clamp-2"}`} style={{ color: "var(--text2)" }}>
                      {textoLimpo || "—"}
                    </p>
                    {textoLimpo.length > 160 && (
                      <button onClick={() => setExpandido(expandido === p.id ? null : p.id)} className="text-xs mt-1" style={{ color: "var(--gold)" }}>
                        {expandido === p.id ? "ver menos" : "ver mais"}
                      </button>
                    )}

                    {djen && ((djen.destinatarios?.length ?? 0) > 0 || advogados.length > 0) && (
                      <div className="mt-2 space-y-0.5">
                        {djen.destinatarios && djen.destinatarios.length > 0 && (
                          <p className="text-xs" style={{ color: "var(--text3)" }}>
                            <span style={{ color: "var(--text2)" }}>Partes:</span> {djen.destinatarios.map(d => `${d.nome} (${d.polo === "A" ? "ativo" : d.polo === "P" ? "passivo" : d.polo})`).join(", ")}
                          </p>
                        )}
                        {advogados.length > 0 && (
                          <p className="text-xs" style={{ color: "var(--text3)" }}>
                            <span style={{ color: "var(--text2)" }}>Advogados:</span> {advogados.join(", ")}
                          </p>
                        )}
                      </div>
                    )}

                    {djen?.link && (
                      <a href={djen.link} target="_blank" rel="noopener noreferrer" className="text-xs mt-2 inline-block" style={{ color: "var(--gold)" }}>
                        Ver inteiro teor ↗
                      </a>
                    )}
                  </div>
                  {!p.tratada && (
                    <button onClick={() => marcarTratada(p.id)}
                      className="text-xs px-3 py-1.5 rounded-lg whitespace-nowrap"
                      style={{ border: "1px solid var(--border)", color: "var(--text2)" }}>
                      Marcar como tratada
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
