import { describe, expect, it } from "vitest";
import { analyzeProfile } from "../lib/analysis/analyze";
import type { ProfileSample } from "../lib/analysis/types";

function sample(overrides: Partial<ProfileSample> = {}): ProfileSample {
  return {
    handle: "test_creator",
    scannedAt: "2026-07-15T12:00:00.000Z",
    followerCount: 10_000,
    posts: Array.from({ length: 6 }, (_, index) => ({
      id: `post-${index}`,
      url: `https://www.instagram.com/p/${index}`,
      likes: 500 + index * 10,
      commentCount: 20,
    })),
    comments: Array.from({ length: 90 }, (_, index) => ({
      author: `person-${index}`,
      text: `A specific question number ${index}`,
      postId: `post-${index % 6}`,
    })),
    ...overrides,
  };
}

describe("profile analysis", () => {
  it("reports medium confidence for a useful sample", () => {
    const result = analyzeProfile(sample());
    expect(result.confidence).toBe("medium");
    expect(result.trustScore).toBeDefined();
  });

  it("withholds the score when there is insufficient data", () => {
    const result = analyzeProfile(sample({ posts: [], comments: [] }));
    expect(result.confidence).toBe("insufficient");
    expect(result.trustScore).toBeUndefined();
  });

  it("raises evidence scores for repeated generic comments", () => {
    const comments = Array.from({ length: 90 }, (_, index) => ({
      author: `bot-${index}`,
      text: "Amazing content 🔥",
      postId: `post-${index % 6}`,
    }));
    const result = analyzeProfile(sample({ comments }));
    const duplicates = result.evidence.find((item) => item.id === "duplicates");
    const generic = result.evidence.find((item) => item.id === "generic");

    expect(duplicates?.score).toBeGreaterThan(50);
    expect(generic?.score).toBeGreaterThan(50);
  });

  it("flags a sample dominated by very few commenters", () => {
    const comments = Array.from({ length: 90 }, (_, index) => ({
      author: `frequent-${index % 5}`,
      text: `A distinct comment number ${index}`,
      postId: `post-${index % 6}`,
    }));
    const result = analyzeProfile(sample({ comments }));
    const diversity = result.evidence.find((item) => item.id === "diversity");

    expect(diversity?.score).toBeGreaterThan(80);
    expect(diversity?.value).toBe("6% unique");
    expect(diversity?.examples).not.toHaveLength(0);
  });
});
