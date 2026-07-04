import React from "react";

export function Input({ className = "", style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors ${className}`}
      style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", ...style }}
      onFocus={e => { e.target.style.borderColor = "var(--gold)"; props.onFocus?.(e); }}
      onBlur={e => { e.target.style.borderColor = "var(--border)"; props.onBlur?.(e); }}
    />
  );
}
