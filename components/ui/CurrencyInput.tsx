"use client";

import { useState } from "react";
import React from "react";

function formatarBRL(v: number): string {
  if (!Number.isFinite(v) || v === 0) return "";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Aceita "5.370,00" (padrão brasileiro), "5370,50", "5370.50" e "5370".
// Com vírgula, a última vírgula é o decimal e os pontos são milhar. Sem vírgula, um único
// ponto seguido de 1–2 dígitos é decimal ("5370.5"); qualquer outro caso é milhar ("5.370").
export function parseBRL(texto: string): number {
  const t = texto.replace(/[^\d.,]/g, "");
  let limpo: string;
  const virgula = t.lastIndexOf(",");
  if (virgula >= 0) {
    limpo = `${t.slice(0, virgula).replace(/[.,]/g, "")}.${t.slice(virgula + 1).replace(/[.,]/g, "")}`;
  } else {
    const partes = t.split(".");
    limpo = partes.length === 2 && partes[1].length > 0 && partes[1].length <= 2 ? t : partes.join("");
  }
  const v = parseFloat(limpo);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

// Input de valor monetário: exibe sempre "1.234,56" (separador de milhar por
// ponto, decimais por vírgula), diferente do <input type="number"> nativo,
// que usa ponto decimal e não força casas depois da vírgula.
//
// Enquanto o campo não está focado, o texto exibido é derivado direto de
// `value` (sem useEffect) — evita re-render em cascata e mantém o campo
// sincronizado se o valor mudar de fora (ex.: recálculo do formulário).
// Durante a digitação, guarda o texto em edição à parte, só convertendo
// para número (via parseBRL) a cada tecla e reformatando ao perder o foco.
export function CurrencyInput({ value, onChange, className = "", style, ...props }: {
  value: number;
  onChange: (v: number) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const [textoEditando, setTextoEditando] = useState<string | null>(null);
  const exibido = textoEditando ?? formatarBRL(value);

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      value={exibido}
      onFocus={e => {
        setTextoEditando(formatarBRL(value));
        if (!style?.border) e.target.style.borderColor = "var(--gold)";
        props.onFocus?.(e);
      }}
      onBlur={e => {
        setTextoEditando(null);
        if (!style?.border) e.target.style.borderColor = "var(--border)";
        props.onBlur?.(e);
      }}
      onChange={e => {
        const filtrado = e.target.value.replace(/[^\d.,]/g, "");
        setTextoEditando(filtrado);
        onChange(parseBRL(filtrado));
      }}
      className={`w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors ${className}`}
      style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", ...style }}
    />
  );
}
