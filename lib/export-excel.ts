import * as XLSX from "xlsx";
import { getAcordos, getExecucoes, getHonIniciais, getFixas, getVariaveis, COLS, COL_TO_MES } from "./financeiro";
import { getProcessos, getClientes, getIniciais } from "./controle";

function fmtNum(v: number) {
  return Number(v.toFixed(2));
}

export async function exportFinanceiro() {
  const [acordos, execucoes, honIniciais, fixas, variaveis] = await Promise.all([
    getAcordos(), getExecucoes(), getHonIniciais(), getFixas(), getVariaveis(),
  ]);

  const wb = XLSX.utils.book_new();

  // Acordos
  const wsAcordos = XLSX.utils.json_to_sheet(acordos.map(a => ({
    Mês: a.mes,
    "Data Pagamento": a.data_pagamento,
    Cliente: a.cliente,
    Réu: a.reu,
    Objeto: a.objeto,
    Processo: a.processo,
    "Valor Acordo (R$)": fmtNum(a.valor_acordo),
    "Honorários (R$)": fmtNum(a.honorarios),
    Status: a.status,
  })));
  XLSX.utils.book_append_sheet(wb, wsAcordos, "Acordos");

  // Execuções
  const wsExecucoes = XLSX.utils.json_to_sheet(execucoes.map(e => ({
    Mês: e.mes,
    "Data Pagamento": e.data_pagamento,
    Cliente: e.cliente,
    Réu: e.reu,
    Processo: e.processo,
    Tipo: e.tipo_execucao === "honorarios_somente" ? "Somente honorário" : "Processo completo",
    "Valor Percebido (R$)": fmtNum(e.valor_percebido),
    "% Honorários": e.pct_honorarios ?? 35,
    "Sucumbência (R$)": fmtNum(e.sucumbencia),
    "Honorários (R$)": fmtNum(e.honorarios),
    Status: e.status,
  })));
  XLSX.utils.book_append_sheet(wb, wsExecucoes, "Execuções");

  // Honorários Iniciais
  const wsHon = XLSX.utils.json_to_sheet(honIniciais.map(h => ({
    Mês: h.mes ?? "",
    Cliente: h.cliente,
    Processo: h.processo,
    "Valor (R$)": fmtNum(h.valor),
    "Data Pagamento": h.data_pagamento,
    Observação: h.observacao,
    Status: h.status,
  })));
  XLSX.utils.book_append_sheet(wb, wsHon, "Hon. Iniciais");

  // Despesas Fixas — uma linha por categoria, colunas por mês
  const mesHeaders = COLS.map(c => COL_TO_MES[c] ?? c);
  const fixasRows = fixas.map(f => {
    const row: Record<string, string | number> = {
      Categoria: f.categoria,
      "Quem Paga": f.quem ?? "",
      "Valor Fixo Mensal (R$)": fmtNum(f.valor_fixo),
    };
    COLS.forEach((c, i) => {
      const val = f.valor_fixo > 0 ? f.valor_fixo : (f.valores[c] ?? 0);
      const status = (f.status || {})[c] ?? "";
      row[mesHeaders[i]] = val > 0 ? fmtNum(val) : 0;
      row[`${mesHeaders[i]} Status`] = status;
    });
    return row;
  });
  const wsFixas = XLSX.utils.json_to_sheet(fixasRows);
  XLSX.utils.book_append_sheet(wb, wsFixas, "Desp. Fixas");

  // Despesas Variáveis — uma linha por item, colunas por mês
  const varRows = variaveis.map(v => {
    const row: Record<string, string | number> = {
      Descrição: v.descricao,
      "Valor Total (R$)": fmtNum(v.valor),
      Parcelas: v.parcelas,
      "Quem Paga": v.quem ?? "",
      Onde: v.onde ?? "",
      Status: v.status,
      "Data Compra": v.data_compra ?? "",
    };
    COLS.forEach((c, i) => {
      row[mesHeaders[i]] = fmtNum(v.meses[c] ?? 0);
    });
    return row;
  });
  const wsVar = XLSX.utils.json_to_sheet(varRows);
  XLSX.utils.book_append_sheet(wb, wsVar, "Desp. Variáveis");

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `financeiro_${date}.xlsx`);
}

export async function exportControle() {
  const [processos, clientes, iniciais] = await Promise.all([
    getProcessos(), getClientes(), getIniciais(),
  ]);

  const wb = XLSX.utils.book_new();

  // Processos
  const wsProcessos = XLSX.utils.json_to_sheet(processos.map(p => ({
    Autor: p.autor,
    Réu: p.reu,
    Objeto: p.objeto,
    "Nº Processo": p.numero_processo,
    Data: p.data,
    Hora: p.hora,
    Andamento: p.andamento,
    Responsável: p.responsavel,
    Observações: p.observacoes,
    Vara: p.vara ?? "",
    Tribunal: p.tribunal ?? "",
    Atenção: p.atencao ? "Sim" : "Não",
    Finalizado: p.finalizado ? "Sim" : "Não",
    "Criado Em": p.criado_em,
  })));
  XLSX.utils.book_append_sheet(wb, wsProcessos, "Processos");

  // Clientes
  const wsClientes = XLSX.utils.json_to_sheet(clientes.map(c => ({
    Nome: c.nome,
    Telefone: c.telefone,
    CPF: c.cpf,
    Email: c.email,
    Endereço: c.endereco,
    "Tipo Aposentadoria": c.tipo_aposentadoria,
    Informações: c.informacoes,
    "Criado Em": c.criado_em,
  })));
  XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes");

  // Iniciais
  const wsIniciais = XLSX.utils.json_to_sheet(iniciais.map(i => ({
    Cliente: i.cliente,
    Réu: i.reu,
    Objeto: i.objeto,
    Andamento: i.andamento,
    Responsável: i.responsavel,
    Observações: i.observacoes,
    "Criado Em": i.criado_em,
  })));
  XLSX.utils.book_append_sheet(wb, wsIniciais, "Iniciais");

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `controle_processual_${date}.xlsx`);
}
