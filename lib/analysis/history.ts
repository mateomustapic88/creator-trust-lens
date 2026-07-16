import type {
  ProfileHistorySnapshot,
  ProfileSample,
} from "./types";

export const PROFILE_HISTORY_PREFIX = "creatorTrustLens:history:";
export const MAX_PROFILE_HISTORY_SNAPSHOTS = 12;

export function profileHistoryKey(handle: string): string {
  return `${PROFILE_HISTORY_PREFIX}${handle.toLocaleLowerCase()}`;
}

export function toHistorySnapshot(
  sample: ProfileSample,
): ProfileHistorySnapshot {
  return {
    handle: sample.handle,
    scannedAt: sample.scannedAt,
    followerCount: sample.followerCount,
    posts: sample.posts.map((post) => ({ ...post })),
  };
}

export function appendHistorySnapshot(
  history: ProfileHistorySnapshot[],
  sample: ProfileSample,
  limit = MAX_PROFILE_HISTORY_SNAPSHOTS,
): ProfileHistorySnapshot[] {
  const snapshot = toHistorySnapshot(sample);
  const unique = new Map(
    history.map((item) => [item.scannedAt, item] as const),
  );
  unique.set(snapshot.scannedAt, snapshot);

  return [...unique.values()]
    .sort(
      (left, right) => Date.parse(left.scannedAt) - Date.parse(right.scannedAt),
    )
    .slice(-Math.max(1, limit));
}
