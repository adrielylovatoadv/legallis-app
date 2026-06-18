"use client";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ title, message, confirmLabel = "Excluir", danger = true, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          {danger && (
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg"
              style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}>
              ⚠
            </div>
          )}
          <div>
            <h2 className="font-semibold text-base" style={{ color: "var(--text)" }}>{title}</h2>
            <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>{message}</p>
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm"
            style={{
              background: danger ? "rgba(239,68,68,0.15)" : "var(--gold)",
              color: danger ? "#f87171" : "#000",
              border: danger ? "1px solid rgba(239,68,68,0.4)" : "none",
            }}>
            {confirmLabel}
          </button>
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm"
            style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
