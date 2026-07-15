import type {
  AnalysisResult,
  Confidence,
  EvidenceItem,
  ProfileSample,
  VisibleComment,
} from "./types";
import {
  isGenericComment,
  jaccardSimilarity,
  normalizeComment,
} from "./text";

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

function getConfidence(posts: number, comments: number): Confidence {
  if (posts < 3 || comments < 20) return "insufficient";
  if (posts >= 9 && comments >= 200) return "high";
  if (posts >= 6 && comments >= 80) return "medium";
  return "low";
}

function duplicateEvidence(comments: VisibleComment[]): EvidenceItem {
  const exactGroups = new Map<string, VisibleComment[]>();

  for (const comment of comments) {
    const normalized = normalizeComment(comment.text);
    if (!normalized) continue;
    const group = exactGroups.get(normalized) ?? [];
    group.push(comment);
    exactGroups.set(normalized, group);
  }

  const exactDuplicates = [...exactGroups.values()].filter(
    (group) => new Set(group.map((comment) => comment.author)).size > 1,
  );

  const representatives = exactDuplicates.map((group) => group[0]).filter(Boolean);
  let nearDuplicatePairs = 0;

  for (let left = 0; left < representatives.length; left += 1) {
    for (let right = left + 1; right < representatives.length; right += 1) {
      const a = representatives[left];
      const b = representatives[right];
      if (a && b && jaccardSimilarity(a.text, b.text) >= 0.85) {
        nearDuplicatePairs += 1;
      }
    }
  }

  const duplicateComments = exactDuplicates.reduce(
    (sum, group) => sum + group.length,
    0,
  );
  const ratio = comments.length ? duplicateComments / comments.length : 0;

  return {
    id: "duplicates",
    label: "Repeated comments",
    value: `${duplicateComments}`,
    score: clamp(ratio * 180 + nearDuplicatePairs * 2),
    explanation: "Similar comments posted by different visible accounts.",
    examples: exactDuplicates.slice(0, 3).map((group) => group[0]?.text ?? ""),
  };
}

function genericEvidence(comments: VisibleComment[]): EvidenceItem {
  const generic = comments.filter((comment) => isGenericComment(comment.text));
  const ratio = comments.length ? generic.length / comments.length : 0;

  return {
    id: "generic",
    label: "Low-information comments",
    value: `${Math.round(ratio * 100)}%`,
    score: clamp(Math.max(0, ratio - 0.15) * 160),
    explanation: "Very short, generic, or emoji-only visible comments.",
    examples: generic.slice(0, 3).map((comment) => comment.text),
  };
}

function recurringEvidence(
  comments: VisibleComment[],
  postCount: number,
): EvidenceItem {
  const authorPosts = new Map<string, Set<string>>();

  for (const comment of comments) {
    const posts = authorPosts.get(comment.author) ?? new Set<string>();
    posts.add(comment.postId);
    authorPosts.set(comment.author, posts);
  }

  const threshold = Math.max(2, Math.ceil(postCount * 0.7));
  const recurring = [...authorPosts.entries()].filter(
    ([, posts]) => posts.size >= threshold,
  );

  const ratio = authorPosts.size ? recurring.length / authorPosts.size : 0;

  return {
    id: "recurring",
    label: "Recurring accounts",
    value: `${recurring.length}`,
    score: clamp(ratio * 220),
    explanation: `Visible accounts appearing on at least ${threshold} scanned posts.`,
    examples: recurring.slice(0, 3).map(([author, posts]) =>
      `@${author} appeared on ${posts.size} posts`,
    ),
  };
}

function diversityEvidence(comments: VisibleComment[]): EvidenceItem {
  if (comments.length === 0) {
    return {
      id: "diversity",
      label: "Audience diversity",
      value: "N/A",
      score: 0,
      explanation: "No visible commenters were available to evaluate diversity.",
      examples: [],
    };
  }

  const authorCounts = new Map<string, number>();
  for (const comment of comments) {
    authorCounts.set(comment.author, (authorCounts.get(comment.author) ?? 0) + 1);
  }

  const uniqueRatio = authorCounts.size / comments.length;
  const concentratedAuthors = [...authorCounts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((left, right) => right[1] - left[1]);

  return {
    id: "diversity",
    label: "Audience diversity",
    value: `${Math.round(uniqueRatio * 100)}% unique`,
    score: clamp(Math.max(0, 0.65 - uniqueRatio) * 170),
    explanation: "Share of visible comments written by different accounts.",
    examples: concentratedAuthors
      .slice(0, 3)
      .map(([author, count]) => `@${author} wrote ${count} comments`),
  };
}

function anomalyEvidence(sample: ProfileSample): EvidenceItem {
  const rates = sample.posts
    .map((post) => {
      if (!post.likes || !sample.followerCount) return undefined;
      return (post.likes + (post.commentCount ?? 0)) / sample.followerCount;
    })
    .filter((rate): rate is number => rate !== undefined);

  if (rates.length < 4) {
    return {
      id: "anomalies",
      label: "Engagement anomalies",
      value: "N/A",
      score: 0,
      explanation: "Not enough visible like and follower data to evaluate variation.",
      examples: [],
    };
  }

  const sorted = [...rates].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const deviations = rates.map((rate) => Math.abs(rate - median)).sort((a, b) => a - b);
  const mad = deviations[Math.floor(deviations.length / 2)] ?? 0;
  const threshold = median + Math.max(mad * 4, median * 1.5);
  const anomalies = rates.filter((rate) => rate > threshold);

  return {
    id: "anomalies",
    label: "Engagement spikes",
    value: `${anomalies.length}`,
    score: clamp((anomalies.length / rates.length) * 160),
    explanation: "Visible post engagement far outside this profile's typical range.",
    examples: anomalies.slice(0, 3).map((rate) => `${(rate * 100).toFixed(2)}% engagement`),
  };
}

export function analyzeProfile(sample: ProfileSample): AnalysisResult {
  const evidence = [
    duplicateEvidence(sample.comments),
    genericEvidence(sample.comments),
    recurringEvidence(sample.comments, sample.posts.length),
    diversityEvidence(sample.comments),
    anomalyEvidence(sample),
  ];
  const confidence = getConfidence(sample.posts.length, sample.comments.length);

  const suspicionScore = Math.round(
    evidence[0]!.score * 0.25 +
      evidence[1]!.score * 0.15 +
      evidence[2]!.score * 0.25 +
      evidence[3]!.score * 0.2 +
      evidence[4]!.score * 0.15,
  );

  return {
    handle: sample.handle,
    trustScore: confidence === "insufficient" ? undefined : 100 - suspicionScore,
    suspicionScore: confidence === "insufficient" ? undefined : suspicionScore,
    confidence,
    postsScanned: sample.posts.length,
    commentsScanned: sample.comments.length,
    evidence,
    scannedAt: sample.scannedAt,
  };
}
