import { describe, expect, it } from "vitest";
import type { CapturedPost, DiscoveredProfile } from "../lib/analysis/types";
import {
  addCapturedPost,
  buildProfileSample,
  createScanSession,
  getNextPostUrl,
  isCapturedPost,
  isSessionPost,
} from "../lib/scanning/session";

const profile: DiscoveredProfile = {
  handle: "creator",
  profileUrl: "https://www.instagram.com/creator/",
  followerCount: 12_000,
  postUrls: [
    "https://www.instagram.com/p/one/",
    "https://www.instagram.com/p/two/?utm_source=test",
  ],
};

const capture: CapturedPost = {
  id: "one",
  url: "https://www.instagram.com/p/one/",
  likes: 300,
  commentCount: 2,
  comments: [
    { author: "person-a", text: "Where is this?", postId: "one" },
    { author: "person-b", text: "Beautiful", postId: "one" },
  ],
};

describe("guided scan session", () => {
  it("creates a bounded, canonical queue", () => {
    const session = createScanSession(profile);
    expect(session.postUrls).toEqual([
      "https://www.instagram.com/p/one/",
      "https://www.instagram.com/p/two/",
    ]);
  });

  it.each([
    ["quick", 5],
    ["standard", 8],
    ["deep", 12],
  ] as const)("limits a %s scan to %i posts", (mode, expected) => {
    const expandedProfile = {
      ...profile,
      postUrls: Array.from(
        { length: 15 },
        (_, index) => `https://www.instagram.com/p/${index}/`,
      ),
    };

    const session = createScanSession(expandedProfile, mode);
    expect(session.mode).toBe(mode);
    expect(session.postUrls).toHaveLength(expected);
  });

  it("advances after a post is captured", () => {
    const session = addCapturedPost(createScanSession(profile), capture);
    expect(getNextPostUrl(session)).toBe("https://www.instagram.com/p/two/");
    expect(isSessionPost(session, capture.url)).toBe(true);
    expect(isCapturedPost(session, capture.url)).toBe(true);
    expect(isCapturedPost(session, "https://www.instagram.com/p/two/")).toBe(false);
  });

  it("replaces duplicate captures rather than inflating the sample", () => {
    const once = addCapturedPost(createScanSession(profile), capture);
    const twice = addCapturedPost(once, { ...capture, likes: 350 });
    expect(twice.capturedPosts).toHaveLength(1);
    expect(twice.capturedPosts[0]?.likes).toBe(350);
  });

  it("builds one combined analysis sample", () => {
    const session = addCapturedPost(createScanSession(profile), capture);
    const sample = buildProfileSample(session);
    expect(sample.handle).toBe("creator");
    expect(sample.posts).toHaveLength(1);
    expect(sample.comments).toHaveLength(2);
    expect(sample.comments.every((comment) => comment.postId === "one")).toBe(true);
  });
});
