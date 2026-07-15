import type {
  CapturedPost,
  DiscoveredProfile,
  ProfileSample,
  ScanMode,
  ScanSession,
} from "../analysis/types";
import { getScanModeConfig } from "./modes";

export const ACTIVE_SESSION_KEY = "creatorTrustLens:activeSession";

function canonicalPostUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.href.endsWith("/") ? url.href : `${url.href}/`;
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
    handle: profile.handle,
    profileUrl: profile.profileUrl,
    followerCount: profile.followerCount,
    mode,
    postUrls,
    capturedPosts: [],
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
    updatedAt: new Date().toISOString(),
  };
}

export function getNextPostUrl(session: ScanSession): string | undefined {
  const capturedUrls = new Set(
    session.capturedPosts.map((post) => canonicalPostUrl(post.url)),
  );
  return session.postUrls.find((url) => !capturedUrls.has(canonicalPostUrl(url)));
}

export function isSessionPost(session: ScanSession, url?: string): boolean {
  if (!url) return false;
  try {
    const canonical = canonicalPostUrl(url);
    return session.postUrls.some((postUrl) => canonicalPostUrl(postUrl) === canonical);
  } catch {
    return false;
  }
}

export function isCapturedPost(session: ScanSession, url?: string): boolean {
  if (!url) return false;
  try {
    const canonical = canonicalPostUrl(url);
    return session.capturedPosts.some(
      (post) => canonicalPostUrl(post.url) === canonical,
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
