const GENERIC_PHRASES = new Set([
  "amazing",
  "amazing content",
  "awesome",
  "beautiful",
  "cool",
  "great content",
  "great post",
  "love it",
  "love this",
  "nice",
  "nice pic",
  "nice post",
  "so good",
  "so pretty",
  "stunning",
  "wow",
]);

const EMOJI_OR_SYMBOL =
  /[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{P}\p{S}\uFE0F\u200D]/gu;

export function normalizeComment(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@[\p{L}\p{N}_.]+/gu, "")
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(EMOJI_OR_SYMBOL, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isEmojiOnly(value: string): boolean {
  const withoutWhitespace = value.replace(/\s/g, "");
  if (!withoutWhitespace) return false;
  return withoutWhitespace.replace(EMOJI_OR_SYMBOL, "").length === 0;
}

export function isGenericComment(value: string): boolean {
  if (isEmojiOnly(value)) return true;

  const normalized = normalizeComment(value);
  if (!normalized) return false;

  const wordCount = normalized.split(" ").length;
  return GENERIC_PHRASES.has(normalized) || wordCount <= 1;
}

export function jaccardSimilarity(left: string, right: string): number {
  const a = new Set(normalizeComment(left).split(" ").filter(Boolean));
  const b = new Set(normalizeComment(right).split(" ").filter(Boolean));

  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  return intersection / new Set([...a, ...b]).size;
}
