import { describe, expect, it } from "vitest";
import {
  getCommentSampleTarget,
  isGifOnlyComment,
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

describe("GIF comment filtering", () => {
  it.each(["GIF", "gif", "Animated GIF", "GIPHY"])(
    "ignores the GIF-only placeholder %s",
    (text) => {
      expect(isGifOnlyComment(text)).toBe(true);
    },
  );

  it("ignores an animated media row without meaningful text", () => {
    expect(isGifOnlyComment(undefined, ["Animated image", "GIF"])).toBe(true);
  });

  it("keeps a normal written comment that mentions a GIF", () => {
    expect(isGifOnlyComment("That GIF made me laugh")).toBe(false);
  });

  it("does not treat a regular profile image as a GIF", () => {
    expect(
      isGifOnlyComment("Great post", ["Alex's profile picture"]),
    ).toBe(false);
  });
});
