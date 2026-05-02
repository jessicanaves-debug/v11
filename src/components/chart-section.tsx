import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRANDDI_DARK: [number, number, number] = [13, 51, 73];
const BRANDDI_CYAN: [number, number, number] = [0, 188, 212];
const WHITE: [number, number, number] = [255, 255, 255];
const LIGHT_BG: [number, number, number] = [245, 248, 252];
const TEXT_DARK: [number, number, number] = [20, 35, 50];
const TEXT_GRAY: [number, number, number] = [100, 116, 139];
const F = "helvetica"; // fonte mais próxima de Inter disponível no jsPDF

export interface TopAgressor { score: number; domain: string; }
export interface ContencaoItem { domain: string; status: string; }
export interface StandbyItem { agressor: string; status: string; nextAction: string; }

export interface BbReportData {
  clientName: string; period: string; periodType: "Semanal" | "Quinzenal"; periodDays: number;
  metricasIntro: string; identified: number; inactive: number; occurrences: number;
  notified: number; eliminated: number; notificationsSent: number;
  agressoresAnalysis: string; newAgressors: number; totalAgressors: number; agressoresChartImage?: string;
  heatmapAnalysis: string; topAgressores: TopAgressor[]; heatmapChartImage?: string;
  contencaoItems: ContencaoItem[]; standbyItems: StandbyItem[];
  aprovacaoText: string; resolvidosText: string;
}

function drawChrome(doc: jsPDF, pw: number, ph: number, client: string, period: string, hB64?: string, wB64?: string) {
  doc.setFillColor(...BRANDDI_DARK);
  doc.rect(0, 0, pw, 18, "F");
  if (hB64) {
    try { doc.addImage(hB64, "PNG", pw - 38, 2, 34, 14, undefined, "FAST"); } catch (_) { /**/ }
  } else {
    doc.setFont(F, "bold"); doc.setFontSize(9); doc.setTextColor(...WHITE);
    doc.text("Branddi Monitor", pw - 8, 11, { align: "right" });
  }
  doc.setFont(F, "bold"); doc.setFontSize(10); doc.setTextColor(...WHITE);
  doc.text(`Relatório ${period} de Brand Bidding`, 8, 8);
  doc.setFont(F, "normal"); doc.setFontSize(8); doc.setTextColor(...BRANDDI_CYAN);
  doc.text(client, 8, 14);
  if (wB64) {
    try {
      doc.saveGraphicsState();
      // @ts-ignore
      doc.setGState(new doc.GState({ opacity: 0.07 }));
      doc.addImage(wB64, "PNG", pw - 50, ph - 50, 44, 44, undefined, "FAST");
      doc.restoreGraphicsState();
    } catch (_) { /**/ }
  }
}

function sectionTitle(doc: jsPDF, title: string, y: number, pw: number): number {
  doc.setFillColor(...BRANDDI_DARK);
  doc.roundedRect(8, y, pw - 16, 8, 1, 1, "F");
  doc.setFont(F, "bold"); doc.setFontSize(9); doc.setTextColor(...WHITE);
  doc.text(title, 13, y + 5.5);
  return y + 12;
}

function sectionDesc(doc: jsPDF, text: string, y: number, pw: number): number {
  doc.setFont(F, "italic"); doc.setFontSize(7.5); doc.setTextColor(...TEXT_GRAY);
  const lines = doc.splitTextToSize(text, pw - 24);
  doc.text(lines, 12, y);
  return y + lines.length * 4 + 2;
}

function analysisBlock(doc: jsPDF, text: string, y: number, pw: number): number {
  if (!text) return y;
  const lines = doc.splitTextToSize(text, pw - 30);
  const bH = lines.length * 4.5 + 7;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(10, y, pw - 20, bH, 1.5, 1.5, "F");
  doc.setFillColor(...BRANDDI_CYAN);
  doc.rect(10, y, 2.5, bH, "F");
  doc.setFont(F, "normal"); doc.setFontSize(8); doc.setTextColor(...TEXT_DARK);
  doc.text(lines, 16, y + 5);
  return y + bH + 4;
}

