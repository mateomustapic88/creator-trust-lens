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

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  }
  return sorted[middle] ?? 0;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`;
}

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
  const postEngagement = sample.posts
    .map((post) => {
      if (post.likes === undefined) return undefined;
      return {
        post,
        engagement: post.likes + (post.commentCount ?? 0),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  if (postEngagement.length < 4) {
    return {
      id: "anomalies",
      label: "Engagement anomalies",
      value: "N/A",
      score: 0,
      explanation: "At least four posts with visible like totals are required.",
      examples: [],
    };
  }

  const typical = median(postEngagement.map((item) => item.engagement));
  const deviation = median(
    postEngagement.map((item) => Math.abs(item.engagement - typical)),
  );
  const threshold = typical + Math.max(deviation * 4, typical * 1.5);
  const anomalies = postEngagement.filter(
    (item) => item.engagement > threshold,
  );

  return {
    id: "anomalies",
    label: "Engagement spikes",
    value: `${anomalies.length}`,
    score: clamp((anomalies.length / postEngagement.length) * 160),
    explanation: "Visible post engagement far outside this profile's typical range.",
    examples: anomalies
      .slice(0, 3)
      .map(({ post, engagement }) => `${post.id}: ${engagement.toLocaleString()} interactions`),
  };
}

function engagementRateEvidence(sample: ProfileSample): EvidenceItem {
  const followerCount = sample.followerCount;
  const rates = sample.posts
    .map((post) =>
      followerCount && post.likes !== undefined
        ? (post.likes + (post.commentCount ?? 0)) / followerCount
        : undefined,
    )
    .filter((rate): rate is number => rate !== undefined);

  if (!followerCount || rates.length < 3) {
    return {
      id: "engagement_rate",
      label: "Typical engagement",
      value: "N/A",
      score: 0,
      explanation: "Follower count and visible engagement from at least three posts are required.",
      examples: [],
    };
  }

  const typicalRate = median(rates);
  const conservativeFloor =
    followerCount < 100_000 ? 0.003 : followerCount < 1_000_000 ? 0.0015 : 0.0008;
  const shortfall = Math.max(0, conservativeFloor - typicalRate) / conservativeFloor;

  return {
    id: "engagement_rate",
    label: "Typical engagement",
    value: formatPercent(typicalRate),
    score: clamp(shortfall * 60),
    explanation: "Median visible interactions relative to followers. Very low rates merit context, but vary by creator size and content.",
    examples: [
      `${rates.length} posts with visible totals`,
      `${followerCount.toLocaleString()} followers observed`,
    ],
  };
}

function commentLikeRatioEvidence(sample: ProfileSample): EvidenceItem {
  const ratios = sample.posts
    .map((post) =>
      post.likes && post.commentCount !== undefined
        ? { post, ratio: post.commentCount / post.likes }
        : undefined,
    )
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  if (ratios.length < 3) {
    return {
      id: "comment_like_ratio",
      label: "Comment-to-like balance",
      value: "N/A",
      score: 0,
      explanation: "At least three posts with visible like and comment totals are required.",
      examples: [],
    };
  }

  const typicalRatio = median(ratios.map((item) => item.ratio));
  const score = clamp(Math.max(0, typicalRatio - 0.1) * 300);
  const highest = [...ratios].sort((left, right) => right.ratio - left.ratio);

  return {
    id: "comment_like_ratio",
    label: "Comment-to-like balance",
    value: formatPercent(typicalRatio),
    score,
    explanation: "A disproportionately high visible comment total can merit review. Giveaways and discussion-led posts can naturally raise it.",
    examples: highest
      .slice(0, 3)
      .map(({ post, ratio }) => `${post.id}: ${formatPercent(ratio)}`),
  };
}

const EVIDENCE_WEIGHTS: Record<EvidenceItem["id"], number> = {
  duplicates: 0.2,
  generic: 0.1,
  recurring: 0.18,
  diversity: 0.15,
  anomalies: 0.13,
  engagement_rate: 0.12,
  comment_like_ratio: 0.12,
};

export function analyzeProfile(sample: ProfileSample): AnalysisResult {
  const evidence = [
    duplicateEvidence(sample.comments),
    genericEvidence(sample.comments),
    recurringEvidence(sample.comments, sample.posts.length),
    diversityEvidence(sample.comments),
    anomalyEvidence(sample),
    engagementRateEvidence(sample),
    commentLikeRatioEvidence(sample),
  ];
  const confidence = getConfidence(sample.posts.length, sample.comments.length);

  const availableEvidence = evidence.filter((item) => item.value !== "N/A");
  const availableWeight = availableEvidence.reduce(
    (total, item) => total + EVIDENCE_WEIGHTS[item.id],
    0,
  );
  const suspicionScore = Math.round(
    availableWeight === 0
      ? 0
      : availableEvidence.reduce(
          (total, item) => total + item.score * EVIDENCE_WEIGHTS[item.id],
          0,
        ) / availableWeight,
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
