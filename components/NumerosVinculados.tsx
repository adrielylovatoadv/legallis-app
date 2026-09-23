"use client";

import {
  TIPOS_NUMERO_VINCULADO, TIPO_CUMPRIMENTO, siglaVinculo, vinculadosPreenchidos, normText,
  type NumeroVinculado, type Processo,
} from "@/lib/controle";
import { Input as Inp, Select as Sel, FieldLabel as Lbl } from "@/components/ui";

// Número principal + números de incidentes (cumprimento de sentença, agravo...) nas listagens.
// Na aba de execução o nº do cumprimento vem em destaque — é nele que se peticiona no eproc.
export function NumerosProcesso({ p, destacarCumprimento = false, as: Tag = "div" }: {
  p: Pick<Processo, "numero_processo" | "numeros_vinculados">;
  destacarCumprimento?: boolean;
  as?: "div" | "p";
}) {
  const vinc = vinculadosPreenchidos(p);
  if (!p.numero_processo && vinc.length === 0) return null;
  return (
    <>
      {p.numero_processo && (
        <Tag className="text-xs mt-0.5 font-mono whitespace-nowrap" style={{ color: "var(--text3)" }}>{p.numero_processo}</Tag>
      )}
      {vinc.map((v, i) => {
        const destaque = destacarCumprimento && normText(v.tipo).startsWith("cumprimento");
        return (
          <Tag key={i} className="text-xs mt-0.5 font-mono whitespace-nowrap" title={v.tipo}
            style={{ color: destaque ? "var(--gold)" : "var(--text3)", fontWeight: destaque ? 600 : undefined }}>
            <span className="font-sans">↳ {siglaVinculo(v.tipo)}</span> {v.numero}
          </Tag>
        );
      })}
    </>
  );
}

export function temCumprimento(lista: NumeroVinculado[] | undefined): boolean {
  return (lista || []).some(v => normText(v.tipo).startsWith("cumprimento"));
}

export function novoCumprimento(): NumeroVinculado {
  return { tipo: TIPO_CUMPRIMENTO, numero: "" };
}

export function VinculadosEditor({ value, onChange }: {
  value: NumeroVinculado[];
  onChange: (v: NumeroVinculado[]) => void;
}) {
  const setItem = (i: number, patch: Partial<NumeroVinculado>) =>
    onChange(value.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <div>
      <Lbl>Números vinculados / incidentes</Lbl>
      <p className="text-xs mb-2" style={{ color: "var(--text3)" }}>
        Incidentes com número próprio — ex.: no eproc/TJSP o cumprimento de sentença gera um novo nº de processo.
      </p>
      <div className="space-y-2">
        {value.map((v, i) => {
          const tipoCustom = !TIPOS_NUMERO_VINCULADO.includes(v.tipo);
          return (
            <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
              <Sel value={tipoCustom ? "Outro" : v.tipo} onChange={e => setItem(i, { tipo: e.target.value })}
                style={{ minWidth: 200 }}>
                {TIPOS_NUMERO_VINCULADO.map(t => <option key={t} value={t}>{t}</option>)}
              </Sel>
              <Inp value={v.numero} placeholder="0000000-00.0000.0.00.0000"
                onChange={e => setItem(i, { numero: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
              <button type="button" title="Remover" onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="text-xs px-2 py-1 rounded"
                style={{ background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border)" }}>✕</button>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={() => onChange([...value, novoCumprimento()])}
        className="mt-2 text-xs px-3 py-1.5 rounded"
        style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>
        + Adicionar número
      </button>
    </div>
  );
}
