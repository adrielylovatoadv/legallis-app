import React from "react";

export function Dialog({ children, onClose, maxWidth = "max-w-lg" }: {
  children: React.ReactNode; onClose: () => void; maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl p-6 space-y-4`}
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
