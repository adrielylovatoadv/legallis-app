"use client";

import { useState } from "react";
import { calcularPrazo, isDiaUtil, UFS, UF_LABEL, type UF, type ResultadoPrazo } from "@/lib/prazos";
import { fmtData } from "@/lib/controle";
import { Input as Inp, Select as Sel, FieldLabel as Lbl, Card } from "@/components/ui";
import { DateField } from "@/components/ui/DateField";

export default function PrazosPage() {
  const today = new Date().toISOString().split("T")[0];
  const [dataPublicacao, setDataPublicacao] = useState(today);
  const [dias, setDias] = useState("15");
  const [uf, setUf] = useState<UF | "">("");
  const [tipoContagem, setTipoContagem] = useState<"uteis" | "corridos">("uteis");
  const [considerarRecesso, setConsiderarRecesso] = useState(true);
  const [resultado, setResultado] = useState<ResultadoPrazo | null>(null);
  const [erro, setErro] = useState("");

  const calcular = () => {
    const n = parseInt(dias, 10);
    if (!dataPublicacao) { setErro("Informe a data de publicação/intimação."); setResultado(null); return; }
    if (!n || n <= 0) { setErro("Informe uma quantidade de dias válida."); setResultado(null); return; }
    setErro("");
    setResultado(calcularPrazo({ dataPublicacao, dias: n, uf, tipoContagem, considerarRecesso }));
  };

  const publicacaoEhUtil = dataPublicacao ? isDiaUtil(dataPublicacao, uf, considerarRecesso) : true;

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
            <Lbl>Estado (feriados estaduais)</Lbl>
            <Sel value={uf} onChange={e => setUf(e.target.value as UF | "")}>
              <option value="">— apenas feriados nacionais —</option>
              {UFS.map(u => <option key={u} value={u}>{u} — {UF_LABEL[u]}</option>)}
            </Sel>
          </div>
        </div>

        <label className="flex items-center gap-2 mt-4 cursor-pointer">
          <input type="checkbox" checked={considerarRecesso} onChange={e => setConsiderarRecesso(e.target.checked)} className="accent-[var(--gold)]" />
          <span className="text-sm" style={{ color: "var(--text2)" }}>Considerar recesso forense (20/dez a 20/jan — art. 220, CPC)</span>
        </label>

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
            Ferramenta de referência — considera feriados nacionais, o feriado estadual principal do estado selecionado
            e o recesso forense. Não substitui a conferência do calendário forense do tribunal/comarca do processo.
          </p>
        </Card>
      )}
    </div>
  );
}
