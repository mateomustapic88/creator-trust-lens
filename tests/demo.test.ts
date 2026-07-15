import { describe, expect, it } from "vitest";
import { analyzeProfile } from "../lib/analysis/analyze";
import { createDemoProfileSample } from "../lib/demo/sample";

describe("sample report", () => {
  it("provides a useful, evidence-rich demo sample", () => {
    const sample = createDemoProfileSample();
    const result = analyzeProfile(sample);

    expect(sample.posts).toHaveLength(6);
    expect(sample.comments).toHaveLength(96);
    expect(result.confidence).toBe("medium");
    expect(result.trustScore).toBeGreaterThan(0);
    expect(result.trustScore).toBeLessThan(100);
    expect(result.evidence.find((item) => item.id === "duplicates")?.examples)
      .not.toHaveLength(0);
    expect(result.evidence.find((item) => item.id === "recurring")?.examples)
      .not.toHaveLength(0);
  });
});
