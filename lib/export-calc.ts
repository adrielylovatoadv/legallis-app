// Exportação de cálculos da calculadora jurídica

export interface ExportRow { [key: string]: string | number }

export interface AdvogadoInfo {
  nome?: string;
  oab?: string;
  estado?: string;
  escritorio?: string;
}

export interface ExportDoc {
  titulo: string;
  subtitulo?: string;
  advogado?: AdvogadoInfo;
  processo?: string;
  secoes: Array<{
    nome: string;
    tipo: "resumo" | "tabela";
    linhas?: Array<{ label: string; valor: string }>;
    colunas?: string[];
    dados?: ExportRow[];
  }>;
}

// ── Excel ─────────────────────────────────────────────────────────────────────
export async function exportarExcel(doc: ExportDoc, nomeArquivo: string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const headerRows: (string | number)[][] = [];
  if (doc.advogado?.escritorio) headerRows.push([doc.advogado.escritorio]);
  if (doc.advogado?.nome) headerRows.push([doc.advogado.nome]);
  if (doc.advogado?.oab) {
    const oabStr = doc.advogado.estado ? `OAB/${doc.advogado.estado} ${doc.advogado.oab}` : `OAB ${doc.advogado.oab}`;
    headerRows.push([oabStr]);
  }
  if (headerRows.length > 0) headerRows.push([]);

  for (const secao of doc.secoes) {
    const sheetName = secao.nome.slice(0, 31);
    let ws: ReturnType<typeof XLSX.utils.aoa_to_sheet>;

    if (secao.tipo === "resumo" && secao.linhas) {
      const aoa = [
        ...headerRows,
        [doc.titulo],
        doc.subtitulo ? [doc.subtitulo] : [],
        doc.processo ? [`Processo: ${doc.processo}`] : [],
        [],
        [secao.nome],
        [],
        ...secao.linhas.map(l => [l.label, l.valor]),
      ].filter(r => r.length > 0);
      ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [{ wch: 40 }, { wch: 20 }];
    } else if (secao.tipo === "tabela" && secao.colunas && secao.dados) {
      const aoa = [
        [doc.titulo],
        [],
        [secao.nome],
        [],
        secao.colunas,
        ...secao.dados.map(row => secao.colunas!.map(c => row[c] ?? "")),
      ];
      ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = secao.colunas.map(() => ({ wch: 18 }));
    } else {
      ws = XLSX.utils.aoa_to_sheet([[secao.nome]]);
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  XLSX.writeFile(wb, `${nomeArquivo}.xlsx`);
}

// ── PDF ───────────────────────────────────────────────────────────────────────
export async function exportarPDF(doc: ExportDoc, nomeArquivo: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margem = 15;
  let y = margem;

  // Cabeçalho do advogado (se informado)
  if (doc.advogado?.nome || doc.advogado?.escritorio) {
    pdf.setFontSize(11);
    pdf.setTextColor(40, 40, 40);
    if (doc.advogado.escritorio) {
      pdf.setFont("helvetica", "bold");
      pdf.text(doc.advogado.escritorio, margem, y);
      y += 6;
    }
    if (doc.advogado.nome) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(doc.advogado.nome, margem, y);
      y += 5;
    }
    if (doc.advogado.oab) {
      pdf.setFontSize(9);
      pdf.setTextColor(80, 80, 80);
      const oabStr = doc.advogado.estado ? `OAB/${doc.advogado.estado} ${doc.advogado.oab}` : `OAB ${doc.advogado.oab}`;
      pdf.text(oabStr, margem, y);
      y += 5;
    }
    y += 2;
  }

  // Linha dourada superior
  pdf.setDrawColor(212, 175, 55);
  pdf.setLineWidth(0.5);
  pdf.line(margem, y, 210 - margem, y);
  y += 6;

  // Título do cálculo
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(40, 40, 40);
  pdf.text(doc.titulo, margem, y);
  y += 8;

  if (doc.subtitulo) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(doc.subtitulo, margem, y);
    y += 6;
  }

  if (doc.processo) {
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Processo: ${doc.processo}`, margem, y);
    y += 5;
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(150, 150, 150);
  pdf.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, margem, y);
  y += 8;

  // Linha dourada inferior do cabeçalho
  pdf.setDrawColor(212, 175, 55);
  pdf.setLineWidth(0.5);
  pdf.line(margem, y, 210 - margem, y);
  y += 8;

  for (const secao of doc.secoes) {
    if (y > 260) { pdf.addPage(); y = margem; }

    // Título da seção
    pdf.setFontSize(11);
    pdf.setTextColor(212, 175, 55);
    pdf.text(secao.nome, margem, y);
    y += 6;

    if (secao.tipo === "resumo" && secao.linhas) {
      autoTable(pdf, {
        startY: y,
        margin: { left: margem, right: margem },
        head: [],
        body: secao.linhas.map(l => [l.label, l.valor]),
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 110, textColor: [80, 80, 80] },
          1: { cellWidth: 60, halign: "right", fontStyle: "bold", textColor: [40, 40, 40] },
        },
        theme: "plain",
        didParseCell: (data) => {
          // Última linha em dourado (total)
          if (secao.linhas && data.row.index === secao.linhas.length - 1) {
            data.cell.styles.textColor = [180, 140, 30];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fontSize = 10;
          }
        },
      });
      y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    } else if (secao.tipo === "tabela" && secao.colunas && secao.dados) {
      autoTable(pdf, {
        startY: y,
        margin: { left: margem, right: margem },
        head: [secao.colunas],
        body: secao.dados.map(row => secao.colunas!.map(c => row[c] ?? "")),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [212, 175, 55], textColor: [0, 0, 0], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        theme: "striped",
      });
      y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }
  }

  pdf.save(`${nomeArquivo}.pdf`);
}
