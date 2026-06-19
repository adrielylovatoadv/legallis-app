// Exportação de cálculos da calculadora jurídica

export interface ExportRow { [key: string]: string | number }

export interface AdvogadoInfo {
  nome?: string;
  oab?: string;
  estado?: string;
  oabs?: Array<{ estado: string; numero: string }>;
  escritorio?: string;
}

export interface ExportDoc {
  titulo: string;
  subtitulo?: string;
  data_calculo?: string;   // YYYY-MM-DD → DD/MM/AAAA no PDF
  tribunal?: string;
  modo?: string;           // "inicial" | "execucao" | "honorario" | ...
  aplicar_dobro?: boolean;
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

function isoToBR(d: string): string {
  const m = (d ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (d ?? "");
}

function oabString(adv: AdvogadoInfo): string {
  if (adv.oabs && adv.oabs.length > 0)
    return adv.oabs.map(o => `OAB/${o.estado} ${o.numero}`).join(" – ");
  if (adv.oab)
    return adv.estado ? `OAB/${adv.estado} ${adv.oab}` : `OAB ${adv.oab}`;
  return "";
}

// ── Excel ─────────────────────────────────────────────────────────────────────
export async function exportarExcel(doc: ExportDoc, nomeArquivo: string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const headerRows: (string | number)[][] = [];
  if (doc.advogado?.escritorio) headerRows.push([doc.advogado.escritorio]);
  if (doc.advogado?.nome) headerRows.push([doc.advogado.nome]);
  const oab = doc.advogado ? oabString(doc.advogado) : "";
  if (oab) headerRows.push([oab]);
  if (headerRows.length > 0) headerRows.push([]);

  for (const secao of doc.secoes) {
    const sheetName = secao.nome.slice(0, 31);
    let ws: ReturnType<typeof XLSX.utils.aoa_to_sheet>;

    if (secao.tipo === "resumo" && secao.linhas) {
      const aoa = [
        ...headerRows,
        [doc.titulo],
        doc.processo ? [`Processo: ${doc.processo}`] : [],
        [],
        [secao.nome],
        [],
        ...secao.linhas.map(l => [l.label, l.valor]),
      ].filter(r => r.length > 0);
      ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [{ wch: 50 }, { wch: 25 }];
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
      ws["!cols"] = secao.colunas.map(() => ({ wch: 20 }));
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
  const pageWidth = 210;
  const contentWidth = pageWidth - 2 * margem;

  const NAVY: [number, number, number] = [26, 58, 100];
  const WHITE: [number, number, number] = [255, 255, 255];
  const BLACK: [number, number, number] = [30, 30, 30];
  const GRAY_BG: [number, number, number] = [240, 242, 245];

  type LastAutoTable = { lastAutoTable: { finalY: number } };

  let y = margem;

  // ── Título principal ──
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(...BLACK);
  pdf.text("PLANILHA DE DÉBITOS JUDICIAIS", pageWidth / 2, y, { align: "center" });
  y += 8;

  // ── Subtítulo por modo ──
  let subtitulo = "";
  if (doc.modo === "inicial") subtitulo = "PETIÇÃO INICIAL — DIREITO DO CONSUMIDOR";
  else if (doc.modo === "execucao") subtitulo = "CUMPRIMENTO DE SENTENÇA";
  else if (doc.subtitulo) subtitulo = doc.subtitulo;

  if (subtitulo) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...NAVY);
    pdf.text(subtitulo, pageWidth / 2, y, { align: "center" });
    y += 7;
  }

  // ── Linha separadora ──
  pdf.setDrawColor(...NAVY);
  pdf.setLineWidth(0.6);
  pdf.line(margem, y, pageWidth - margem, y);
  y += 5;

  // ── Data do cálculo e processo ──
  const infos: string[] = [];
  if (doc.data_calculo) infos.push(`Data do Cálculo: ${isoToBR(doc.data_calculo)}`);
  if (doc.processo) infos.push(`Processo: ${doc.processo}`);
  if (doc.tribunal) infos.push(`Tribunal: ${doc.tribunal}`);

  if (infos.length > 0) {
    pdf.setFillColor(...GRAY_BG);
    pdf.rect(margem, y, contentWidth, 7, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...BLACK);
    pdf.text(infos.join("   |   "), margem + 3, y + 4.8);
    y += 12;
  }

  // ── Seções (tabelas e resumos) ──
  for (const secao of doc.secoes) {
    if (y > 250) { pdf.addPage(); y = margem; }

    y += 3;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...NAVY);
    pdf.text(secao.nome.toUpperCase(), margem, y);
    y += 4;

    if (secao.tipo === "tabela" && secao.colunas && secao.dados) {
      const body = secao.dados.map(row =>
        secao.colunas!.map(c => {
          const v = String(row[c] ?? "");
          return /^\d{4}-\d{2}-\d{2}/.test(v) ? isoToBR(v) : v;
        })
      );

      autoTable(pdf, {
        startY: y,
        margin: { left: margem, right: margem },
        head: [secao.colunas],
        body,
        styles: { fontSize: 8, cellPadding: 2, textColor: BLACK },
        headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
        alternateRowStyles: { fillColor: [247, 248, 250] },
        theme: "grid",
      });
      y = (pdf as unknown as LastAutoTable).lastAutoTable.finalY + 6;

    } else if (secao.tipo === "resumo" && secao.linhas) {
      const lastIdx = secao.linhas.length - 1;

      autoTable(pdf, {
        startY: y,
        margin: { left: margem, right: margem },
        head: [],
        body: secao.linhas.map(l => [l.label, l.valor]),
        styles: { fontSize: 9, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: contentWidth * 0.68, textColor: [60, 60, 60] },
          1: { cellWidth: contentWidth * 0.32, halign: "right", fontStyle: "bold", textColor: BLACK },
        },
        theme: "plain",
        didParseCell: (data) => {
          if (data.row.index === lastIdx) {
            data.cell.styles.fillColor = NAVY;
            data.cell.styles.textColor = WHITE;
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fontSize = 10;
            data.cell.styles.cellPadding = 3;
          }
        },
      });
      y = (pdf as unknown as LastAutoTable).lastAutoTable.finalY + 6;
    }
  }