/**
 * Insere gráfico CENTRALIZADO com borda ciano e legenda em fonte Inter.
 * Resolve o problema de gráficos fora de centro relatado pela usuária.
 */
function chartImage(doc: jsPDF, base64: string | undefined, y: number, pw: number, maxH = 62): number {
  if (!base64) return y;

  const MX = 8;          // margem horizontal
  const PAD = 3;         // padding interno ao container

  const containerX = MX;
  const containerW = pw - MX * 2;
  const imgW = containerW - PAD * 2;
  const imgH = Math.min(maxH, Math.round(imgW * 0.44)); // proporção 16:7
  const containerH = imgH + PAD * 2;

  // Borda ciano
  doc.setDrawColor(...BRANDDI_CYAN);
  doc.setLineWidth(0.4);
  doc.roundedRect(containerX, y, containerW, containerH, 2, 2, "S");

  // ── Centralização horizontal exata ──
  // imgX garante que a imagem fica perfeitamente centrada dentro do container
  const imgX = containerX + (containerW - imgW) / 2;
  const imgY = y + PAD;

  try {
    doc.addImage(base64, "PNG", imgX, imgY, imgW, imgH, undefined, "FAST");
  } catch (_) {
    doc.setFillColor(230, 235, 242);
    doc.rect(imgX, imgY, imgW, imgH, "F");
    doc.setFont(F, "italic"); doc.setFontSize(8); doc.setTextColor(...TEXT_GRAY);
    doc.text("[Gráfico não disponível]", imgX + imgW / 2, imgY + imgH / 2, { align: "center" });
  }

  // Legenda centralizada (simula Inter com Helvetica — padrão mais próximo)
  doc.setFont(F, "italic"); doc.setFontSize(6.5); doc.setTextColor(...TEXT_GRAY);
  doc.text("Fonte: Branddi Monitor", pw / 2, y + containerH + 3.5, { align: "center" });

  return y + containerH + 7;
}

function checkPage(doc: jsPDF, y: number, need: number, ph: number, pw: number,
  client: string, period: string, hB64?: string, wB64?: string): number {
  if (y + need > ph - 12) {
    doc.addPage();
    drawChrome(doc, pw, ph, client, period, hB64, wB64);
    return 24;
  }
  return y;
}

