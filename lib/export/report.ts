import type { AnalysisResult, EvidenceItem } from "../analysis/types";

const COLORS = {
  background: [8, 8, 17] as const,
  surface: [22, 20, 38] as const,
  surfaceSoft: [31, 27, 49] as const,
  white: [248, 246, 255] as const,
  muted: [170, 166, 184] as const,
  purple: [169, 147, 255] as const,
  pink: [255, 55, 111] as const,
  border: [58, 52, 77] as const,
};

function reportFileName(result: AnalysisResult, extension: "pdf" | "xls") {
  const handle = result.handle.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  const date = result.scannedAt.slice(0, 10);
  return `creator-trust-lens-${handle}-${date}.${extension}`;
}

function confidenceText(result: AnalysisResult): string {
  return result.confidence === "insufficient"
    ? "Insufficient data"
    : `${result.confidence[0]?.toUpperCase()}${result.confidence.slice(1)} confidence`;
}

function reviewText(result: AnalysisResult): string {
  if (result.trustScore === undefined) return "More data required";
  if (result.trustScore >= 75) return "Lower observed risk";
  if (result.trustScore >= 50) return "Review recommended";
  return "Elevated signals";
}

function pdfSafeText(value: string): string {
  return value
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u200d\ufe0f]/g, "")
    .trim();
}

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlCell(
  value: unknown,
  style = "Text",
  type: "String" | "Number" = "String",
): string {
  return `<Cell ss:StyleID="${style}"><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`;
}

function evidenceRows(evidence: EvidenceItem[]): string {
  return evidence
    .map(
      (item) => `<Row>
        ${xmlCell(item.label, "Label")}
        ${xmlCell(item.value, "Accent")}
        ${xmlCell(item.score, "Number", "Number")}
        ${xmlCell(item.explanation, "Wrap")}
        ${xmlCell(item.examples.join(" | "), "Wrap")}
      </Row>`,
    )
    .join("");
}

