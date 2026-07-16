import type {
  CapturedPost,
  DiscoveredProfile,
  ProfileSample,
  ScanMode,
  ScanSession,
} from "../analysis/types";
import { getScanModeConfig } from "./modes";

export const ACTIVE_SESSION_KEY = "creatorTrustLens:activeSession";
export const CURRENT_COLLECTOR_VERSION = 3;

function canonicalPostUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/^\/reels\//, "/reel/");
  return url.href.endsWith("/") ? url.href : `${url.href}/`;
}

function postIdFromUrl(value: string): string | undefined {
  try {
    const segments = new URL(value).pathname.split("/").filter(Boolean);
    const typeIndex = segments.findIndex((segment) =>
      ["p", "reel", "reels"].includes(segment),
    );
    return typeIndex >= 0 ? segments[typeIndex + 1] : undefined;
  } catch {
    return undefined;
  }
}

function postKey(value: string): string {
  return postIdFromUrl(value) ?? canonicalPostUrl(value);
}

export function createScanSession(
  profile: DiscoveredProfile,
  mode: ScanMode = "standard",
): ScanSession {
  const timestamp = new Date().toISOString();
  const config = getScanModeConfig(mode);
  const postUrls = [...new Set(profile.postUrls.map(canonicalPostUrl))].slice(
    0,
    config.postLimit,
  );

  return {
    id: crypto.randomUUID(),
    collectorVersion: CURRENT_COLLECTOR_VERSION,
    handle: profile.handle,
    profileUrl: profile.profileUrl,
    followerCount: profile.followerCount,
    mode,
    postUrls,
    capturedPosts: [],
    skippedPostUrls: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function addCapturedPost(
  session: ScanSession,
  capturedPost: CapturedPost,
): ScanSession {
  const capturedPosts = session.capturedPosts.filter(
    (post) => post.id !== capturedPost.id,
  );

  return {
    ...session,
    capturedPosts: [...capturedPosts, capturedPost],
    skippedPostUrls: (session.skippedPostUrls ?? []).filter(
      (url) => postKey(url) !== capturedPost.id,
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function skipPost(session: ScanSession, url: string): ScanSession {
  const skippedPostUrls = session.skippedPostUrls ?? [];
  const key = postKey(url);

  return {
    ...session,
    skippedPostUrls: [
      ...skippedPostUrls.filter((skippedUrl) => postKey(skippedUrl) !== key),
      canonicalPostUrl(url),
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function getNextPostUrl(session: ScanSession): string | undefined {
  const completedKeys = new Set(
    session.capturedPosts.map((post) => post.id || postKey(post.url)),
  );
  for (const url of session.skippedPostUrls ?? []) {
    completedKeys.add(postKey(url));
  }
  return session.postUrls.find((url) => !completedKeys.has(postKey(url)));
}

export function isSessionPost(session: ScanSession, url?: string): boolean {
  if (!url) return false;
  try {
    const key = postKey(url);
    return session.postUrls.some((postUrl) => postKey(postUrl) === key);
  } catch {
    return false;
  }
}

export function isCapturedPost(session: ScanSession, url?: string): boolean {
  if (!url) return false;
  try {
    const key = postKey(url);
    return session.capturedPosts.some(
      (post) => post.id === key || postKey(post.url) === key,
    );
  } catch {
    return false;
  }
}

export function buildProfileSample(session: ScanSession): ProfileSample {
  return {
    handle: session.handle,
    scannedAt: new Date().toISOString(),
    followerCount: session.followerCount,
    posts: session.capturedPosts.map(({ comments: _comments, ...post }) => post),
    comments: session.capturedPosts.flatMap((post) =>
      post.comments.map((comment) => ({ ...comment, postId: post.id })),
    ),
  };
}
