import { describe, expect, it } from "vitest";
import {
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
