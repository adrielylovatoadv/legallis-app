import React from "react";

export function Card({ children, className = "", padding = "p-5" }: {
  children: React.ReactNode; className?: string; padding?: string;
}) {
  return (
    <div className={`rounded-xl ${padding} ${className}`} style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}