export function buildAnalysisSpreadsheet(result: AnalysisResult): string {
  const score = result.trustScore ?? "Not calculated";
  const suspicion = result.suspicionScore ?? "Not calculated";

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Top"/><Font ss:FontName="Arial" ss:Size="10"/></Style>
  <Style ss:ID="Title"><Font ss:FontName="Arial" ss:Size="18" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#171426" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#7D4BFF" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>
  <Style ss:ID="Label"><Font ss:Bold="1" ss:Color="#3C344D"/></Style>
  <Style ss:ID="Accent"><Font ss:Bold="1" ss:Color="#E52F79"/></Style>
  <Style ss:ID="Number"><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="0"/></Style>
  <Style ss:ID="Text"/>
  <Style ss:ID="Wrap"><Alignment ss:WrapText="1" ss:Vertical="Top"/></Style>
  <Style ss:ID="Warning"><Font ss:Italic="1" ss:Color="#6F687D"/><Alignment ss:WrapText="1"/></Style>
 </Styles>
 <Worksheet ss:Name="Summary">
  <Table>
   <Column ss:Width="155"/><Column ss:Width="300"/>
   <Row ss:Height="30"><Cell ss:MergeAcross="1" ss:StyleID="Title"><Data ss:Type="String">Creator Trust Lens</Data></Cell></Row>
   <Row>${xmlCell("Creator", "Label")}${xmlCell(`@${result.handle}`)}</Row>
   <Row>${xmlCell("Trust score", "Label")}${xmlCell(score, "Accent", typeof score === "number" ? "Number" : "String")}</Row>
   <Row>${xmlCell("Suspicion score", "Label")}${xmlCell(suspicion, "Number", typeof suspicion === "number" ? "Number" : "String")}</Row>
   <Row>${xmlCell("Confidence", "Label")}${xmlCell(confidenceText(result))}</Row>
   <Row>${xmlCell("Review status", "Label")}${xmlCell(reviewText(result), "Accent")}</Row>
   <Row>${xmlCell("Posts scanned", "Label")}${xmlCell(result.postsScanned, "Number", "Number")}</Row>
   <Row>${xmlCell("Comments scanned", "Label")}${xmlCell(result.commentsScanned, "Number", "Number")}</Row>
   <Row>${xmlCell("Sample target coverage", "Label")}${xmlCell(result.sampleCoverage === undefined ? "Not available" : `${Math.round(result.sampleCoverage * 100)}%`)}</Row>
   <Row>${xmlCell("Earlier scans available", "Label")}${xmlCell(result.historySnapshots ?? 0, "Number", "Number")}</Row>
   <Row>${xmlCell("Scanned at", "Label")}${xmlCell(new Date(result.scannedAt).toLocaleString())}</Row>
   <Row ss:Height="44"><Cell ss:MergeAcross="1" ss:StyleID="Warning"><Data ss:Type="String">This analysis shows observable engagement signals from a limited public sample. It is not proof that engagement was purchased, automated, or fraudulent.</Data></Cell></Row>
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane></WorksheetOptions>
 </Worksheet>
 <Worksheet ss:Name="Evidence">
  <Table>
   <Column ss:Width="145"/><Column ss:Width="100"/><Column ss:Width="75"/><Column ss:Width="310"/><Column ss:Width="330"/>
   <Row ss:Height="24">${xmlCell("Signal", "Header")}${xmlCell("Observed value", "Header")}${xmlCell("Risk points", "Header")}${xmlCell("Explanation", "Header")}${xmlCell("Examples", "Header")}</Row>
   ${evidenceRows(result.evidence)}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane></WorksheetOptions>
 </Worksheet>
</Workbook>`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function exportAnalysisXls(result: AnalysisResult) {
  const spreadsheet = buildAnalysisSpreadsheet(result);
  downloadBlob(
    new Blob([spreadsheet], { type: "application/vnd.ms-excel;charset=utf-8" }),
    reportFileName(result, "xls"),
  );
}

export async function exportAnalysisPdf(result: AnalysisResult) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  const fillPage = () => {
    doc.setFillColor(...COLORS.background);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.setFillColor(...COLORS.pink);
    doc.rect(0, 0, pageWidth * 0.56, 2.2, "F");
    doc.setFillColor(...COLORS.purple);
    doc.rect(pageWidth * 0.56, 0, pageWidth * 0.44, 2.2, "F");
  };

  const compactHeader = () => {
    fillPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.white);
    doc.text("CREATOR TRUST LENS", margin, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(`@${pdfSafeText(result.handle)}  |  Evidence report`, pageWidth - margin, 13, {
      align: "right",
    });
    y = 23;
  };

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 18) return;
    doc.addPage();
    compactHeader();
  };

  const drawStat = (x: number, label: string, value: string) => {
    doc.setFillColor(...COLORS.surfaceSoft);
    doc.roundedRect(x, y, 55, 19, 3, 3, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(label.toUpperCase(), x + 5, y + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.white);
    doc.text(value, x + 5, y + 14.5);
  };

  const drawEvidence = (item: EvidenceItem) => {
    const explanationLines = doc.splitTextToSize(
      pdfSafeText(item.explanation),
      contentWidth - 28,
    ) as string[];
    const examples = item.examples
      .map(pdfSafeText)
      .filter(Boolean)
      .slice(0, 3);
    const height = 25 + explanationLines.length * 4 + examples.length * 5;
    ensureSpace(height + 5);

    doc.setFillColor(...COLORS.surface);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(margin, y, contentWidth, height, 4, 4, "FD");
    doc.setFillColor(...COLORS.pink);
    doc.roundedRect(margin + 5, y + 5, 22, 12, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.white);
    doc.text(pdfSafeText(item.value), margin + 16, y + 13, { align: "center" });
    doc.setFontSize(11);
    doc.text(pdfSafeText(item.label), margin + 33, y + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.purple);
    doc.text(`${Math.round(item.score)} risk points`, pageWidth - margin - 6, y + 11, {
      align: "right",
    });
    doc.setTextColor(...COLORS.muted);
    doc.text(explanationLines, margin + 33, y + 16);

    let exampleY = y + 21 + explanationLines.length * 4;
    for (const example of examples) {
      doc.setFillColor(...COLORS.surfaceSoft);
      doc.circle(margin + 8, exampleY - 1, 1, "F");
      doc.setTextColor(...COLORS.muted);
      doc.text(doc.splitTextToSize(example, contentWidth - 18) as string[], margin + 12, exampleY);
      exampleY += 5;
    }
    y += height + 5;
  };

  fillPage();
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.purple);
  doc.setFontSize(8);
  doc.text("ENGAGEMENT DUE DILIGENCE", margin, 17);
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(24);
  doc.text("Creator Trust Report", margin, 29);
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.muted);
  doc.text(`@${pdfSafeText(result.handle)}`, margin, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(new Date(result.scannedAt).toLocaleString(), pageWidth - margin, 18, {
    align: "right",
  });

  doc.setFillColor(...COLORS.surface);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(margin, 48, contentWidth, 65, 6, 6, "FD");
  doc.setDrawColor(...COLORS.pink);
  doc.setLineWidth(2.4);
  doc.circle(50, 80, 22, "S");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(result.trustScore === undefined ? 22 : 29);
  doc.text(result.trustScore?.toString() ?? "N/A", 50, 83, { align: "center" });
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.pink);
  doc.text("TRUST SCORE", 50, 91, { align: "center" });

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(16);
  doc.text(reviewText(result), 83, 69);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.purple);
  doc.text(confidenceText(result), 83, 78);
  doc.setTextColor(...COLORS.muted);
  const overview = doc.splitTextToSize(
    "The score combines comment quality, audience breadth, age-normalized post engagement, format-aware comparisons, sample completeness, and available local history.",
    100,
  ) as string[];
  doc.text(overview, 83, 87);

  y = 121;
  drawStat(margin, "Posts scanned", String(result.postsScanned));
  drawStat(margin + 61, "Comments scanned", String(result.commentsScanned));
  drawStat(margin + 122, "Confidence", result.confidence.toUpperCase());
  y += 27;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.white);
  doc.text("Evidence behind the score", margin, y);
  y += 8;
  for (const item of result.evidence) drawEvidence(item);

  ensureSpace(40);
  doc.setFillColor(...COLORS.surfaceSoft);
  doc.roundedRect(margin, y, contentWidth, 31, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.purple);
  doc.text("IMPORTANT CONTEXT", margin + 6, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    doc.splitTextToSize(
      "This analysis shows observable engagement signals from a limited public sample. It is not proof that engagement was purchased, automated, or fraudulent. Use it as one input in creator due diligence.",
      contentWidth - 12,
    ) as string[],
    margin + 6,
    y + 17,
  );

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text("Creator Trust Lens  |  Evidence, not accusations", margin, 290);
    doc.text(`${page} / ${pages}`, pageWidth - margin, 290, { align: "right" });
  }

  doc.save(reportFileName(result, "pdf"));
}
