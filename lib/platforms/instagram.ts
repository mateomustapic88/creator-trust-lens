import type {
  CapturedPost,
  DiscoveredProfile,
  VisibleComment,
  VisiblePost,
} from "../analysis/types";

const RESERVED_PATHS = new Set([
  "accounts",
  "direct",
  "explore",
  "p",
  "reel",
  "reels",
  "stories",
]);

export function parseCompactNumber(value: string): number | undefined {
  const cleaned = value.replace(/,/g, "").trim().toLocaleLowerCase();
  const match = cleaned.match(/([\d.]+)\s*([kmb])?/);
  if (!match?.[1]) return undefined;

  const number = Number(match[1]);
  if (!Number.isFinite(number)) return undefined;

  const multiplier =
    match[2] === "k"
      ? 1_000
      : match[2] === "m"
        ? 1_000_000
        : match[2] === "b"
          ? 1_000_000_000
          : 1;
  return Math.round(number * multiplier);
}

function findProfileHandle(pathname: string): string | undefined {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return undefined;
  const handle = segments[0];
  return handle && !RESERVED_PATHS.has(handle) ? handle : undefined;
}

function readMetaDescription(document: Document): string {
  return (
    document.querySelector<HTMLMetaElement>('meta[property="og:description"]')
      ?.content ?? ""
  );
}

function readFollowerCount(document: Document): number | undefined {
  const candidates = [...document.querySelectorAll("header li, header a")];
  const element = candidates.find((candidate) =>
    /followers?/i.test(candidate.textContent ?? ""),
  );
  if (element) return parseCompactNumber(element.textContent ?? "");

  const description = readMetaDescription(document);
  const match = description.match(/([\d,.]+\s*[KMB]?)\s+followers?/i);
  return match?.[1] ? parseCompactNumber(match[1]) : undefined;
}

function readVisiblePosts(document: Document): VisiblePost[] {
  const links = [
    ...document.querySelectorAll<HTMLAnchorElement>(
      'main a[href*="/p/"], main a[href*="/reel/"]',
    ),
  ];
  const unique = new Map<string, VisiblePost>();

  for (const link of links) {
    const url = new URL(link.href, location.origin);
    const id = url.pathname.split("/").filter(Boolean).at(-1);
    if (!id || unique.has(id)) continue;
    unique.set(id, { id, url: url.href });
  }

  return [...unique.values()].slice(0, 12);
}

function findPostId(pathname: string): string | undefined {
  const segments = pathname.split("/").filter(Boolean);
  if (!segments[0] || !["p", "reel"].includes(segments[0])) return undefined;
  return segments[1];
}

function readPostOwner(document: Document): string | undefined {
  const href = document
    .querySelector<HTMLAnchorElement>('main article header a[href^="/"]')
    ?.getAttribute("href");
  return href?.split("/").filter(Boolean)[0];
}

function isMetadataText(value: string): boolean {
  return (
    /^(reply|see translation|edited)$/i.test(value) ||
    /^\d+\s*(s|m|h|d|w|likes?)$/i.test(value)
  );
}

function readVisibleComments(
  document: Document,
  postId: string,
  owner?: string,
): VisibleComment[] {
  const comments: VisibleComment[] = [];
  const candidates = document.querySelectorAll<HTMLElement>(
    'main article ul li, div[role="dialog"] ul li',
  );

  for (const candidate of candidates) {
    const authorLink = candidate.querySelector<HTMLAnchorElement>('a[href^="/"]');
    const author = authorLink?.getAttribute("href")?.split("/").filter(Boolean)[0];
    if (!author || author === owner || RESERVED_PATHS.has(author)) continue;

    const leafSpans = [...candidate.querySelectorAll("span")].filter(
      (span) => !span.querySelector("span"),
    );
    const text = leafSpans
      .map((span) => span.textContent?.trim() ?? "")
      .find(
        (value) =>
          value.length > 1 && value !== author && !isMetadataText(value),
      );

    if (!text) continue;
    comments.push({ author, text, postId });
  }

  const unique = new Map<string, VisibleComment>();
  for (const comment of comments) {
    unique.set(`${comment.author}\u0000${comment.text}`, comment);
  }
  return [...unique.values()].slice(0, 500);
}

function readPostCounts(document: Document): {
  likes?: number;
  commentCount?: number;
} {
  const description = readMetaDescription(document);
  const match = description.match(
    /([\d,.]+\s*[KMB]?)\s+likes?,\s*([\d,.]+\s*[KMB]?)\s+comments?/i,
  );
  if (!match) return {};

  return {
    likes: match[1] ? parseCompactNumber(match[1]) : undefined,
    commentCount: match[2] ? parseCompactNumber(match[2]) : undefined,
  };
}

export function discoverInstagramProfile(
  document: Document,
  pageLocation: Pick<Location, "href" | "pathname">,
): DiscoveredProfile {
  const handle = findProfileHandle(pageLocation.pathname);
  if (!handle) {
    throw new Error("Open a public Instagram profile before starting a scan.");
  }

  const posts = readVisiblePosts(document);
  if (posts.length === 0) {
    throw new Error("No public posts are visible on this profile.");
  }

  return {
    handle,
    profileUrl: pageLocation.href,
    followerCount: readFollowerCount(document),
    postUrls: posts.map((post) => post.url),
  };
}

export function captureInstagramPost(
  document: Document,
  pageLocation: Pick<Location, "href" | "pathname">,
): CapturedPost {
  const id = findPostId(pageLocation.pathname);
  if (!id) {
    throw new Error("Open an Instagram post or reel before capturing comments.");
  }

  const owner = readPostOwner(document);
  const counts = readPostCounts(document);

  return {
    id,
    url: pageLocation.href,
    ...counts,
    comments: readVisibleComments(document, id, owner),
  };
}