  // ── Critérios utilizados (apenas inicial/execucao) ──
  if (doc.modo === "inicial" || doc.modo === "execucao") {
    if (y > 235) { pdf.addPage(); y = margem; }

    y += 4;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...NAVY);
    pdf.text("CRITÉRIOS UTILIZADOS", margem, y);
    y += 5;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...BLACK);

    const isTJSP = doc.tribunal?.includes("TJSP");
    const siglaTribunal = doc.tribunal ?? "TJMG";
    const uf = siglaTribunal.replace("TJ", "");

    const criterios: string[] = [];

    if (isTJSP) {
      criterios.push(
        "Atualização Monetária: Tabela Prática do TJSP (atualizada mensalmente pelo Tribunal de Justiça de São Paulo)."
      );
    } else {
      criterios.push(
        "Atualização Monetária: INPC (IBGE, série BCB 188) de julho/1995 a agosto/2024; IPCAe (série BCB 10764) de setembro/2024 em diante."
      );
    }

    criterios.push(
      "Juros de Mora: 0,5% ao mês até dezembro/2002; 1% ao mês de janeiro/2003 a agosto/2024; Taxa Selic mensal (BCB, série 4390) de setembro/2024 em diante (Lei 14.905/2024)."
    );
    criterios.push(
      "Juros calculados sobre o débito corrigido — regime de juros simples (não composto)."
    );
    criterios.push(`Tribunal: ${siglaTribunal} (CGJ/${uf}).`);

    if (doc.modo === "inicial" && doc.aplicar_dobro) {
      criterios.push(
        "Repetição em dobro aplicada nos termos do CDC art. 42, §único (EAREsp 676.608/RS — STJ, independe de comprovação de má-fé)."
      );
    }

    for (const crit of criterios) {
      const lines = pdf.splitTextToSize(`• ${crit}`, contentWidth - 4);
      if (y + lines.length * 4.8 > 268) { pdf.addPage(); y = margem; }
      pdf.text(lines, margem + 2, y);
      y += lines.length * 4.8 + 1.5;
    }
  }

  // ── Assinatura ──
  const adv = doc.advogado;
  if (adv?.nome || (adv && oabString(adv))) {
    const oab = oabString(adv);
    const blocoAltura = (adv.nome ? 5 : 0) + (oab ? 5 : 0) + 15;
    if (y + blocoAltura > 280) { pdf.addPage(); y = margem; }

    y += 14;
    const lx1 = pageWidth / 2 - 38;
    const lx2 = pageWidth / 2 + 38;
    pdf.setDrawColor(...BLACK);
    pdf.setLineWidth(0.35);
    pdf.line(lx1, y, lx2, y);
    y += 5;

    if (adv.nome) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...BLACK);
      pdf.text(adv.nome, pageWidth / 2, y, { align: "center" });
      y += 5;
    }

    if (oab) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(70, 70, 70);
      pdf.text(oab, pageWidth / 2, y, { align: "center" });
    }
  }

  pdf.save(`${nomeArquivo}.pdf`);
}
