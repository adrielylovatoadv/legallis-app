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

// ── Paleta Legallis ────────────────────────────────────────────────────────────
// #C9A84C → dourado principal
// #1A1714 → preto-quente (quase preto)
// #F5F3EF → off-white cremoso
// #FAF7ED → dourado claro (fundo sutil)

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
  const PW = 210;
  const M = 15;                 // margem lateral
  const CW = PW - 2 * M;       // largura útil

  // ── Paleta ──
  const GOLD:       [number,number,number] = [201, 168,  76];
  const DARK:       [number,number,number] = [ 26,  23,  20];
  const OFF_WHITE:  [number,number,number] = [245, 243, 239];
  const GOLD_LIGHT: [number,number,number] = [250, 247, 237];
  const ROW_ALT:    [number,number,number] = [248, 247, 244];
  const GRAY_TEXT:  [number,number,number] = [110, 105,  98];

  type LastAT = { lastAutoTable: { finalY: number } };

  // ══════════════════════════════════════════════════════════════
  // CABEÇALHO ESCURO
  // ══════════════════════════════════════════════════════════════
  const HDR_H = 32;
  pdf.setFillColor(...DARK);
  pdf.rect(0, 0, PW, HDR_H, "F");

  // Linha dourada no topo do cabeçalho
  pdf.setFillColor(...GOLD);
  pdf.rect(0, 0, PW, 1.2, "F");

  // Título principal em dourado
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(...GOLD);
  pdf.text("PLANILHA DE DÉBITOS JUDICIAIS", PW / 2, 13, { align: "center" });

  // Subtítulo por modo em off-white
  let subtitulo = "";
  if (doc.modo === "inicial")  subtitulo = "PETIÇÃO INICIAL — DIREITO DO CONSUMIDOR";
  else if (doc.modo === "execucao") subtitulo = "CUMPRIMENTO DE SENTENÇA";
  else subtitulo = doc.subtitulo ?? doc.titulo;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...OFF_WHITE);
  pdf.text(subtitulo, PW / 2, 21, { align: "center" });

  // Nome do escritório / advogado (pequeno, na base do cabeçalho)
  const adv = doc.advogado;
  if (adv?.escritorio || adv?.nome) {
    const firmLine = [adv.escritorio, adv.nome].filter(Boolean).join(" — ");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...GRAY_TEXT);
    pdf.text(firmLine, PW / 2, 28.5, { align: "center" });
  }

  let y = HDR_H + 8;

  // ══════════════════════════════════════════════════════════════
  // BARRA DE INFO (data / tribunal / processo)
  // ══════════════════════════════════════════════════════════════
  const infos: string[] = [];
  if (doc.data_calculo) infos.push(`Data do Cálculo: ${isoToBR(doc.data_calculo)}`);
  if (doc.tribunal)    infos.push(`Tribunal: ${doc.tribunal}`);
  if (doc.processo)    infos.push(`Processo: ${doc.processo}`);

  if (infos.length > 0) {
    pdf.setFillColor(...GOLD_LIGHT);
    pdf.setDrawColor(...GOLD);
    pdf.setLineWidth(0.3);
    pdf.rect(M, y, CW, 7.5, "FD");
    // borda esquerda dourada grossa
    pdf.setFillColor(...GOLD);
    pdf.rect(M, y, 1.5, 7.5, "F");

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...DARK);
    pdf.text(infos.join("   ·   "), M + 5, y + 4.8);
    y += 13;
  }

  // ══════════════════════════════════════════════════════════════
  // SEÇÕES
  // ══════════════════════════════════════════════════════════════
  function drawSectionHeading(label: string) {
    if (y > 250) { pdf.addPage(); y = 15; }
    y += 3;

    // pastilha dourada + texto
    pdf.setFillColor(...GOLD);
    pdf.rect(M, y - 3.5, 2.5, 5.5, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...GOLD);
    pdf.text(label.toUpperCase(), M + 5, y);

    // linha fina dourada
    pdf.setDrawColor(...GOLD);
    pdf.setLineWidth(0.25);
    pdf.line(M, y + 2, M + CW, y + 2);

    y += 6;
  }

  for (const secao of doc.secoes) {
    drawSectionHeading(secao.nome);

    if (secao.tipo === "tabela" && secao.colunas && secao.dados) {
      const body = secao.dados.map(row =>
        secao.colunas!.map(c => {
          const v = String(row[c] ?? "");
          return /^\d{4}-\d{2}-\d{2}/.test(v) ? isoToBR(v) : v;
        })
      );

      autoTable(pdf, {
        startY: y,
        margin: { left: M, right: M },
        head: [secao.colunas],
        body,
        styles: { fontSize: 7.5, cellPadding: 2.2, textColor: DARK, font: "helvetica" },
        headStyles: {
          fillColor: DARK, textColor: GOLD, fontStyle: "bold", fontSize: 7.5,
          cellPadding: 2.8,
        },
        alternateRowStyles: { fillColor: ROW_ALT },
        tableLineColor: [220, 217, 210],
        tableLineWidth: 0.2,
        theme: "grid",
      });
      y = (pdf as unknown as LastAT).lastAutoTable.finalY + 8;

    } else if (secao.tipo === "resumo" && secao.linhas) {
      const lastIdx = secao.linhas.length - 1;

      autoTable(pdf, {
        startY: y,
        margin: { left: M, right: M },
        head: [],
        body: secao.linhas.map(l => [l.label, l.valor]),
        styles: { fontSize: 8.5, cellPadding: 2.8, font: "helvetica" },
        columnStyles: {
          0: { cellWidth: CW * 0.66, textColor: GRAY_TEXT },
          1: { cellWidth: CW * 0.34, halign: "right", fontStyle: "bold", textColor: DARK },
        },
        theme: "plain",
        tableLineColor: [230, 228, 222],
        tableLineWidth: 0.15,
        didParseCell: (data) => {
          if (data.row.index === lastIdx) {
            data.cell.styles.fillColor = GOLD;
            data.cell.styles.textColor = DARK;
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fontSize = 9.5;
            data.cell.styles.cellPadding = 3.5;
          } else if (data.row.index % 2 === 0) {
            data.cell.styles.fillColor = ROW_ALT;
          }
        },
      });
      y = (pdf as unknown as LastAT).lastAutoTable.finalY + 8;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // CRITÉRIOS UTILIZADOS
  // ══════════════════════════════════════════════════════════════
  if (doc.modo === "inicial" || doc.modo === "execucao") {
    drawSectionHeading("Critérios Utilizados");

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...DARK);

    const isTJSP = doc.tribunal?.includes("TJSP");
    const siglaTribunal = doc.tribunal ?? "TJMG";
    const uf = siglaTribunal.replace("TJ", "");

    const criterios: string[] = [];

    criterios.push(
      isTJSP
        ? "Atualização Monetária: Tabela Prática do TJSP (atualizada mensalmente pelo Tribunal de Justiça de São Paulo)."
        : "Atualização Monetária: INPC (IBGE, série BCB 188) de julho/1995 a agosto/2024; IPCAe (série BCB 10764) de setembro/2024 em diante."
    );
    criterios.push(
      "Juros de Mora: 0,5% ao mês até dezembro/2002; 1% ao mês de janeiro/2003 a agosto/2024; Taxa Selic mensal (BCB, série 4390) de setembro/2024 em diante (Lei 14.905/2024)."
    );
    criterios.push("Juros calculados sobre o débito corrigido — regime de juros simples (não composto).");
    criterios.push(`Tribunal: ${siglaTribunal} (CGJ/${uf}).`);

    if (doc.modo === "inicial" && doc.aplicar_dobro) {
      criterios.push(
        "Repetição em dobro aplicada nos termos do CDC art. 42, §único (EAREsp 676.608/RS — STJ, independe de comprovação de má-fé)."
      );
    }

    for (const crit of criterios) {
      const lines = pdf.splitTextToSize(crit, CW - 8);
      if (y + lines.length * 4.6 > 268) { pdf.addPage(); y = 15; }

      // bullet dourado
      pdf.setFillColor(...GOLD);
      pdf.circle(M + 2, y - 0.8, 0.9, "F");

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...DARK);
      pdf.text(lines, M + 6, y);
      y += lines.length * 4.6 + 2.5;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ASSINATURA
  // ══════════════════════════════════════════════════════════════
  if (adv?.nome || (adv && oabString(adv))) {
    const oab = oabString(adv!);
    if (y + 22 > 280) { pdf.addPage(); y = 20; }

    y += 14;

    // Linha dourada
    pdf.setDrawColor(...GOLD);
    pdf.setLineWidth(0.6);
    const lx1 = PW / 2 - 40;
    const lx2 = PW / 2 + 40;
    pdf.line(lx1, y, lx2, y);
    y += 5;

    if (adv!.nome) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...DARK);
      pdf.text(adv!.nome, PW / 2, y, { align: "center" });
      y += 5;
    }

    if (oab) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...GRAY_TEXT);
      pdf.text(oab, PW / 2, y, { align: "center" });
    }
  }

  // Rodapé com marca d'água sutil
  const pageCount = (pdf as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(...GRAY_TEXT);
    pdf.text("Legallis · Calculadora Jurídica", M, 293);
    if (pageCount > 1) pdf.text(`Página ${i} / ${pageCount}`, PW - M, 293, { align: "right" });
  }

  pdf.save(`${nomeArquivo}.pdf`);
}