export async function generateBbPdf(data: BbReportData): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();

  let hB64: string | undefined;
  let wB64: string | undefined;
  try {
    const [hRes, wRes] = await Promise.all([fetch("/branding/header-bg.png"), fetch("/branding/logo-watermark.png")]);
    const toB64 = async (res: Response) => {
      if (!res.ok) return undefined;
      const blob = await res.blob();
      return new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob); });
    };
    hB64 = await toB64(hRes);
    wB64 = await toB64(wRes);
  } catch (_) { /**/ }

  // Página 1
  drawChrome(doc, PW, PH, data.clientName, data.period, hB64, wB64);
  let y = 36;

  doc.setFont(F, "bold"); doc.setFontSize(18); doc.setTextColor(...BRANDDI_DARK);
  doc.text("Relatório de Brand Bidding", PW / 2, y, { align: "center" });
  y += 8;
  doc.setFont(F, "normal"); doc.setFontSize(11); doc.setTextColor(...BRANDDI_CYAN);
  doc.text(data.period, PW / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(9); doc.setTextColor(...TEXT_GRAY);
  doc.text(data.clientName, PW / 2, y, { align: "center" });
  y += 10;
  doc.setDrawColor(...BRANDDI_CYAN); doc.setLineWidth(0.5);
  doc.line(20, y, PW - 20, y);
  y += 8;
  doc.setFont(F, "italic"); doc.setFontSize(8.5); doc.setTextColor(...TEXT_GRAY);
  const introText = `Este documento apresenta a consolidação ${data.periodType.toLowerCase()} dos resultados e o status das ações de monitoramento e contenção de Brand Bidding, garantindo a proteção da sua marca nos canais de busca.`;
  const introLines = doc.splitTextToSize(introText, PW - 28);
  doc.text(introLines, 14, y);
  y += introLines.length * 4.5 + 10;

  // Seção 1 — Métricas
  y = checkPage(doc, y, 50, PH, PW, data.clientName, data.period, hB64, wB64);
  y = sectionTitle(doc, "1. Métricas Consolidadas", y, PW);
  y = sectionDesc(doc, "A tabela a seguir resume os principais indicadores de Brand Bidding.", y, PW);
  if (data.metricasIntro) y = analysisBlock(doc, data.metricasIntro, y, PW);

  autoTable(doc, {
    startY: y, margin: { left: 10, right: 10 },
    head: [["Indicador", "Quantidade"]],
    body: [
      ["Agressores Identificados", String(data.identified)],
      ["Agressores Inativos", String(data.inactive)],
      ["Ocorrências", String(data.occurrences)],
      ["Notificados", String(data.notified)],
      ["Eliminados", String(data.eliminated)],
      ["Notificações Enviadas", String(data.notificationsSent)],
    ],
    styles: { font: F, fontSize: 8.5, cellPadding: 3, textColor: TEXT_DARK },
    headStyles: { fillColor: BRANDDI_DARK, textColor: WHITE, fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: LIGHT_BG },
    columnStyles: { 1: { halign: "center", fontStyle: "bold" } },
  });
  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 6;

  // Seção 2 — Agressores
  y = checkPage(doc, y, 20, PH, PW, data.clientName, data.period, hB64, wB64);
  y = sectionTitle(doc, "2. Agressores Identificados", y, PW);
  y = sectionDesc(doc, `No período analisado (${data.periodDays} dias), foram identificados ${data.newAgressors} novos agressores e um total de ${data.totalAgressors} agressores ativos monitorados.`, y, PW);
  if (data.agressoresAnalysis) { y = checkPage(doc, y, 18, PH, PW, data.clientName, data.period, hB64, wB64); y = analysisBlock(doc, data.agressoresAnalysis, y, PW); }
  if (data.agressoresChartImage) { y = checkPage(doc, y, 72, PH, PW, data.clientName, data.period, hB64, wB64); y = chartImage(doc, data.agressoresChartImage, y, PW, 62); }

  // Seção 3 — Heatmap
  y = checkPage(doc, y, 20, PH, PW, data.clientName, data.period, hB64, wB64);
  y = sectionTitle(doc, "3. Análise de Ofensores (Heatmap)", y, PW);
  y = sectionDesc(doc, "Classificação dos principais ofensores por intensidade de atividade e impacto.", y, PW);
  if (data.heatmapAnalysis) { y = checkPage(doc, y, 18, PH, PW, data.clientName, data.period, hB64, wB64); y = analysisBlock(doc, data.heatmapAnalysis, y, PW); }
  if (data.heatmapChartImage) { y = checkPage(doc, y, 72, PH, PW, data.clientName, data.period, hB64, wB64); y = chartImage(doc, data.heatmapChartImage, y, PW, 62); }
  if (data.topAgressores.length > 0) {
    y = checkPage(doc, y, 30, PH, PW, data.clientName, data.period, hB64, wB64);
    autoTable(doc, {
      startY: y, margin: { left: 10, right: 10 },
      head: [["Score", "Domínio"]],
      body: data.topAgressores.map((a) => [String(a.score), a.domain]),
      styles: { font: F, fontSize: 8, cellPadding: 2.5, textColor: TEXT_DARK },
      headStyles: { fillColor: BRANDDI_DARK, textColor: WHITE, fontStyle: "bold" },
      alternateRowStyles: { fillColor: LIGHT_BG },
      columnStyles: { 0: { halign: "center", cellWidth: 20 } },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Seção 4 — Contenção
  if (data.contencaoItems.length > 0) {
    y = checkPage(doc, y, 20, PH, PW, data.clientName, data.period, hB64, wB64);
    y = sectionTitle(doc, "4. Status das Ações de Contenção", y, PW);
    y = sectionDesc(doc, "Detalhe do andamento das principais tratativas com agressores:", y, PW);
    autoTable(doc, {
      startY: y, margin: { left: 10, right: 10 },
      head: [["Domínio", "Status"]],
      body: data.contencaoItems.map((i) => [i.domain, i.status]),
      styles: { font: F, fontSize: 8.5, cellPadding: 3, textColor: TEXT_DARK },
      headStyles: { fillColor: BRANDDI_DARK, textColor: WHITE, fontStyle: "bold" },
      alternateRowStyles: { fillColor: LIGHT_BG },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Seção 5 — Standby
  if (data.standbyItems.length > 0) {
    y = checkPage(doc, y, 20, PH, PW, data.clientName, data.period, hB64, wB64);
    y = sectionTitle(doc, "5. Casos em Standby e em Notificação Extrajudicial", y, PW);
    y = sectionDesc(doc, "Os seguintes casos estão em standby ou em processo de notificação extrajudicial, após esgotamento das tentativas de contato direto:", y, PW);
    autoTable(doc, {
      startY: y, margin: { left: 10, right: 10 },
      head: [["Agressor", "Status", "Próxima Ação"]],
      body: data.standbyItems.map((i) => [i.agressor, i.status, i.nextAction]),
      styles: { font: F, fontSize: 8, cellPadding: 2.5, textColor: TEXT_DARK },
      headStyles: { fillColor: BRANDDI_DARK, textColor: WHITE, fontStyle: "bold" },
      alternateRowStyles: { fillColor: LIGHT_BG },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Seção 6 — Aprovação
  if (data.aprovacaoText.trim()) {
    y = checkPage(doc, y, 20, PH, PW, data.clientName, data.period, hB64, wB64);
    y = sectionTitle(doc, "6. Agressores Aguardando Aprovação", y, PW);
    y = sectionDesc(doc, "A lista abaixo inclui os agressores recém-identificados que aguardam aprovação para o início das tratativas.", y, PW);
    for (const line of data.aprovacaoText.split("\n").map((l) => l.trim()).filter(Boolean)) {
      y = checkPage(doc, y, 8, PH, PW, data.clientName, data.period, hB64, wB64);
      doc.setFont(F, "normal"); doc.setFontSize(8.5); doc.setTextColor(...TEXT_DARK);
      doc.text(`• ${line}`, 14, y); y += 5.5;
    }
    y += 3;
  }

  // Seção 7 — Resolvidos
  if (data.resolvidosText.trim()) {
    y = checkPage(doc, y, 20, PH, PW, data.clientName, data.period, hB64, wB64);
    y = sectionTitle(doc, "7. Agressores Resolvidos (Sucesso)", y, PW);
    y = sectionDesc(doc, "Os seguintes agressores tiveram suas atividades contidas com sucesso nos últimos dias:", y, PW);
    for (const line of data.resolvidosText.split("\n").map((l) => l.trim()).filter(Boolean)) {
      y = checkPage(doc, y, 8, PH, PW, data.clientName, data.period, hB64, wB64);
      doc.setFont(F, "normal"); doc.setFontSize(8.5); doc.setTextColor(...TEXT_DARK);
      doc.text(`• ${line}`, 14, y); y += 5.5;
    }
  }

  doc.save(`Relatorio_BB_${data.clientName.replace(/\s+/g, "_")}_${data.period.replace(/\s+/g, "_")}.pdf`);
}
