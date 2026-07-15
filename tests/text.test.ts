import { describe, expect, it } from "vitest";
import {
  isEmojiOnly,
  isGenericComment,
  jaccardSimilarity,
  normalizeComment,
} from "../lib/analysis/text";

describe("comment text analysis", () => {
  it("normalizes mentions, hashtags, punctuation, and emoji", () => {
    expect(normalizeComment("  Amazing, @creator! 🔥 #travel ")).toBe("amazing");
  });

  it("detects emoji-only comments", () => {
    expect(isEmojiOnly("🔥🔥 ❤️")).toBe(true);
    expect(isEmojiOnly("Love 🔥")).toBe(false);
  });

  it("detects transparent generic phrases", () => {
    expect(isGenericComment("Nice post! 🔥")).toBe(true);
    expect(isGenericComment("Which hotel is this?")).toBe(false);
  });

  it("finds near-identical comments", () => {
    expect(jaccardSimilarity("Beautiful travel content", "Beautiful travel content! 🔥")).toBe(1);
  });
});
