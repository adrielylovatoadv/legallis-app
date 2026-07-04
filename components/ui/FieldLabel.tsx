import React from "react";

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>
      {children}
    </span>
  );
}
