import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Metrics {
  identificados: string;
  inativos: string;
  ocorrencias: string;
  notificados: string;
  eliminados: string;
  notificacoesEnviadas: string;
}

interface HeatmapEntry {
  nome: string;
  score: string;
}

interface ContentionAction {
  domain: string;
  status: string;
}

interface StandbyCase {
  agressor: string;
  status: string;
  nextAction: string;
}

export interface GenerateBbPdfParams {
  clientName: string;
  reportType: "Semanal" | "Quinzenal";
  periodDays: string;
  periodLabel: string;
  metrics: Metrics;
  agressoresAnalysis: string;
  heatmapAnalysis: string;
  heatmap: HeatmapEntry[];
  contentionActions: ContentionAction[];
  standbyCases: StandbyCase[];
  awaitingApproval: string;
  resolved: string;
  imageAgressores: File | null;
  imageHeatmap: File | null;
}

const BRANDDI_DARK: [number, number, number] = [13, 51, 73]; // #0d3349
const BRANDDI_TEXT: [number, number, number] = [30, 30, 30];
const MUTED: [number, number, number] = [110, 110, 110];

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Carrega as imagens de branding (header e watermark) do diretório /public
async function loadBrandingAsset(path: string): Promise<string | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateBbPdf(params: GenerateBbPdfParams): Promise<void> {
  const {
    clientName,
    reportType,
    periodDays,
    periodLabel,
    metrics,
    agressoresAnalysis,
    heatmapAnalysis,
    heatmap,
    contentionActions,
    standbyCases,
    awaitingApproval,
    resolved,
    imageAgressores,
    imageHeatmap,
  } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;

  // Carrega ambas as imagens de branding em paralelo
  const [headerImg, watermarkImg] = await Promise.all([
    loadBrandingAsset("/branding/header-bg.png"),
    loadBrandingAsset("/branding/logo-watermark.png"),
  ]);

  const HEADER_HEIGHT = 32; // altura do header azul em mm
  const CONTENT_TOP = HEADER_HEIGHT + 12; // primeira linha de conteúdo após header
  const CONTENT_BOTTOM = pageHeight - 18; // limite antes do footer

  let y = 0;
  let isFirstPage = true;

  // Desenha header + watermark em página atual
  function drawPageChrome() {
    // Header azul com logo Branddi (imagem se disponível, senão retângulo sólido)
    if (headerImg) {
      doc.addImage(headerImg, "PNG", 0, 0, pageWidth, HEADER_HEIGHT);
    } else {
      doc.setFillColor(...BRANDDI_DARK);
      doc.rect(0, 0, pageWidth, HEADER_HEIGHT, "F");
    }

    // Marca d'água no canto inferior direito (logo Branddi grande, levemente translúcida)
    if (watermarkImg) {
      const wmSize = 70; // tamanho em mm
      const wmX = pageWidth - wmSize + 5; // levemente cortada na borda direita
      const wmY = pageHeight - wmSize - 10;
      // jsPDF não tem opacity nativa fácil; usamos GState pra aplicar transparência
      try {
        // @ts-ignore - GState exists at runtime mas tipos podem variar
        const gstate = new doc.GState({ opacity: 0.12 });
        // @ts-ignore - setGState exists at runtime
        doc.setGState(gstate);
        doc.addImage(watermarkImg, "PNG", wmX, wmY, wmSize, wmSize);
        // @ts-ignore - reset opacity
        doc.setGState(new doc.GState({ opacity: 1 }));
      } catch {
        // Fallback: adiciona sem transparência (caso GState não esteja disponível)
        doc.addImage(watermarkImg, "PNG", wmX, wmY, wmSize, wmSize);
      }
    }
  }

  function newPage() {
    doc.addPage();
    drawPageChrome();
    y = CONTENT_TOP;
  }

  function ensureSpace(needed: number) {
    if (y + needed > CONTENT_BOTTOM) {
      newPage();
    }
  }

  function addParagraph(text: string, fontSize = 10, color = BRANDDI_TEXT) {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
    ensureSpace(lines.length * (fontSize * 0.45) + 2);
    doc.text(lines, margin, y);
    y += lines.length * (fontSize * 0.45) + 3;
  }

  function addSectionTitle(text: string) {
    ensureSpace(12);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRANDDI_DARK);
    doc.text(text, margin, y);
    y += 7;
  }

  function addExplanation(text: string) {
    addParagraph(text, 9, MUTED);
  }

  // ─── Página 1: header + título ───
  drawPageChrome();
  isFirstPage = false;

  // Título do relatório centralizado abaixo do header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRANDDI_DARK);
  const titulo = `Relatório ${reportType} de Brand Bidding`;
  doc.text(titulo, pageWidth / 2, HEADER_HEIGHT + 14, { align: "center" });

  y = HEADER_HEIGHT + 22;

  // Cliente e período em linha discreta
  if (clientName || periodLabel) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    const subline = [clientName, periodLabel ? `Período: ${periodLabel}` : null]
      .filter(Boolean)
      .join("  ·  ");
    doc.text(subline, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  y += 4;

  // ─── Introdução fixa ───
  addParagraph(
    "Este documento apresenta a consolidação " +
      (reportType === "Semanal" ? "semanal" : "quinzenal") +
      " dos resultados e o status das ações de monitoramento e contenção de Brand Bidding, garantindo a proteção da sua marca nos canais de busca.",
    10
  );
  y += 3;

  // ─── 1. Métricas Consolidadas ───
  addSectionTitle("1. Métricas Consolidadas (Todo o período)");
  addExplanation("A tabela a seguir resume os principais indicadores de Brand Bidding.");

  autoTable(doc, {
    startY: y,
    head: [["Identificados", "Inativos", "Ocorrências", "Notificados", "Eliminados", "Notif. Enviadas"]],
    body: [
      [
        metrics.identificados || "—",
        metrics.inativos || "—",
        metrics.ocorrencias || "—",
        metrics.notificados || "—",
        metrics.eliminados || "—",
        metrics.notificacoesEnviadas || "—",
      ],
    ],
    headStyles: { fillColor: BRANDDI_DARK, textColor: 255, halign: "center", fontSize: 9 },
    bodyStyles: { halign: "center", fontStyle: "bold", fontSize: 11 },
    theme: "grid",
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      // Quando autoTable quebra página, ele dispara essa callback — re-desenha o chrome
      if (!isFirstPage) drawPageChrome();
    },
  });
  // @ts-expect-error - lastAutoTable adicionado dinamicamente
  y = doc.lastAutoTable.finalY + 8;

  // ─── 2. Agressores Identificados ───
  ensureSpace(15);
  addSectionTitle("2. Agressores Identificados");

  if (agressoresAnalysis) {
    addParagraph(agressoresAnalysis);
  }

  if (imageAgressores) {
    try {
      const dataUrl = await fileToDataUrl(imageAgressores);
      const imgWidth = pageWidth - 2 * margin;
      const imgHeight = 65;
      ensureSpace(imgHeight + 4);
      doc.addImage(dataUrl, "PNG", margin, y, imgWidth, imgHeight);
      y += imgHeight + 6;
    } catch (e) {
      console.warn("Erro ao adicionar imagem de agressores:", e);
    }
  }

  // ─── 3. Análise de Ofensores (Heatmap) ───
  ensureSpace(15);
  addSectionTitle("3. Análise de Ofensores (Heatmap)");

  if (heatmapAnalysis) {
    addParagraph(heatmapAnalysis);
  }

  if (imageHeatmap) {
    try {
      const dataUrl = await fileToDataUrl(imageHeatmap);
      const imgWidth = pageWidth - 2 * margin;
      const imgHeight = 65;
      ensureSpace(imgHeight + 4);
      doc.addImage(dataUrl, "PNG", margin, y, imgWidth, imgHeight);
      y += imgHeight + 6;
    } catch (e) {
      console.warn("Erro ao adicionar imagem do heatmap:", e);
    }
  }

  if (heatmap.length > 0) {
    ensureSpace(10);
    autoTable(doc, {
      startY: y,
      head: [["Score", "Domínio"]],
      body: heatmap.map((h) => [h.score, h.nome]),
      headStyles: { fillColor: BRANDDI_DARK, textColor: 255, fontSize: 9 },
      theme: "striped",
      margin: { left: margin, right: margin },
      didDrawPage: () => {
        if (!isFirstPage) drawPageChrome();
      },
    });
    // @ts-expect-error - lastAutoTable adicionado dinamicamente
    y = doc.lastAutoTable.finalY + 8;
  }

  // ─── 4. Status das Ações de Contenção ───
  const validActions = contentionActions.filter((a) => a.domain.trim());
  if (validActions.length > 0) {
    ensureSpace(20);
    addSectionTitle("4. Status das Ações de Contenção");
    addExplanation("Detalhe do andamento das principais tratativas com agressores:");

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRANDDI_TEXT);
    validActions.forEach((a) => {
      const lines = doc.splitTextToSize(
        `${a.domain}: ${a.status}`,
        pageWidth - 2 * margin - 8
      );
      ensureSpace(lines.length * 5 + 2);
      doc.text("•", margin + 2, y);
      // Domínio em negrito
      doc.setFont("helvetica", "bold");
      const domainW = doc.getTextWidth(`${a.domain}:`);
      doc.text(`${a.domain}:`, margin + 7, y);
      // Status em normal
      doc.setFont("helvetica", "normal");
      const statusLines = doc.splitTextToSize(
        ` ${a.status}`,
        pageWidth - 2 * margin - 8 - domainW
      );
      doc.text(statusLines[0], margin + 7 + domainW, y);
      y += 5;
      // Continuação do status nas próximas linhas (sem o domínio)
      if (statusLines.length > 1) {
        for (let i = 1; i < statusLines.length; i++) {
          ensureSpace(5);
          doc.text(statusLines[i].trim(), margin + 7, y);
          y += 5;
        }
      }
    });
    y += 4;
  }

  // ─── 5. Casos em Standby e em Notificação Extrajudicial ───
  // (vem ANTES de Aprovação e Resolvidos, como no modelo)
  const validStandby = standbyCases.filter((c) => c.agressor.trim());
  if (validStandby.length > 0) {
    ensureSpace(20);
    addSectionTitle("5. Casos em Standby e em Notificação Extrajudicial");
    addExplanation(
      "Os seguintes casos estão em standby ou em processo de notificação extrajudicial, após esgotamento das tentativas de contato direto:"
    );
    autoTable(doc, {
      startY: y,
      head: [["Agressor", "Status", "Próxima Ação"]],
      body: validStandby.map((c) => [c.agressor, c.status, c.nextAction]),
      headStyles: { fillColor: BRANDDI_DARK, textColor: 255, fontSize: 9 },
      theme: "striped",
      margin: { left: margin, right: margin },
      didDrawPage: () => {
        if (!isFirstPage) drawPageChrome();
      },
    });
    // @ts-expect-error - lastAutoTable adicionado dinamicamente
    y = doc.lastAutoTable.finalY + 8;
  }

  // ─── 6. Agressores Aguardando Aprovação ───
  const approvalList = awaitingApproval
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (approvalList.length > 0) {
    ensureSpace(20);
    addSectionTitle("6. Agressores Aguardando Aprovação");
    addExplanation(
      "A lista abaixo inclui os agressores recém-identificados que aguardam aprovação para o início das tratativas."
    );
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRANDDI_TEXT);
    approvalList.forEach((d) => {
      ensureSpace(5);
      doc.text(`•  ${d}`, margin + 2, y);
      y += 5;
    });
    y += 4;
  }

  // ─── 7. Agressores Resolvidos (Sucesso) ───
  // (último, conforme o modelo)
  const resolvedList = resolved
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (resolvedList.length > 0) {
    ensureSpace(20);
    addSectionTitle("7. Agressores Resolvidos (Sucesso)");
    addExplanation(
      "Os seguintes agressores tiveram suas atividades contidas com sucesso nos últimos dias:"
    );
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRANDDI_TEXT);
    resolvedList.forEach((d) => {
      ensureSpace(5);
      doc.text(`•  ${d}`, margin + 2, y);
      y += 5;
    });
  }

  // ─── Salvar ───
  const safeName = (clientName || "cliente").toLowerCase().replace(/\s+/g, "-");
  const fileName = `relatorio-brand-bidding-${safeName}-${Date.now()}.pdf`;
  doc.save(fileName);
}

export type { Metrics, HeatmapEntry, ContentionAction, StandbyCase };
