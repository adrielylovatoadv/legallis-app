import { NextResponse } from "next/server";
import { auth } from "@/auth";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const wb = XLSX.utils.book_new();

  // ── Clientes ──────────────────────────────────────────────────────────────
  const wsClientes = XLSX.utils.aoa_to_sheet([
    ["Nome *", "CPF", "Telefone", "E-mail", "Endereço", "Tipo Aposentadoria", "Informações"],
    ["Maria Silva", "123.456.789-00", "(31) 99999-0001", "maria@email.com", "Rua das Flores, 10 - BH/MG", "Aposentadoria por Invalidez", "Observações relevantes"],
    ["João Souza", "987.654.321-00", "(31) 98888-0002", "joao@email.com", "", "", ""],
  ]);
  estilizarCabecalho(wsClientes, 7);
  XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes");

  // ── Processos Ativos ─────────────────────────────────────────────────────
  const wsProcessos = XLSX.utils.aoa_to_sheet([
    ["Autor *", "Réu", "Objeto", "Nº Processo", "Data (DD/MM/AAAA)", "Hora (HH:MM)", "Andamento", "Responsável", "Observações", "Atenção (SIM/NÃO)"],
    ["Maria Silva", "BANCO BRADESCO", "Cobrança Indevida", "0000001-00.2024.8.13.0024", "15/01/2024", "09:00", "AGUARDANDO DESPACHO", "Adriely", "", "NÃO"],
    ["João Souza", "NUBANK", "Fraude Cartão", "0000002-00.2024.8.13.0024", "20/02/2024", "14:30", "AIJ - AUDIÊNCIA", "Eduarda", "Trazer documentos", "SIM"],
  ]);
  estilizarCabecalho(wsProcessos, 10);
  XLSX.utils.book_append_sheet(wb, wsProcessos, "Processos Ativos");

  // ── Iniciais ─────────────────────────────────────────────────────────────
  const wsIniciais = XLSX.utils.aoa_to_sheet([
    ["Cliente *", "Réu", "Objeto", "Andamento", "Responsável", "Observações"],
    ["Cleide Alves", "BRADESCO", "Pacote de Serviços", "FAZER INICIAL", "Adriely", "Aguardando procuração"],
    ["Pedro Lima", "ITAÚ", "Débito Indevido", "AGUARDAR DOCS", "Eduarda", ""],
  ]);
  estilizarCabecalho(wsIniciais, 6);
  XLSX.utils.book_append_sheet(wb, wsIniciais, "Iniciais");

  // ── Finalizados ──────────────────────────────────────────────────────────
  // Execução: preencher colunas financeiras (H-M). Outros tipos: deixar em branco.
  const wsFinalizados = XLSX.utils.aoa_to_sheet([
    [
      "Tipo * (Execução / Improcedente / Desistência / Outros)",
      "Cliente *", "Réu", "Nº Processo", "Objeto",
      "Data Finalização (DD/MM/AAAA)", "Motivo / Observações",
      "Valor Execução (R$)", "Honorários (R$)", "Repasse ao Cliente (R$)",
      "Mês", "Data Pagamento (DD/MM/AAAA)", "Status (Pago / Pendente)",
    ],
    ["Improcedente", "Ana Costa",    "BANCO DO BRASIL", "0000010-00.2023.8.13.0024", "Revisional Contrato",  "10/05/2024", "Pedido julgado improcedente", "", "", "", "", "", ""],
    ["Desistência",  "Carlos Melo",  "SANTANDER",       "0000011-00.2023.8.13.0024", "Cobrança Indevida",    "15/06/2024", "Cliente desistiu",            "", "", "", "", "", ""],
    ["Execução",     "Rita Braga",   "CASAS BAHIA",     "0000012-00.2023.8.13.0024", "Cobrança Indevida",    "",           "Execução de sentença",        8500, 3527.5, 4972.5, "Jun/2024", "20/06/2024", "Pago"],
    ["Outros",       "Marcos Paulo", "VIVO",            "0000013-00.2023.8.13.0024", "Cancelamento",         "01/08/2024", "Acordo extrajudicial",        "", "", "", "", "", ""],
  ]);
  estilizarCabecalho(wsFinalizados, 13);
  XLSX.utils.book_append_sheet(wb, wsFinalizados, "Finalizados");

  // ── Acordos ──────────────────────────────────────────────────────────────
  const wsAcordos = XLSX.utils.aoa_to_sheet([
    ["Mês", "Data Pagamento (DD/MM/AAAA)", "Cliente *", "Réu", "Nº Processo", "Objeto", "Valor Acordo (R$)", "Honorários (R$)", "Repasse ao Cliente (R$)", "Status (Pago / Pendente)"],
    ["Janeiro/2024", "15/01/2024", "José Ferreira", "BRADESCO", "0000020-00.2023.8.13.0024", "Cobrança Indevida", 5000, 1500, 3500, "Pago"],
    ["Fevereiro/2024", "20/02/2024", "Lúcia Santos", "ITAÚ", "0000021-00.2023.8.13.0024", "Fraude Cartão", 8000, 2400, 5600, "Pendente"],
  ]);
  estilizarCabecalho(wsAcordos, 10);
  XLSX.utils.book_append_sheet(wb, wsAcordos, "Acordos");

  // ── Larguras de coluna ────────────────────────────────────────────────────
  for (const ws of [wsClientes, wsProcessos, wsIniciais, wsFinalizados, wsAcordos]) {
    ws["!cols"] = Array(20).fill({ wch: 22 });
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo_importacao_legallis.xlsx"',
    },
  });
}

function estilizarCabecalho(ws: XLSX.WorkSheet, numCols: number) {
  for (let c = 0; c < numCols; c++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cell]) continue;
    ws[cell].s = {
      font: { bold: true, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "C9A84C" } },
      alignment: { horizontal: "center" },
    };
  }
}
