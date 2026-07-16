"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, Input, FieldLabel as Lbl, Select } from "@/components/ui";
import { DateField } from "@/components/ui/DateField";
import { buscarComunicacoesPorOab, type DjenComunicacao } from "@/lib/integrations/djen";

const BR_STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

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
}

const FONTE_LABEL: Record<Publicacao["fonte"], string> = { djen: "DJEN", datajud: "DataJud", escavador: "Escavador" };

function fmtData(iso?: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// Padrão de 90 dias: o site oficial (comunica.pje.jus.br) exige um intervalo de datas e,
// se a usuária deixar sem preencher, ele busca só o dia de hoje — o que sempre dá "sem
// resultado". Aqui já vem preenchido com um intervalo razoável para evitar essa pegadinha.
function dataIso(diasAtras: number): string {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString().slice(0, 10);
}

export default function PublicacoesPage() {
  const { data: session } = useSession();
  const [oabUf, setOabUf] = useState("MG");
  const [oabNumero, setOabNumero] = useState("");
  const [dataInicio, setDataInicio] = useState(() => dataIso(90));
  const [dataFim, setDataFim] = useState(() => dataIso(0));
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
        const primeira = u.oab?.[0];
        if (primeira) { setOabUf(primeira.state); setOabNumero(primeira.number); }
      }
    };
    if (session?.user?.id) loadPerfil();
  }, [session?.user?.id]);

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
    if (!oabNumero.trim()) { setMsg({ type: "err", text: "Informe o número da OAB." }); return; }
    if (dataInicio && dataFim && dataInicio > dataFim) {
      setMsg({ type: "err", text: "A data inicial não pode ser depois da data final." });
      return;
    }
    setBuscando(true);
    setMsg(null);
    // A busca no DJEN sai daqui do navegador (mesmo caminho que o comunica.pje.jus.br usa),
    // não do servidor — o CNJ bloqueia por WAF as chamadas vindas de IP de datacenter/cloud.
    let djenItems: DjenComunicacao[] = [];
    let djenErro: string | undefined;
    try {
      djenItems = await buscarComunicacoesPorOab({
        numeroOab: oabNumero.trim(), ufOab: oabUf,
        dataDisponibilizacaoInicio: dataInicio || undefined,
        dataDisponibilizacaoFim: dataFim || undefined,
      });
    } catch (e) {
      djenErro = e instanceof Error ? e.message : "Erro ao buscar no DJEN.";
    }
    try {
      const res = await fetch("/api/publicacoes/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oabNumero: oabNumero.trim(), oabUf,
          dataDisponibilizacaoInicio: dataInicio || undefined,
          dataDisponibilizacaoFim: dataFim || undefined,
          djenItems, djenErro,
        }),
      });
      const data = await res.json();
      const dica = data.fontesComErro?.includes("djen")
        ? " Enquanto isso, consulte manualmente em comunica.pje.jus.br."
        : "";
      if (!res.ok) {
        setMsg({ type: "err", text: `${data.error || "Erro ao buscar publicações."}${dica}` });
        return;
      }
      const qtdNovas = data.novas?.length ?? 0;
      setMsg({
        type: "ok",
        text: qtdNovas > 0 ? `${qtdNovas} ${qtdNovas > 1 ? "publicações novas encontradas" : "publicação nova encontrada"}.` : "Nenhuma publicação nova encontrada.",
      });
      if (data.fontesComErro?.length) {
        setMsg(prev => ({ type: "err", text: `${prev?.text ?? ""} Falha ao consultar: ${data.fontesComErro.join(", ")}.${dica}` }));
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
        <div className="grid grid-cols-2 md:grid-cols-[100px_1fr_140px_140px_auto] gap-3 items-end">
          <div>
            <Lbl>UF</Lbl>
            <Select value={oabUf} onChange={e => setOabUf(e.target.value)}>
              {BR_STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </Select>
          </div>
          <div>
            <Lbl>Número da OAB</Lbl>
            <Input value={oabNumero} onChange={e => setOabNumero(e.target.value)} placeholder="Ex: 123456" />
          </div>
          <DateField label="Data inicial" value={dataInicio} onChange={setDataInicio} />
          <DateField label="Data final" value={dataFim} onChange={setDataFim} />
          <button onClick={buscar} disabled={buscando}
            className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap disabled:opacity-50 col-span-2 md:col-span-1"
            style={{ background: "var(--gold)", color: "#1a1a1a" }}>
            {buscando ? "Buscando..." : "Buscar novas publicações"}
          </button>
        </div>
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
          {lista.map(p => (
            <Card key={p.id} padding="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(201,168,76,0.12)", color: "var(--gold)" }}>
                      {FONTE_LABEL[p.fonte]}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text3)" }}>{fmtData(p.dataDisponibilizacao)}</span>
                    {p.tipoComunicacao && <span className="text-xs" style={{ color: "var(--text3)" }}>· {p.tipoComunicacao}</span>}
                    {p.tratada && <span className="text-xs" style={{ color: "#4ade80" }}>· tratada</span>}
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{p.numeroProcesso || "Processo não identificado"}</p>
                  {p.orgao && <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{p.orgao}</p>}
                  <p className={`text-sm mt-2 ${expandido === p.id ? "" : "line-clamp-2"}`} style={{ color: "var(--text2)" }}>
                    {p.texto || "—"}
                  </p>
                  {p.texto && p.texto.length > 160 && (
                    <button onClick={() => setExpandido(expandido === p.id ? null : p.id)} className="text-xs mt-1" style={{ color: "var(--gold)" }}>
                      {expandido === p.id ? "ver menos" : "ver mais"}
                    </button>
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
          ))}
        </div>
      )}
    </div>
  );
}
