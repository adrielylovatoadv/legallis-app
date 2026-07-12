"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  calcularPrazo, isDiaUtil, UFS, UF_LABEL, type UF, type ResultadoPrazo,
  getFeriadosMunicipais, createFeriadoMunicipal, deleteFeriadoMunicipal, type FeriadoMunicipalDTO,
} from "@/lib/prazos";
import { fmtData, normText } from "@/lib/controle";
import { Input as Inp, Select as Sel, FieldLabel as Lbl, Card } from "@/components/ui";
import { DateField } from "@/components/ui/DateField";
import { exportarPDF, type ExportDoc } from "@/lib/export-calc";
import { canExport } from "@/lib/plans";
import type { Plan } from "@/lib/plans";

interface UserProfile { name?: string; oab?: Array<{ state: string; number: string }>; company?: { name?: string } }

export default function PrazosPage() {
  const { data: session } = useSession();
  const plan = (session?.user.plan ?? "basic") as Plan;
  const today = new Date().toISOString().split("T")[0];
  const [dataPublicacao, setDataPublicacao] = useState(today);
  const [dias, setDias] = useState("15");
  const [uf, setUf] = useState<UF | "">("");
  const [municipio, setMunicipio] = useState("");
  const [processo, setProcesso] = useState("");
  const [tipoProcesso, setTipoProcesso] = useState<"eletronico" | "fisico">("eletronico");
  const [tipoContagem, setTipoContagem] = useState<"uteis" | "corridos">("uteis");
  const [considerarRecesso, setConsiderarRecesso] = useState(true);
  const [resultado, setResultado] = useState<ResultadoPrazo | null>(null);
  const [erro, setErro] = useState("");
  const [exportando, setExportando] = useState(false);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    if (session?.user?.id) {
      fetch(`/api/usuarios/${session.user.id}`).then(r => r.ok ? r.json() : null).then(d => d && setUserProfile(d)).catch(() => {});
    }
  }, [session?.user?.id]);

  const [feriados, setFeriados] = useState<FeriadoMunicipalDTO[]>([]);
  const [mostrarGestao, setMostrarGestao] = useState(false);
  const [novoFeriado, setNovoFeriado] = useState({ municipio: "", uf: "", data: "", nome: "" });
  const [salvandoFeriado, setSalvandoFeriado] = useState(false);

  const carregarFeriados = useCallback(() => {
    getFeriadosMunicipais().then(setFeriados).catch(() => {});
  }, []);
  useEffect(() => { carregarFeriados(); }, [carregarFeriados]);

  // Feriados municipais que batem com o UF + município preenchidos no formulário de cálculo.
  const feriadosAplicaveis = useMemo(() => {
    if (!uf || !municipio.trim()) return [];
    const m = normText(municipio);
    return feriados
      .filter(f => f.uf === uf && normText(f.municipio) === m)
      .map(f => ({ mes: f.mes, dia: f.dia, nome: f.nome }));
  }, [feriados, uf, municipio]);

  // Só oferece no seletor os municípios que o sistema já reconhece (têm feriado cadastrado)
  // para o estado escolhido — evita o usuário digitar um município sem cobertura de feriados.
  const municipiosDisponiveis = useMemo(() => {
    if (!uf) return [];
    const nomes = new Set(feriados.filter(f => f.uf === uf).map(f => f.municipio));
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [feriados, uf]);

  useEffect(() => { setMunicipio(""); }, [uf]);

  const calcular = () => {
    const n = parseInt(dias, 10);
    if (!dataPublicacao) { setErro("Informe a data de publicação/intimação."); setResultado(null); return; }
    if (!n || n <= 0) { setErro("Informe uma quantidade de dias válida."); setResultado(null); return; }
    setErro("");
    setResultado(calcularPrazo({
      dataPublicacao, dias: n, uf, tipoContagem, considerarRecesso,
      feriadosExtras: feriadosAplicaveis,
    }));
  };

  const publicacaoEhUtil = dataPublicacao ? isDiaUtil(dataPublicacao, uf, considerarRecesso, feriadosAplicaveis) : true;

  const salvarFeriado = async () => {
    if (!novoFeriado.municipio.trim() || !novoFeriado.uf || !novoFeriado.data || !novoFeriado.nome.trim()) return;
    const [, mesStr, diaStr] = novoFeriado.data.split("-");
    setSalvandoFeriado(true);
    try {
      await createFeriadoMunicipal({
        municipio: novoFeriado.municipio.trim(),
        uf: novoFeriado.uf,
        mes: parseInt(mesStr, 10),
        dia: parseInt(diaStr, 10),
        nome: novoFeriado.nome.trim(),
      });
      setNovoFeriado({ municipio: "", uf: "", data: "", nome: "" });
      carregarFeriados();
    } finally {
      setSalvandoFeriado(false);
    }
  };

  const removerFeriado = async (id: string) => {
    await deleteFeriadoMunicipal(id);
    carregarFeriados();
  };

  const baixarPDF = async () => {
    if (!resultado) return;
    if (!canExport(plan, "pdf")) { alert("Seu plano não inclui exportação em PDF."); return; }
    setExportando(true);
    try {
      const linhas = [
        { label: "Data de publicação / intimação", valor: fmtData(dataPublicacao) },
        { label: "Quantidade de dias do prazo", valor: `${dias} dias ${tipoContagem === "uteis" ? "úteis" : "corridos"}` },
        { label: "Forma do processo", valor: tipoProcesso === "eletronico" ? "Eletrônico" : "Físico" },
        { label: "Estado", valor: uf ? `${uf} — ${UF_LABEL[uf]}` : "— não informado —" },
        ...(municipio.trim() ? [{ label: "Município / comarca", valor: municipio }] : []),
        { label: "Início da contagem", valor: fmtData(resultado.dataInicio) },
        { label: "Vencimento do prazo", valor: fmtData(resultado.dataFinal) },
      ];

      const secoes: ExportDoc["secoes"] = [{ nome: "Dados do Prazo", tipo: "resumo", linhas }];
      if (resultado.diasPulados.length > 0) {
        secoes.push({
          nome: "Dias não úteis considerados na contagem",
          tipo: "tabela",
          colunas: ["Data", "Motivo"],
          dados: resultado.diasPulados.map(d => ({ Data: fmtData(d.data), Motivo: d.motivo })),
        });
      }

      const criterios = [
        "Início da contagem: primeiro dia útil seguinte à data de publicação/intimação (art. 224, CPC).",
        considerarRecesso
          ? "Recesso forense (20/dez a 20/jan, art. 220 do CPC) considerado na contagem."
          : "Recesso forense NÃO considerado nesta contagem (opção desmarcada no momento do cálculo).",
        tipoProcesso === "eletronico"
          ? "Processo eletrônico: protocolo admitido até 23h59 do dia do vencimento (Lei 11.419/2006, art. 3º, parágrafo único)."
          : "Processo físico: o protocolo deve ocorrer dentro do horário de expediente do fórum no dia do vencimento.",
        "Ferramenta de referência — recomenda-se confirmar o calendário forense oficial do tribunal/comarca antes de qualquer decisão baseada neste cálculo.",
      ];

      const advogado = userProfile ? {
        nome: userProfile.name,
        oab: userProfile.oab?.[0]?.number,
        estado: userProfile.oab?.[0]?.state,
        oabs: userProfile.oab?.map(o => ({ estado: o.state, numero: o.number })),
        escritorio: userProfile.company?.name,
      } : undefined;

      await exportarPDF({
        titulo: "Comprovante de Cálculo de Prazo Processual",
        subtitulo: "Ferramenta de referência — Legallis",
        data_calculo: today,
        processo: processo.trim() || undefined,
        criterios,
        advogado,
        secoes,
      }, `prazo-${resultado.dataFinal}`);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="p-8 space-y-5 max-w-3xl">
      <div>
        <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>Calculadora de Prazos</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>
          Data de publicação/intimação + quantidade de dias → data final do prazo, considerando feriados e recesso forense.
        </p>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4">
          <DateField label="Data de publicação / intimação" value={dataPublicacao} onChange={setDataPublicacao} />
          <div>
            <Lbl>Quantidade de dias do prazo</Lbl>
            <Inp type="number" min={1} value={dias} onChange={e => setDias(e.target.value)} />
          </div>
          <div>
            <Lbl>Contagem</Lbl>
            <Sel value={tipoContagem} onChange={e => setTipoContagem(e.target.value as "uteis" | "corridos")}>
              <option value="uteis">Dias úteis (padrão cível — art. 219, CPC)</option>
              <option value="corridos">Dias corridos (penal / trabalhista)</option>
            </Sel>
          </div>
          <div>
            <Lbl>Forma do processo</Lbl>
            <Sel value={tipoProcesso} onChange={e => setTipoProcesso(e.target.value as "eletronico" | "fisico")}>
              <option value="eletronico">Eletrônico (PJe, e-SAJ, etc.)</option>
              <option value="fisico">Físico</option>
            </Sel>
          </div>
          <div>
            <Lbl>Estado (feriados estaduais)</Lbl>
            <Sel value={uf} onChange={e => setUf(e.target.value as UF | "")}>
              <option value="">— apenas feriados nacionais —</option>
              {UFS.map(u => <option key={u} value={u}>{u} — {UF_LABEL[u]}</option>)}
            </Sel>
          </div>
          <div>
            <Lbl>Município / comarca (opcional)</Lbl>
            <Sel value={municipio} onChange={e => setMunicipio(e.target.value)} disabled={!uf}>
              <option value="">{uf ? "— nenhum município específico —" : "selecione o estado primeiro"}</option>
              {municipiosDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
            </Sel>
          </div>
          <div>
            <Lbl>Nº do processo / referência (opcional)</Lbl>
            <Inp value={processo} onChange={e => setProcesso(e.target.value)} placeholder="Aparece no PDF, se preenchido" />
          </div>
        </div>

        <label className="flex items-center gap-2 mt-4 cursor-pointer">
          <input type="checkbox" checked={considerarRecesso} onChange={e => setConsiderarRecesso(e.target.checked)} className="accent-[var(--gold)]" />
          <span className="text-sm" style={{ color: "var(--text2)" }}>Considerar recesso forense (20/dez a 20/jan — art. 220, CPC)</span>
        </label>

        {uf && municipio.trim() && feriadosAplicaveis.length > 0 && (
          <p className="text-xs mt-2" style={{ color: "var(--text3)" }}>
            {feriadosAplicaveis.length} feriado(s) municipal(is) de {municipio} ({uf}) serão considerados.
          </p>
        )}

        {dataPublicacao && !publicacaoEhUtil && (
          <p className="text-xs mt-2" style={{ color: "var(--text3)" }}>
            A data de publicação informada não é dia útil — a contagem começará no próximo dia útil seguinte.
          </p>
        )}

        {erro && <p className="text-xs mt-3" style={{ color: "#f87171" }}>{erro}</p>}

        <button onClick={calcular}
          className="mt-4 px-5 py-2 rounded-lg font-semibold text-sm"
          style={{ background: "var(--gold)", color: "#000" }}>
          Calcular prazo
        </button>
      </Card>

      {resultado && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
              <div>
                <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text3)" }}>Início da contagem</p>
                <p className="text-lg font-semibold" style={{ color: "var(--text)" }}>{fmtData(resultado.dataInicio)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text3)" }}>Vencimento do prazo</p>
                <p className="text-2xl font-serif font-bold" style={{ color: "var(--gold)" }}>{fmtData(resultado.dataFinal)}</p>
              </div>
            </div>
            <button onClick={baixarPDF} disabled={exportando}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold flex-shrink-0"
              style={{ background: "var(--gold)", color: "#000", opacity: exportando ? 0.6 : 1 }}>
              📄 {exportando ? "Gerando..." : "Baixar PDF"}
            </button>
          </div>

          <p className="text-xs mt-3" style={{ color: "var(--text2)" }}>
            {tipoProcesso === "eletronico"
              ? "Processo eletrônico: a petição pode ser protocolada até as 23h59 do dia do vencimento (Lei 11.419/2006, art. 3º, parágrafo único)."
              : "Processo físico: o protocolo precisa ser feito dentro do horário de expediente do fórum no dia do vencimento — confirme o horário local."}
          </p>

          {resultado.diasPulados.length > 0 && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text3)" }}>
                Dias não úteis considerados na contagem ({resultado.diasPulados.length})
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
                {resultado.diasPulados.map((d, i) => (
                  <div key={i} className="flex justify-between px-3 py-1.5 text-xs"
                    style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined, color: "var(--text2)" }}>
                    <span>{fmtData(d.data)}</span>
                    <span style={{ color: "var(--text3)" }}>{d.motivo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs mt-4" style={{ color: "var(--text3)" }}>
            Ferramenta de referência — considera feriados nacionais, o feriado estadual principal do estado selecionado,
            o recesso forense e os feriados municipais que você cadastrar. Não substitui a conferência do calendário
            forense oficial do tribunal/comarca do processo.
          </p>
        </Card>
      )}

      <Card padding="p-3">
        <button onClick={() => setMostrarGestao(v => !v)} className="w-full flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text3)" }}>
            Feriados municipais cadastrados ({feriados.length})
          </span>
          <span className="text-xs" style={{ color: "var(--text3)" }}>{mostrarGestao ? "Ocultar ▲" : "Gerenciar ▼"}</span>
        </button>

        {mostrarGestao && (
          <div className="mt-4 space-y-4">
            <p className="text-xs" style={{ color: "var(--text3)" }}>
              Cadastre aqui aniversário da comarca, padroeiro ou qualquer outro ponto facultativo local das comarcas
              onde você atua — a data se repete todo ano automaticamente.
            </p>

            <div className="grid grid-cols-4 gap-3 items-end">
              <div>
                <Lbl>Município</Lbl>
                <Inp value={novoFeriado.municipio} onChange={e => setNovoFeriado(p => ({ ...p, municipio: e.target.value }))} placeholder="Ex.: Belo Horizonte" />
              </div>
              <div>
                <Lbl>UF</Lbl>
                <Sel value={novoFeriado.uf} onChange={e => setNovoFeriado(p => ({ ...p, uf: e.target.value }))}>
                  <option value="">—</option>
                  {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                </Sel>
              </div>
              <div>
                <Lbl>Data</Lbl>
                <Inp type="date" value={novoFeriado.data} onChange={e => setNovoFeriado(p => ({ ...p, data: e.target.value }))} />
              </div>
              <div>
                <Lbl>Nome do feriado</Lbl>
                <Inp value={novoFeriado.nome} onChange={e => setNovoFeriado(p => ({ ...p, nome: e.target.value }))} placeholder="Ex.: Aniversário da comarca" />
              </div>
            </div>
            <button onClick={salvarFeriado} disabled={salvandoFeriado}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "var(--gold)", color: "#000" }}>
              {salvandoFeriado ? "Salvando..." : "Adicionar feriado municipal"}
            </button>

            {feriados.length > 0 && (
              <div className="rounded-lg" style={{ border: "1px solid var(--border)" }}>
                {feriados.map((f, i) => (
                  <div key={f.id} className="flex items-center justify-between px-3 py-2 text-sm"
                    style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                    <div>
                      <span style={{ color: "var(--text)" }}>{f.nome}</span>
                      <span className="text-xs ml-2" style={{ color: "var(--text3)" }}>
                        {String(f.dia).padStart(2, "0")}/{String(f.mes).padStart(2, "0")} — {f.municipio}/{f.uf}
                      </span>
                    </div>
                    <button onClick={() => removerFeriado(f.id)} title="Remover"
                      className="text-xs px-2 py-1 rounded"
                      style={{ color: "#f87171" }}>
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
