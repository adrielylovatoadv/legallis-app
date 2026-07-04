"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { MetricCard as MetricCardBase } from "@/components/ui";

interface Indicadores {
  total_processos_ativos: number;
  total_clientes: number;
  processos_por_responsavel: { nome: string; valor: number }[];
  iniciais_por_responsavel: { nome: string; valor: number }[];
  processos_por_andamento: { nome: string; valor: number }[];
  casos_criados_por_mes: { mes: string; valor: number }[];
  financeiro_por_mes: { mes: string; valor: number }[];
}

const CORES = ["#C9A84C", "#22c55e", "#60a5fa", "#f87171", "#818cf8", "#f97316", "#a78bfa"];

function MetricCard({ value, label, color }: { value: number | string; label: string; color: string }) {
  return <MetricCardBase value={value} label={label} color={color} size="lg" align="center" />;
}

function ChartCard({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>{title}</h3>
      {empty
        ? <p className="text-sm py-10 text-center" style={{ color: "var(--text3)" }}>Sem dados suficientes ainda.</p>
        : <div style={{ width: "100%", height: 260 }}>{children}</div>
      }
    </div>
  );
}

const tooltipStyle = { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)" };

export default function IndicadoresPage() {
  const [data, setData] = useState<Indicadores | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/indicadores")
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6" style={{ color: "var(--text3)" }}>Carregando...</div>;
  if (!data) return <div className="p-6" style={{ color: "var(--text3)" }}>Não foi possível carregar os indicadores.</div>;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>Indicadores</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>Produtividade da equipe e volume de processos</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard value={data.total_processos_ativos} label="Processos ativos" color="#C9A84C" />
        <MetricCard value={data.total_clientes} label="Clientes cadastrados" color="#22c55e" />
        <MetricCard value={data.processos_por_responsavel.length} label="Responsáveis com casos ativos" color="#60a5fa" />
        <MetricCard value={data.iniciais_por_responsavel.reduce((s, r) => s + r.valor, 0)} label="Iniciais pendentes" color="#f87171" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Processos ativos por responsável" empty={data.processos_por_responsavel.length === 0}>
          <ResponsiveContainer>
            <BarChart data={data.processos_por_responsavel} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--text3)", fontSize: 12 }} />
              <YAxis type="category" dataKey="nome" width={100} tick={{ fill: "var(--text2)", fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="valor" fill="#C9A84C" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribuição por andamento" empty={data.processos_por_andamento.length === 0}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data.processos_por_andamento} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={90}
                label={(props: unknown) => {
                  const { nome, valor } = props as { nome: string; valor: number };
                  return `${nome}: ${valor}`;
                }}>
                {data.processos_por_andamento.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Casos criados nos últimos 6 meses" empty={data.casos_criados_por_mes.every(m => m.valor === 0)}>
          <ResponsiveContainer>
            <LineChart data={data.casos_criados_por_mes}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fill: "var(--text3)", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--text3)", fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="valor" name="Processos + Iniciais" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Honorários recebidos por mês" empty={data.financeiro_por_mes.length === 0}>
          <ResponsiveContainer>
            <LineChart data={data.financeiro_por_mes}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fill: "var(--text3)", fontSize: 12 }} />
              <YAxis tick={{ fill: "var(--text3)", fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
              <Line type="monotone" dataKey="valor" name="Honorários" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Iniciais pendentes por responsável" empty={data.iniciais_por_responsavel.length === 0}>
          <ResponsiveContainer>
            <BarChart data={data.iniciais_por_responsavel}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="nome" tick={{ fill: "var(--text2)", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--text3)", fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="valor" name="Iniciais pendentes" fill="#818cf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
