import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "../lib/analysis/types";
import { buildAnalysisSpreadsheet } from "../lib/export/report";

const result: AnalysisResult = {
  handle: "creator&studio",
  trustScore: 72,
  suspicionScore: 28,
  confidence: "medium",
  postsScanned: 6,
  commentsScanned: 180,
  scannedAt: "2026-07-16T09:00:00.000Z",
  evidence: [
    {
      id: "duplicates",
      label: "Repeated comments",
      value: "12",
      score: 24,
      explanation: "Different accounts used <matching> text.",
      examples: ["Amazing & useful"],
    },
  ],
};

describe("analysis spreadsheet export", () => {
  it("creates separate summary and evidence worksheets", () => {
    const workbook = buildAnalysisSpreadsheet(result);
    expect(workbook).toContain('Worksheet ss:Name="Summary"');
    expect(workbook).toContain('Worksheet ss:Name="Evidence"');
  });

  it("escapes creator and evidence text for valid XML", () => {
    const workbook = buildAnalysisSpreadsheet(result);
    expect(workbook).toContain("@creator&amp;studio");
    expect(workbook).toContain("&lt;matching&gt;");
    expect(workbook).toContain("Amazing &amp; useful");
  });
});
