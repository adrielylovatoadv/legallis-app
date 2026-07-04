export function MetricCard({ value, label, color, size = "md", align = "left" }: {
  value: number | string; label: string; color: string;
  size?: "md" | "lg"; align?: "left" | "center";
}) {
  const centered = align === "center";
  return (
    <div
      className={`rounded-xl p-5 flex flex-col gap-1 ${centered ? "items-center justify-center" : ""}`}
      style={{ background: "var(--surface)", borderLeft: `4px solid ${color}`, border: "1px solid var(--border)" }}
    >
      <span className={`${size === "lg" ? "text-3xl" : "text-2xl"} font-bold tabular-nums ${centered ? "text-center" : ""}`} style={{ color }}>
        {value}
      </span>
      <span className={`text-xs uppercase tracking-wider ${centered ? "text-center" : ""}`} style={{ color: "var(--text3)" }}>
        {label}
      </span>
    </div>
  );
}
