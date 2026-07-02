"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getProcessos, createProcesso, updateProcesso, deleteProcesso, marcarOk,
  ANDAMENTOS_PROCESSO, fmtData, badgeAndamento, gcalUrl, normText,
  type Processo,
} from "@/lib/controle";
import { DateField } from "@/components/ui/DateField";

const POR_PAGINA = 50;

type Aba = "ativos" | "audiencias" | "prazos" | "standby" | "suspenso" | "procedente" | "novo";

function Sel({ children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className="px-3 py-2 rounded-lg text-sm outline-none"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
      {children}
    </select>
  );
}
function Inp({ ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className="w-full px-3 py-2 rounded-lg text-sm outline-none"
    style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }} />;
}
function Lbl({ children }: { children: React.ReactNode }) {
  return <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text3)" }}>{children}</span>;
}

function ProcessoForm({ initial, onSave, onCancel, responsaveis = [] }: {
  initial?: Partial<Processo>;
  onSave: (d: Omit<Processo, "id" | "criado_em">) => Promise<void>;
  onCancel: () => void;
  responsaveis?: string[];
}) {
  const blank = { autor:"",reu:"",objeto:"",numero_processo:"",data:"",hora:"",andamento:"",responsavel:"",observacoes:"",atencao:false,finalizado:false };
  const [form, setForm] = useState({ ...blank, ...(initial || {}) });
  const [saving, setSaving] = useState(false);
  const [erroAutor, setErroAutor] = useState(false);
  const set = (k: string, v: string | boolean) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (k === "autor") setErroAutor(false);
  };
  const submit = async () => {
    if (!form.autor.trim()) { setErroAutor(true); return; }
    setSaving(true);
    try { await onSave(form as Omit<Processo,"id"|"criado_em">); } finally { setSaving(false); }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Lbl>Autor *</Lbl>
          <Inp value={form.autor} onChange={e => set("autor",e.target.value)}
            style={erroAutor ? { background:"rgba(239,68,68,0.08)", border:"1px solid #ef4444", color:"var(--text)" } : undefined} />
          {erroAutor && <p className="text-xs mt-1" style={{ color:"#f87171" }}>Campo obrigatório</p>}
        </div>
        <div><Lbl>Réu</Lbl><Inp value={form.reu} onChange={e => set("reu",e.target.value)} /></div>
        <div><Lbl>Objeto</Lbl><Inp value={form.objeto} onChange={e => set("objeto",e.target.value)} /></div>
        <div><Lbl>Nº Processo</Lbl><Inp value={form.numero_processo} onChange={e => set("numero_processo",e.target.value)} /></div>
        <DateField label="Data" value={form.data} onChange={v => set("data", v)} />
        <div><Lbl>Hora</Lbl><Inp value={form.hora} placeholder="HH:MM" onChange={e => set("hora",e.target.value)} /></div>
        <div>
          <Lbl>Andamento</Lbl>
          <Sel value={form.andamento} onChange={e => set("andamento",e.target.value)} style={{ width:"100%" }}>
            <option value="">Selecionar</option>
            {ANDAMENTOS_PROCESSO.map(a => <option key={a} value={a}>{a}</option>)}
          </Sel>
        </div>
        <div>
          <Lbl>Responsável</Lbl>
          <Sel value={form.responsavel} onChange={e => set("responsavel",e.target.value)} style={{ width:"100%" }}>
            <option value="">—</option>
            {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
          </Sel>
        </div>
      </div>
      <div>
        <Lbl>Observações</Lbl>
        <textarea rows={2} value={form.observacoes} onChange={e => set("observacoes",e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm resize-none"
          style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text)" }} />
      </div>
      <div className="flex items-center gap-5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!form.atencao} onChange={e => set("atencao",e.target.checked)} className="accent-red-500" />
          <span className="text-sm" style={{ color:"var(--text2)" }}>🚨 Atenção/Risco</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!form.finalizado} onChange={e => set("finalizado",e.target.checked)} />
          <span className="text-sm" style={{ color:"var(--text2)" }}>Finalizado</span>
        </label>
      </div>
      <div className="flex gap-3">
        <button onClick={submit} disabled={saving}
          className="px-5 py-2 rounded-lg font-semibold text-sm"
          style={{ background:"var(--gold)", color:"#000" }}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm"
          style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ProcessoRow({ p, onEdit, onDelete, onOk, onToggleAtencao }: {
  p: Processo;
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onOk: (id: string) => void;
  onToggleAtencao: (id: string, val: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const url = gcalUrl(p);
  const hoje = new Date().toISOString().split("T")[0];
  const d = p.data?.slice(0, 10);
  const diasAte = d ? Math.floor((new Date(d).getTime() - new Date(hoje).getTime()) / 86400000) : null;
  const alertaCor = diasAte !== null ? (diasAte <= 0 ? "#ef4444" : diasAte <= 3 ? "#f97316" : undefined) : undefined;

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}
      className={p.atencao ? "bg-red-500/5" : ""}>
      <td className="py-2 pr-3 text-sm font-medium" style={{ color: p.atencao ? "#ef4444" : "var(--text)", minWidth: 220 }}>
        <div className="truncate">
          {p.atencao && <span className="mr-1">🚨</span>}
          {p.autor}
        </div>
        {p.responsavel && <div className="text-xs" style={{ color:"var(--text3)" }}>{p.responsavel}</div>}
        {p.numero_processo && (
          <div className="text-xs font-mono whitespace-nowrap" style={{ color:"var(--text3)" }}>{p.numero_processo}</div>
        )}
      </td>
      <td className="py-2 pr-3 text-sm" style={{ color:"var(--text2)", minWidth: 80 }}>{p.reu}</td>
      <td className="py-2 pr-3 text-xs truncate" style={{ color:"var(--text3)", maxWidth: 100 }}>{p.objeto}</td>
      <td className="py-2 pr-3 text-xs" style={{ color:"var(--text3)", maxWidth:120 }}>
        <div className="truncate">{p.observacoes}</div>
      </td>
      <td className="py-2 pr-3 text-xs tabular-nums whitespace-nowrap"
        style={{ color: alertaCor || "var(--text2)" }}>
        {fmtData(p.data)}{p.hora && ` ${p.hora}`}
        {diasAte !== null && diasAte <= 0 && <span className="ml-1">🔴</span>}
        {diasAte !== null && diasAte > 0 && diasAte <= 3 && <span className="ml-1">⚠️</span>}
      </td>
      <td className="py-2 pr-3">
        {p.andamento && (
          <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${badgeAndamento(p.andamento)}`}>
            {p.andamento}
          </span>
        )}
        {url
          ? <a href={url} target="_blank" rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-xs"
              style={{ color:"#60a5fa" }}>📅 Calendar</a>
          : (p.andamento || "").toUpperCase().match(/AIJ|^AC/) && (
              <span className="mt-1 text-xs" title="Adicione data e hora para gerar link"
                style={{ color:"var(--text3)", cursor:"help" }}>📅 sem data/hora</span>
            )
        }
      </td>
      <td className="py-2">
        <div className="flex flex-wrap gap-1">
          <button onClick={() => onOk(p.id)} title="Marcar OK"
            className="text-xs px-2 py-1 rounded"
            style={{ background:"rgba(34,197,94,0.12)", color:"#4ade80" }}>✅</button>
          <button onClick={() => onToggleAtencao(p.id, !p.atencao)} title="Toggle atenção"
            className="text-xs px-2 py-1 rounded"
            style={{ background: p.atencao ? "rgba(239,68,68,0.15)" : "var(--surface2)", color: p.atencao ? "#f87171" : "var(--text3)", border:"1px solid var(--border)" }}>
            🚨
          </button>
          <button onClick={() => onEdit(p)} className="text-xs px-2 py-1 rounded"
            style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>✏️</button>
          {confirming
            ? <button onClick={() => { onDelete(p.id); setConfirming(false); }}
                className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">Confirmar</button>
            : <button onClick={() => setConfirming(true)} className="text-xs px-2 py-1 rounded"
                style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>🗑</button>
          }
        </div>
      </td>
    </tr>
  );
}

export function ProcessosTab() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroAnd, setFiltroAnd] = useState("Todos");
  const [filtroResp, setFiltroResp] = useState("Todos");
  const [aba, setAba] = useState<Aba>("ativos");
  const [editando, setEditando] = useState<Processo | null>(null);
  const [soAtencao, setSoAtencao] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [users, setUsers] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setProcessos(await getProcessos()); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch("/api/users").then(r => r.ok ? r.json() : [])
      .then((list: { name: string }[]) => setUsers(list.map(u => u.name)));
  }, []);

  // Reseta paginação ao mudar filtro ou aba
  useEffect(() => { setPagina(0); }, [busca, filtroAnd, filtroResp, soAtencao, aba]);

  useEffect(() => { load(); }, [load]);

  const isFin = (p: Processo) => {
    if (p.finalizado) return true;
    const a = (p.andamento || "").toUpperCase();
    return a === "ACORDO" || a === "ARQUIVADO" || a === "DESISTÊNCIA" || a === "DESISTENCIA";
  };
  const isSuspenso = (p: Processo) => (p.andamento || "").toUpperCase() === "SUSPENSO";
  const isProcedente = (p: Processo) => (p.andamento || "").toUpperCase() === "PROCEDENTE";

  const filtrar = useCallback((lista: Processo[]) => {
    let r = lista;
    if (busca) {
      const b = normText(busca);
      r = r.filter(p =>
        normText(p.autor).includes(b) || normText(p.reu).includes(b) ||
        normText(p.numero_processo).includes(b) || normText(p.objeto).includes(b) ||
        normText(p.observacoes).includes(b)
      );
    }
    if (filtroAnd !== "Todos") r = r.filter(p => normText(p.andamento).includes(normText(filtroAnd)));
    if (filtroResp !== "Todos") r = r.filter(p => (p.responsavel||"") === filtroResp);
    if (soAtencao) r = r.filter(p => p.atencao);
    return r.sort((a, b) => {
      if (a.atencao && !b.atencao) return -1;
      if (!a.atencao && b.atencao) return 1;
      return (a.data || "9999").localeCompare(b.data || "9999");
    });
  }, [busca, filtroAnd, filtroResp, soAtencao]);

  const hoje = new Date().toISOString().split("T")[0];
  const ativos = filtrar(processos.filter(p => !isFin(p)));
  const audiencias = filtrar(processos.filter(p => {
    const a = (p.andamento||"").toUpperCase();
    return (a.includes("AIJ") || a.startsWith("AC")) && p.data >= hoje && !isFin(p);
  }));
  const prazos = filtrar(processos.filter(p => {
    const a = (p.andamento || "").toUpperCase();
    const isAud = a.includes("AIJ") || a.startsWith("AC");
    return !!p.data && !isAud && !isFin(p) && !isProcedente(p);
  }));
  const standby = filtrar(processos.filter(p => {
    const a = (p.andamento||"").toUpperCase();
    const isAud = a.includes("AIJ") || a.startsWith("AC");
    return ((!p.data) || (isAud && p.data < hoje)) && !isFin(p) && !isSuspenso(p) && !isProcedente(p);
  }));
  const suspensos = filtrar(processos.filter(p => isSuspenso(p) && !isFin(p)));
  const procedentes = filtrar(processos.filter(p => isProcedente(p) && !isFin(p)));

  const handleSave = async (form: Omit<Processo,"id"|"criado_em">) => {
    if (editando) { await updateProcesso(editando.id, form); setEditando(null); }
    else { await createProcesso(form); setAba("ativos"); }
    load();
  };
  const handleDelete = async (id: string) => { await deleteProcesso(id); load(); };
  const handleOk = async (id: string) => { await marcarOk(id); load(); };
  const handleToggleAtencao = async (id: string, val: boolean) => {
    await updateProcesso(id, { atencao: val });
    load();
  };

  const ABAS: { id: Aba; label: string }[] = [
    { id:"ativos", label:`📋 Ativos (${processos.filter(p => !isFin(p)).length})` },
    { id:"audiencias", label:`🔴 Audiências (${processos.filter(p => { const a=(p.andamento||"").toUpperCase(); return (a.includes("AIJ")||a.startsWith("AC"))&&p.data>=hoje&&!isFin(p); }).length})` },
    { id:"prazos", label:`📅 Prazos (${processos.filter(p => { const a=(p.andamento||"").toUpperCase(); return !!p.data&&!a.includes("AIJ")&&!a.startsWith("AC")&&!isFin(p)&&a!=="PROCEDENTE"; }).length})` },
    { id:"standby", label:`⏸️ Standby (${processos.filter(p => { const a=(p.andamento||"").toUpperCase(); const isAud=a.includes("AIJ")||a.startsWith("AC"); return ((!p.data)||(isAud&&p.data<hoje))&&!isFin(p)&&a!=="SUSPENSO"&&a!=="PROCEDENTE"; }).length})` },
    { id:"suspenso", label:`⏸ Suspenso (${processos.filter(p => (p.andamento||"").toUpperCase()==="SUSPENSO"&&!isFin(p)).length})` },
    { id:"procedente", label:`✅ Procedente (${processos.filter(p => (p.andamento||"").toUpperCase()==="PROCEDENTE"&&!isFin(p)).length})` },
    { id:"novo", label:"➕ Novo" },
  ];

  const tabStyle = (id: Aba) => ({
    background: aba === id ? "var(--gold)" : "var(--surface2)",
    color: aba === id ? "#000" : "var(--text2)",
    border: "1px solid var(--border)",
  });

  const renderTable = (lista: Processo[]) => {
    const nAtencao = lista.filter(p => p.atencao).length;
    const totalPaginas = Math.ceil(lista.length / POR_PAGINA);
    const paginaSegura = Math.min(pagina, Math.max(0, totalPaginas - 1));
    const paginada = lista.slice(paginaSegura * POR_PAGINA, (paginaSegura + 1) * POR_PAGINA);

    return lista.length === 0
      ? <p className="py-6 text-center text-sm" style={{ color:"var(--text3)" }}>Nenhum processo encontrado.</p>
      : (
        <>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-sm" style={{ color:"var(--text2)" }}>
              <strong style={{ color:"var(--text)" }}>{lista.length}</strong> processo{lista.length !== 1 ? "s" : ""}
              {lista.length > POR_PAGINA && <span className="ml-2" style={{ color:"var(--text3)" }}>· página {paginaSegura + 1}/{totalPaginas}</span>}
              {nAtencao > 0 && <span className="ml-2 text-red-400 font-semibold">🚨 {nAtencao} em atenção</span>}
            </p>
            <button onClick={() => exportCSV(lista)} className="text-xs px-3 py-1 rounded-lg"
              style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>
              ⬇️ Exportar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom:"2px solid var(--border)" }}>
                  {["Autor / Processo","Réu","Objeto","Observações","Data/Hora","Andamento","Ações"].map(h => (
                    <th key={h} className="pb-2 pt-1 text-left pr-3 text-xs uppercase tracking-wider"
                      style={{ color:"var(--text3)", fontWeight:500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginada.map(p =>
                  editando?.id === p.id
                    ? <tr key={p.id}><td colSpan={7} className="py-2">
                        <ProcessoForm initial={editando} onSave={handleSave} onCancel={() => setEditando(null)} responsaveis={users} />
                      </td></tr>
                    : <ProcessoRow key={p.id} p={p} onEdit={setEditando} onDelete={handleDelete}
                        onOk={handleOk} onToggleAtencao={handleToggleAtencao} />
                )}
              </tbody>
            </table>
          </div>
          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={paginaSegura === 0}
                className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-40"
                style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>
                ← Anterior
              </button>
              {Array.from({ length: totalPaginas }, (_, i) => (
                <button key={i} onClick={() => setPagina(i)}
                  className="px-3 py-1.5 rounded-lg text-sm min-w-9"
                  style={{
                    background: i === paginaSegura ? "var(--gold)" : "var(--surface2)",
                    color: i === paginaSegura ? "#000" : "var(--text2)",
                    border: "1px solid var(--border)",
                  }}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} disabled={paginaSegura === totalPaginas - 1}
                className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-40"
                style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)" }}>
                Próxima →
              </button>
            </div>
          )}
        </>
      );
  };

  const exportCSV = (lista: Processo[]) => {
    const headers = ["Autor","Réu","Objeto","Processo","Data","Hora","Andamento","Responsável","Observações"];
    const rows = lista.map(p => [p.autor,p.reu,p.objeto,p.numero_processo,p.data,p.hora,p.andamento,p.responsavel,p.observacoes].map(v => `"${(v||"").replace(/"/g,'""')}"`));
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿"+csv], { type:"text/csv;charset=utf-8" }));
    a.download = "processos.csv";
    a.click();
  };

  const listaAtual = aba === "ativos" ? ativos
    : aba === "audiencias" ? audiencias
    : aba === "prazos" ? prazos
    : aba === "suspenso" ? suspensos
    : aba === "procedente" ? procedentes
    : standby;

  return (
    <div className="space-y-5">
      {/* Abas */}
      <div className="flex gap-2 flex-wrap">
        {ABAS.map(t => (
          <button key={t.id} onClick={() => setAba(t.id)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={tabStyle(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      {aba !== "novo" && (
        <div className="flex flex-wrap gap-3 items-center">
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Buscar por nome, processo, réu..."
            className="px-3 py-2 rounded-lg text-sm flex-1 min-w-48"
            style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text)" }} />
          <Sel value={filtroAnd} onChange={e => setFiltroAnd(e.target.value)}>
            <option value="Todos">Andamento: Todos</option>
            {ANDAMENTOS_PROCESSO.map(a => <option key={a} value={a}>{a}</option>)}
          </Sel>
          <Sel value={filtroResp} onChange={e => setFiltroResp(e.target.value)}>
            <option value="Todos">Responsável: Todos</option>
            {users.map(r => <option key={r} value={r}>{r}</option>)}
          </Sel>
          <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={soAtencao} onChange={e => setSoAtencao(e.target.checked)} className="accent-red-500" />
            <span className="text-sm" style={{ color:"var(--text2)" }}>🚨 Só Atenção</span>
          </label>
        </div>
      )}

      {/* Conteúdo */}
      <div className="rounded-xl p-5" style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
        {aba === "novo" && <ProcessoForm onSave={handleSave} onCancel={() => setAba("ativos")} responsaveis={users} />}
        {aba !== "novo" && (loading
          ? <div className="py-8 text-center" style={{ color:"var(--text3)" }}>Carregando...</div>
          : renderTable(listaAtual)
        )}
      </div>
    </div>
  );
}
