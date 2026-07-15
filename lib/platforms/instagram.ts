import type {
  ProfileSample,
  VisibleComment,
  VisiblePost,
} from "../analysis/types";

const RESERVED_PATHS = new Set([
  "accounts",
  "direct",
  "explore",
  "reels",
  "stories",
]);

function parseCompactNumber(value: string): number | undefined {
  const cleaned = value.replace(/,/g, "").trim().toLocaleLowerCase();
  const match = cleaned.match(/([\d.]+)\s*([kmb])?/);
  if (!match?.[1]) return undefined;

  const number = Number(match[1]);
  if (!Number.isFinite(number)) return undefined;

  const multiplier = match[2] === "k" ? 1_000 : match[2] === "m" ? 1_000_000 : match[2] === "b" ? 1_000_000_000 : 1;
  return Math.round(number * multiplier);
}

export function findInstagramHandle(pathname: string): string {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "unknown";
  return RESERVED_PATHS.has(firstSegment) ? "unknown" : firstSegment;
}

function readFollowerCount(document: Document): number | undefined {
  const candidates = [...document.querySelectorAll("header li, header a")];
  const element = candidates.find((candidate) =>
    /followers?/i.test(candidate.textContent ?? ""),
  );
  return element ? parseCompactNumber(element.textContent ?? "") : undefined;
}

function readVisiblePosts(document: Document): VisiblePost[] {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('main a[href*="/p/"], main a[href*="/reel/"]')];
  const unique = new Map<string, VisiblePost>();

  for (const link of links) {
    const url = new URL(link.href, location.origin);
    const id = url.pathname.split("/").filter(Boolean).at(-1);
    if (!id || unique.has(id)) continue;
    unique.set(id, { id, url: url.href });
  }

  return [...unique.values()].slice(0, 12);
}

function readVisibleComments(document: Document, posts: VisiblePost[]): VisibleComment[] {
  const postId = posts[0]?.id ?? "visible-page";
  const comments: VisibleComment[] = [];
  const candidates = document.querySelectorAll<HTMLElement>(
    'main article ul li, div[role="dialog"] ul li',
  );

  for (const candidate of candidates) {
    const authorLink = candidate.querySelector<HTMLAnchorElement>('a[href^="/"]');
    const spans = [...candidate.querySelectorAll("span")]
      .map((span) => span.textContent?.trim() ?? "")
      .filter(Boolean);
    const author = authorLink?.getAttribute("href")?.split("/").filter(Boolean)[0];
    const text = spans.find((value) => value !== author && value.length > 1);

    if (!author || !text) continue;
    comments.push({ author, text, postId });
  }

  return comments.slice(0, 500);
}

export function readVisibleInstagramSample(
  document: Document,
  pageLocation: Pick<Location, "pathname">,
): ProfileSample {
  const handle = findInstagramHandle(pageLocation.pathname);
  if (handle === "unknown") {
    throw new Error("Open a public Instagram profile before starting a scan.");
  }

  const posts = readVisiblePosts(document);
  const comments = readVisibleComments(document, posts);

  return {
    handle,
    scannedAt: new Date().toISOString(),
    followerCount: readFollowerCount(document),
    posts,
    comments,
  };
}
