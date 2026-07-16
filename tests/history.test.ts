import { describe, expect, it } from "vitest";
import {
  appendHistorySnapshot,
  profileHistoryKey,
} from "../lib/analysis/history";
import type { ProfileSample } from "../lib/analysis/types";

function sample(scannedAt: string): ProfileSample {
  return {
    handle: "Creator_Name",
    scannedAt,
    followerCount: 10_000,
    posts: [{ id: scannedAt, url: "https://www.instagram.com/p/test/" }],
    comments: [{ author: "viewer", text: "Useful", postId: scannedAt }],
  };
}

describe("profile analysis history", () => {
  it("uses a stable case-insensitive storage key", () => {
    expect(profileHistoryKey("Creator_Name")).toBe(
      "creatorTrustLens:history:creator_name",
    );
  });

  it("stores lightweight snapshots without comment text", () => {
    const history = appendHistorySnapshot([], sample("2026-01-01T00:00:00Z"));
    expect(history[0]).not.toHaveProperty("comments");
    expect(history[0]?.posts).toHaveLength(1);
  });

  it("keeps only the latest configured number of snapshots", () => {
    const history = Array.from({ length: 4 }, (_, index) =>
      sample(`2026-01-0${index + 1}T00:00:00Z`),
    ).reduce(
      (items, current) => appendHistorySnapshot(items, current, 3),
      [] as ReturnType<typeof appendHistorySnapshot>,
    );

    expect(history.map((item) => item.scannedAt)).toEqual([
      "2026-01-02T00:00:00Z",
      "2026-01-03T00:00:00Z",
      "2026-01-04T00:00:00Z",
    ]);
  });
});
