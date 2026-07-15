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

const DEFAULT_COMMENT_LIMIT = 150;
const MAX_LOAD_ATTEMPTS = 12;
const LOAD_DELAY_MS = 800;

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

export function parseInstagramPostId(value: string): string | undefined {
  let pathname = value;

  try {
    pathname = new URL(value, "https://www.instagram.com").pathname;
  } catch {
    // Fall back to parsing the supplied value as a pathname.
  }

  const segments = pathname.split("/").filter(Boolean);
  const typeIndex = segments.findIndex((segment) =>
    ["p", "reel", "reels"].includes(segment),
  );
  if (typeIndex < 0) return undefined;
  return segments[typeIndex + 1];
}

function readDocumentPostUrl(document: Document): string | undefined {
  return (
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ??
    document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content
  );
}

function readPostOwner(document: Document): string | undefined {
  const href = document
    .querySelector<HTMLAnchorElement>(
      'main header a[href], div[role="dialog"] header a[href]',
    )
    ?.getAttribute("href");
  return readHandleFromHref(href);
}

function isMetadataText(value: string): boolean {
  return (
    /^(reply|see translation|edited|follow|following|verified)$/i.test(value) ||
    /^\d+\s*(s|m|h|d|w|y|likes?|replies?)$/i.test(value)
  );
}

function readHandleFromHref(href?: string | null): string | undefined {
  if (!href) return undefined;

  try {
    const segments = new URL(href, "https://www.instagram.com")
      .pathname.split("/")
      .filter(Boolean);
    if (segments.length !== 1) return undefined;
    const handle = segments[0];
    return handle && !RESERVED_PATHS.has(handle) ? handle : undefined;
  } catch {
    return undefined;
  }
}

function readCommentText(
  container: HTMLElement,
  authorLink: HTMLAnchorElement,
  author: string,
): string | undefined {
  const preferredSpans = [
    ...container.querySelectorAll<HTMLElement>('span[dir="auto"]'),
  ];
  const leafSpans = [...container.querySelectorAll<HTMLElement>("span")].filter(
    (span) => !span.querySelector("span"),
  );

  const values = [...preferredSpans, ...leafSpans]
    .filter((span) => !authorLink.contains(span) && !span.closest("time"))
    .map((span) => span.textContent?.trim() ?? "")
    .filter(
      (value) =>
        value.length > 1 &&
        value !== author &&
        !isMetadataText(value),
    );

  return values.sort((left, right) => right.length - left.length)[0];
}

function findCommentContainer(
  authorLink: HTMLAnchorElement,
): HTMLElement | undefined {
  let current = authorLink.parentElement;

  for (let depth = 0; current && depth < 12; depth += 1) {
    const hasTime = Boolean(current.querySelector("time"));
    const hasRelativeTime = [...current.querySelectorAll("a, span")].some(
      (element) => /^\d+\s*[smhdwy]$/i.test(element.textContent?.trim() ?? ""),
    );

    if ((hasTime || hasRelativeTime) && current.querySelector("span")) {
      return current;
    }

    if (
      current.matches('article, main, div[role="dialog"]') ||
      current.parentElement?.matches('article, main, div[role="dialog"]')
    ) {
      break;
    }
    current = current.parentElement;
  }

  return undefined;
}

function readVisibleComments(
  document: Document,
  postId: string,
  owner?: string,
): VisibleComment[] {
  const comments: VisibleComment[] = [];
  const authorLinks = document.querySelectorAll<HTMLAnchorElement>(
    'main a[href], div[role="dialog"] a[href]',
  );

  for (const authorLink of authorLinks) {
    const author = readHandleFromHref(authorLink.getAttribute("href"));
    if (!author || author === owner || RESERVED_PATHS.has(author)) continue;

    const container = findCommentContainer(authorLink);
    if (!container) continue;
    const text = readCommentText(container, authorLink, author);

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

export function isLoadMoreCommentsLabel(value: string): boolean {
  return /(?:load|view)\s+(?:all\s+)?(?:more\s+|previous\s+)?(?:\d[\d,.]*\s+)?comments?/i.test(
    value,
  );
}

function findLoadMoreCommentsControl(
  document: Document,
): HTMLElement | undefined {
  const controls = document.querySelectorAll<HTMLElement>(
    'main button, main [role="button"], div[role="dialog"] button, div[role="dialog"] [role="button"]',
  );

  return [...controls].find((control) => {
    const label = [
      control.getAttribute("aria-label"),
      control.getAttribute("title"),
      control.textContent,
      control.querySelector("svg")?.getAttribute("aria-label"),
    ]
      .filter(Boolean)
      .join(" ");

    return control.getClientRects().length > 0 && isLoadMoreCommentsLabel(label);
  });
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

export async function loadAndCaptureInstagramPost(
  document: Document,
  pageLocation: Pick<Location, "href" | "pathname">,
  expectedPostUrl?: string,
  options: { maxComments?: number } = {},
): Promise<CapturedPost> {
  const maxComments = Math.min(
    300,
    Math.max(20, options.maxComments ?? DEFAULT_COMMENT_LIMIT),
  );
  const documentPostUrl = readDocumentPostUrl(document);
  const id = [
    expectedPostUrl,
    pageLocation.href,
    pageLocation.pathname,
    documentPostUrl,
  ]
    .filter((value): value is string => Boolean(value))
    .map(parseInstagramPostId)
    .find(Boolean);

  if (!id) {
    throw new Error("Open an Instagram post or reel before capturing comments.");
  }

  let previousCount = readVisibleComments(document, id, readPostOwner(document)).length;
  let unchangedAttempts = 0;

  for (let attempt = 0; attempt < MAX_LOAD_ATTEMPTS; attempt += 1) {
    if (previousCount >= maxComments) break;

    const control = findLoadMoreCommentsControl(document);
    if (!control) break;

    control.scrollIntoView({ block: "center", behavior: "auto" });
    control.click();
    await wait(LOAD_DELAY_MS);

    const nextCount = readVisibleComments(
      document,
      id,
      readPostOwner(document),
    ).length;
    unchangedAttempts = nextCount <= previousCount ? unchangedAttempts + 1 : 0;
    previousCount = Math.max(previousCount, nextCount);

    if (unchangedAttempts >= 2) break;
  }

  return captureInstagramPost(document, pageLocation, expectedPostUrl);
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
  expectedPostUrl?: string,
): CapturedPost {
  const documentPostUrl = readDocumentPostUrl(document);
  const captureUrl = expectedPostUrl ?? documentPostUrl ?? pageLocation.href;
  const id = [
    expectedPostUrl,
    pageLocation.href,
    pageLocation.pathname,
    documentPostUrl,
  ]
    .filter((value): value is string => Boolean(value))
    .map(parseInstagramPostId)
    .find(Boolean);

  if (!id) {
    throw new Error("Open an Instagram post or reel before capturing comments.");
  }

  const owner = readPostOwner(document);
  const counts = readPostCounts(document);
  const comments = readVisibleComments(document, id, owner);

  if (comments.length === 0) {
    const scopedProfileLinks = [
      ...document.querySelectorAll<HTMLAnchorElement>(
        'main a[href], div[role="dialog"] a[href]',
      ),
    ].filter((link) => readHandleFromHref(link.getAttribute("href"))).length;
    const timestamps = document.querySelectorAll(
      'main time, div[role="dialog"] time',
    ).length;

    throw new Error(
      `No visible comments found. Expand comments and try again. Diagnostic: ${scopedProfileLinks} profile links, ${timestamps} timestamps.`,
    );
  }

  return {
    id,
    url: captureUrl,
    ...counts,
    comments,
  };
}
