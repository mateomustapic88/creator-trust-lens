import { describe, expect, it } from "vitest";
import {
  getCommentSampleTarget,
  getNextCommentScrollTop,
  isLoadMoreCommentsLabel,
  parseInstagramPostId,
} from "../lib/platforms/instagram";

describe("Instagram post URL parsing", () => {
  it.each([
    ["https://www.instagram.com/p/ABC123/", "ABC123"],
    ["https://www.instagram.com/reel/REEL456/?utm_source=test", "REEL456"],
    ["/reels/REEL789/", "REEL789"],
    ["/creator/p/NESTED123/", "NESTED123"],
  ])("reads a post id from %s", (url, expected) => {
    expect(parseInstagramPostId(url)).toBe(expected);
  });

  it("does not treat a profile as a post", () => {
    expect(parseInstagramPostId("https://www.instagram.com/example_creator/"))
      .toBeUndefined();
  });
});

describe("comment sample targets", () => {
  it("requires the selected mode limit when enough comments exist", () => {
    expect(getCommentSampleTarget(150, 2_000)).toBe(150);
  });

  it("uses all available comments when a post has fewer than the mode limit", () => {
    expect(getCommentSampleTarget(150, 66)).toBe(66);
  });

  it("requires the selected limit when Instagram does not expose a total", () => {
    expect(getCommentSampleTarget(150)).toBe(150);
  });
});

describe("virtual comment list scrolling", () => {
  it("moves through a long list in measured viewport steps", () => {
    expect(getNextCommentScrollTop(0, 600, 5_000)).toBe(450);
    expect(getNextCommentScrollTop(450, 600, 5_000)).toBe(900);
  });

  it("stops exactly at the current scroll boundary", () => {
    expect(getNextCommentScrollTop(4_200, 600, 5_000)).toBe(4_400);
    expect(getNextCommentScrollTop(4_400, 600, 5_000)).toBe(4_400);
  });
});

describe("Instagram comment loading controls", () => {
  it.each([
    "Load more comments",
    "View all 1,234 comments",
    "View previous comments",
  ])("recognizes %s", (label) => {
    expect(isLoadMoreCommentsLabel(label)).toBe(true);
  });

  it.each(["View replies", "Add a comment", "Follow"])(
    "ignores unrelated control %s",
    (label) => {
      expect(isLoadMoreCommentsLabel(label)).toBe(false);
    },
  );
});
