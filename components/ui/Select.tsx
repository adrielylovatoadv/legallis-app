import React from "react";

export function Select({ children, className = "", style, fullWidth = true, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { fullWidth?: boolean }) {
  return (
    <select
      {...props}
      className={`${fullWidth ? "w-full" : ""} px-3 py-2 rounded-lg text-sm outline-none ${className}`}
      style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", ...style }}
    >
      {children}
    </select>
  );
}
