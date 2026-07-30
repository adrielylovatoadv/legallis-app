"use client";

import { useState } from "react";
import React from "react";

function formatarBRL(v: number): string {
  if (!Number.isFinite(v) || v === 0) return "";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(texto: string): number {
  const limpo = texto.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const v = parseFloat(limpo);
  return Number.isFinite(v) ? v : 0;
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
        e.target.style.borderColor = "var(--gold)";
        props.onFocus?.(e);
      }}
      onBlur={e => {
        setTextoEditando(null);
        e.target.style.borderColor = "var(--border)";
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
