"use client";

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "date" | "time";
};

export function DateField({ label, value, onChange, type = "date" }: DateFieldProps) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
      />
    </div>
  );
}
