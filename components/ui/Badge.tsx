import React from "react";

// `className` traz as cores (ex: retorno de badgeAndamento/badgeStatusAtendimento em lib/controle.ts).
// `size="md"` (padrão) é o badge-pílula usado em cards e tabelas; `size="sm"` é a variante mais
// compacta usada em listas densas (ex: histórico de atendimentos dentro do card de um cliente).
export function Badge({ children, className = "", size = "md" }: {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  const sizeClasses = size === "sm" ? "px-1.5 py-0.5 rounded" : "px-2 py-0.5 rounded-full";
  return (
    <span className={`text-xs whitespace-nowrap ${sizeClasses} ${className}`}>
      {children}
    </span>
  );
}
