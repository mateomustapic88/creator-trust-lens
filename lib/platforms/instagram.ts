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
const MAX_LOAD_ATTEMPTS = 40;
const LOAD_DELAY_MS = 700;

export type CommentLoadProgress = {
  postId: string;
  collected: number;
  target: number;
  attempt: number;
  maxAttempts: number;
  status: "loading" | "complete" | "stalled";
};

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

function isVisibleElement(element: HTMLElement): boolean {
  return element.getClientRects().length > 0;
}

function getActiveCommentScope(document: Document): Document | HTMLElement {
  const dialogs = [
    ...document.querySelectorAll<HTMLElement>('div[role="dialog"]'),
  ].filter(isVisibleElement);
  return dialogs.at(-1) ?? document.querySelector<HTMLElement>("main") ?? document;
}

function readPostOwner(document: Document): string | undefined {
  const scope = getActiveCommentScope(document);
  const href = scope
    .querySelector<HTMLAnchorElement>('header a[href], a[href]')
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
  const scope = getActiveCommentScope(document);
  const authorLinks = scope.querySelectorAll<HTMLAnchorElement>('a[href]');

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
  const scope = getActiveCommentScope(document);
  const controls = scope.querySelectorAll<HTMLElement>(
    'button, [role="button"]',
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

    return isVisibleElement(control) && isLoadMoreCommentsLabel(label);
  });
}

function findScrollableCommentsContainer(
  document: Document,
): HTMLElement | undefined {
  const scope = getActiveCommentScope(document);
  const candidates = [
    ...(scope instanceof HTMLElement ? [scope] : []),
    ...scope.querySelectorAll<HTMLElement>("div"),
  ].filter((element) => {
    if (
      element.clientHeight < 100 ||
      element.scrollHeight <= element.clientHeight + 40 ||
      element.getClientRects().length === 0
    ) {
      return false;
    }

    const overflowY = document.defaultView?.getComputedStyle(element).overflowY;
    const profileLinks = [...element.querySelectorAll<HTMLAnchorElement>('a[href]')]
      .filter((link) => readHandleFromHref(link.getAttribute("href"))).length;
    const timestamps = element.querySelectorAll("time").length;
    const containsCommentStructure = profileLinks >= 2 || timestamps >= 2;
    return (
      containsCommentStructure &&
      ["auto", "scroll", "hidden"].includes(overflowY ?? "")
    );
  });

  return candidates.sort((left, right) => {
    const leftDialog = left.closest('div[role="dialog"]') ? 1 : 0;
    const rightDialog = right.closest('div[role="dialog"]') ? 1 : 0;
    if (leftDialog !== rightDialog) return rightDialog - leftDialog;
    return left.clientHeight - right.clientHeight;
  })[0];
}

export function getNextCommentScrollTop(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
): number {
  const maximum = Math.max(0, scrollHeight - clientHeight);
  const step = Math.max(240, Math.floor(clientHeight * 0.75));
  return Math.min(maximum, scrollTop + step);
}

export function getCommentSampleTarget(
  requestedLimit: number,
  availableCommentCount?: number,
): number {
  const safeLimit = Math.min(300, Math.max(20, requestedLimit));
  return availableCommentCount === undefined
    ? safeLimit
    : Math.min(safeLimit, Math.max(0, availableCommentCount));
}

function addCommentsToSample(
  sample: Map<string, VisibleComment>,
  comments: VisibleComment[],
): number {
  const sizeBefore = sample.size;
  for (const comment of comments) {
    sample.set(`${comment.author}\u0000${comment.text}`, comment);
  }
  return sample.size - sizeBefore;
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

export async function loadAndCaptureInstagramPost(
  document: Document,
  pageLocation: Pick<Location, "href" | "pathname">,
  expectedPostUrl?: string,
  options: {
    maxComments?: number;
    onProgress?: (progress: CommentLoadProgress) => void;
  } = {},
): Promise<CapturedPost> {
  const requestedLimit = options.maxComments ?? DEFAULT_COMMENT_LIMIT;
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

  const counts = readPostCounts(document);
  const target = getCommentSampleTarget(requestedLimit, counts.commentCount);
  const collectedComments = new Map<string, VisibleComment>();
  addCommentsToSample(
    collectedComments,
    readVisibleComments(document, id, readPostOwner(document)),
  );
  let unchangedAttempts = 0;
  let attemptsPerformed = 0;
  options.onProgress?.({
    postId: id,
    collected: collectedComments.size,
    target,
    attempt: 0,
    maxAttempts: MAX_LOAD_ATTEMPTS,
    status: "loading",
  });

  for (let attempt = 0; attempt < MAX_LOAD_ATTEMPTS; attempt += 1) {
    if (collectedComments.size >= target) break;

    const control =
      unchangedAttempts < 2
        ? findLoadMoreCommentsControl(document)
        : undefined;
    const scrollContainer = control
      ? undefined
      : findScrollableCommentsContainer(document);

    if (control) {
      control.scrollIntoView({ block: "center", behavior: "auto" });
      control.click();
    } else if (scrollContainer) {
      const previousTop = scrollContainer.scrollTop;
      scrollContainer.scrollTop = getNextCommentScrollTop(
        previousTop,
        scrollContainer.clientHeight,
        scrollContainer.scrollHeight,
      );
      scrollContainer.dispatchEvent(new Event("scroll", { bubbles: true }));
      if (scrollContainer.scrollTop === previousTop && unchangedAttempts >= 4) {
        break;
      }
    } else {
      break;
    }

    attemptsPerformed = attempt + 1;
    await wait(LOAD_DELAY_MS);

    const added = addCommentsToSample(
      collectedComments,
      readVisibleComments(document, id, readPostOwner(document)),
    );
    unchangedAttempts = added === 0 ? unchangedAttempts + 1 : 0;
    options.onProgress?.({
      postId: id,
      collected: Math.min(collectedComments.size, target),
      target,
      attempt: attemptsPerformed,
      maxAttempts: MAX_LOAD_ATTEMPTS,
      status: collectedComments.size >= target ? "complete" : "loading",
    });
    if (unchangedAttempts >= 5) break;
  }

  const comments = [...collectedComments.values()].slice(0, target);
  if (comments.length === 0) {
    options.onProgress?.({
      postId: id,
      collected: 0,
      target,
      attempt: attemptsPerformed,
      maxAttempts: MAX_LOAD_ATTEMPTS,
      status: "stalled",
    });
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

  if (comments.length < target) {
    options.onProgress?.({
      postId: id,
      collected: comments.length,
      target,
      attempt: attemptsPerformed,
      maxAttempts: MAX_LOAD_ATTEMPTS,
      status: "stalled",
    });
    throw new Error(
      `Comment sample target not reached: collected ${comments.length} of ${target} required comments. Retry after opening the full comment list, or skip this post.`,
    );
  }

  options.onProgress?.({
    postId: id,
    collected: comments.length,
    target,
    attempt: attemptsPerformed,
    maxAttempts: MAX_LOAD_ATTEMPTS,
    status: "complete",
  });

  return {
    id,
    url: captureUrl,
    ...counts,
    comments,
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
