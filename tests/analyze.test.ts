import { describe, expect, it } from "vitest";
import { analyzeProfile } from "../lib/analysis/analyze";
import type {
  ProfileHistorySnapshot,
  ProfileSample,
} from "../lib/analysis/types";

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

  it("allows a partial multi-post scan with low confidence", () => {
    const partial = sample({
      posts: sample().posts.slice(0, 4),
      comments: sample().comments.slice(0, 61),
    });
    const result = analyzeProfile(partial);

    expect(result.postsScanned).toBe(4);
    expect(result.commentsScanned).toBe(61);
    expect(result.confidence).toBe("low");
    expect(result.trustScore).toBeDefined();
    expect(result.trustScore).toBeLessThanOrEqual(80);
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

  it("reports the typical engagement rate from visible post totals", () => {
    const result = analyzeProfile(sample());
    const engagement = result.evidence.find(
      (item) => item.id === "engagement_rate",
    );

    expect(engagement?.value).toBe("5.5%");
    expect(engagement?.score).toBe(0);
  });

  it("flags extremely low typical engagement conservatively", () => {
    const posts = sample().posts.map((post) => ({
      ...post,
      likes: 5,
      commentCount: 1,
    }));
    const result = analyzeProfile(sample({ posts }));
    const engagement = result.evidence.find(
      (item) => item.id === "engagement_rate",
    );

    expect(engagement?.score).toBeGreaterThan(40);
  });

  it("checks whether visible comments are disproportionate to likes", () => {
    const posts = sample().posts.map((post) => ({
      ...post,
      likes: 100,
      commentCount: 40,
    }));
    const result = analyzeProfile(sample({ posts }));
    const balance = result.evidence.find(
      (item) => item.id === "comment_like_ratio",
    );

    expect(balance?.value).toBe("40.0%");
    expect(balance?.score).toBeGreaterThan(80);
  });

  it("does not let unavailable post metrics lower the suspicion score", () => {
    const suspiciousComments = Array.from({ length: 90 }, (_, index) => ({
      author: `bot-${index}`,
      text: "Amazing content 🔥",
      postId: `post-${index % 6}`,
    }));
    const withoutMetrics = sample({
      comments: suspiciousComments,
      followerCount: undefined,
      posts: sample().posts.map(({ likes: _likes, commentCount: _comments, ...post }) => post),
    });

    const result = analyzeProfile(withoutMetrics);
    expect(result.evidence.find((item) => item.id === "engagement_rate")?.value).toBe("N/A");
    expect(result.suspicionScore).toBeGreaterThan(40);
  });

  it("reduces confidence when less than half of collection targets were captured", () => {
    const posts = sample().posts.map((post) => ({ ...post, sampleTarget: 100 }));
    const result = analyzeProfile(sample({ posts }));
    const coverage = result.evidence.find(
      (item) => item.id === "sample_coverage",
    );

    expect(coverage?.value).toBe("15.0%");
    expect(coverage?.score).toBe(0);
    expect(result.confidence).toBe("low");
  });

  it("excludes fresh posts from settled engagement spike checks", () => {
    const posts = [
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `old-${index}`,
        url: `https://www.instagram.com/p/old-${index}/`,
        likes: 100,
        commentCount: 10,
        mediaType: "post" as const,
        publishedAt: "2026-07-01T12:00:00.000Z",
      })),
      {
        id: "fresh-spike",
        url: "https://www.instagram.com/p/fresh-spike/",
        likes: 50_000,
        commentCount: 1_000,
        mediaType: "post" as const,
        publishedAt: "2026-07-15T11:00:00.000Z",
      },
    ];
    const result = analyzeProfile(sample({ posts }));
    const anomalies = result.evidence.find((item) => item.id === "anomalies");

    expect(anomalies?.value).toBe("0");
    expect(anomalies?.explanation).toContain("1 fresh post was excluded");
  });

  it("compares engagement variation within media formats", () => {
    const posts = [
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `post-${index}`,
        url: `https://www.instagram.com/p/${index}/`,
        likes: 100,
        commentCount: 10,
        mediaType: "post" as const,
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `reel-${index}`,
        url: `https://www.instagram.com/reel/${index}/`,
        likes: 1_000,
        commentCount: 100,
        mediaType: "reel" as const,
      })),
    ];
    const result = analyzeProfile(sample({ posts }));

    expect(result.evidence.find((item) => item.id === "anomalies")?.value).toBe("0");
  });

  it("flags follower growth that is not matched by engagement growth", () => {
    const baseline: ProfileHistorySnapshot = {
      handle: "test_creator",
      scannedAt: "2026-07-01T12:00:00.000Z",
      followerCount: 10_000,
      posts: sample().posts,
    };
    const result = analyzeProfile(
      sample({ followerCount: 12_000 }),
      [baseline],
    );
    const alignment = result.evidence.find(
      (item) => item.id === "growth_alignment",
    );

    expect(alignment?.value).toBe("20.0%");
    expect(alignment?.score).toBeGreaterThan(40);
  });

  it("finds an unusual interaction increase on the same historical post", () => {
    const baselinePosts = Array.from({ length: 4 }, (_, index) => ({
      id: `post-${index}`,
      url: `https://www.instagram.com/p/${index}/`,
      likes: 100,
      commentCount: 10,
    }));
    const currentPosts = baselinePosts.map((post, index) => ({
      ...post,
      likes: index === 3 ? 500 : 115,
    }));
    const baseline: ProfileHistorySnapshot = {
      handle: "test_creator",
      scannedAt: "2026-07-13T12:00:00.000Z",
      followerCount: 10_000,
      posts: baselinePosts,
    };
    const result = analyzeProfile(sample({ posts: currentPosts }), [baseline]);

    expect(
      result.evidence.find((item) => item.id === "historical_spikes")?.value,
    ).toBe("1");
  });
});
