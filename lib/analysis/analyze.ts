import type {
  AnalysisResult,
  Confidence,
  EvidenceItem,
  ProfileHistorySnapshot,
  ProfileSample,
  VisibleComment,
  VisiblePost,
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

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

function downgradeConfidence(confidence: Confidence): Confidence {
  if (confidence === "high") return "medium";
  if (confidence === "medium") return "low";
  if (confidence === "low") return "low";
  return confidence;
}

function getConfidence(
  posts: number,
  comments: number,
  sampleCoverage?: number,
): Confidence {
  let confidence: Confidence;
  if (posts < 3 || comments < 20) return "insufficient";
  if (posts >= 9 && comments >= 200) confidence = "high";
  else if (posts >= 6 && comments >= 80) confidence = "medium";
  else confidence = "low";

  return sampleCoverage !== undefined && sampleCoverage < 0.5
    ? downgradeConfidence(confidence)
    : confidence;
}

function settledPosts(sample: ProfileSample): VisiblePost[] {
  const scannedAt = Date.parse(sample.scannedAt);
  if (!Number.isFinite(scannedAt)) return sample.posts;

  return sample.posts.filter((post) => {
    if (!post.publishedAt) return true;
    const publishedAt = Date.parse(post.publishedAt);
    return !Number.isFinite(publishedAt) || scannedAt - publishedAt >= 48 * HOUR_MS;
  });
}

function mediaGroup(post: VisiblePost): string {
  return post.mediaType ?? "unknown format";
}

function medianByMedia<T extends { post: VisiblePost }>(
  items: T[],
  value: (item: T) => number,
): number {
  const groups = new Map<string, number[]>();
  for (const item of items) {
    const key = mediaGroup(item.post);
    groups.set(key, [...(groups.get(key) ?? []), value(item)]);
  }
  return median([...groups.values()].map((values) => median(values)));
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

function sampleCoverageEvidence(sample: ProfileSample): EvidenceItem {
  const commentCounts = new Map<string, number>();
  for (const comment of sample.comments) {
    commentCounts.set(
      comment.postId,
      (commentCounts.get(comment.postId) ?? 0) + 1,
    );
  }

  const coverage = sample.posts
    .filter((post) => post.sampleTarget && post.sampleTarget > 0)
    .map((post) => ({
      post,
      ratio: Math.min(
        1,
        (commentCounts.get(post.id) ?? 0) / (post.sampleTarget ?? 1),
      ),
    }));

  if (coverage.length === 0) {
    return {
      id: "sample_coverage",
      label: "Sample completeness",
      value: "N/A",
      score: 0,
      explanation: "Collection targets were not available for this scan.",
      examples: [],
    };
  }

  const average =
    coverage.reduce((total, item) => total + item.ratio, 0) / coverage.length;
  const incomplete = coverage
    .filter((item) => item.ratio < 1)
    .sort((left, right) => left.ratio - right.ratio);

  return {
    id: "sample_coverage",
    label: "Sample completeness",
    value: formatPercent(average),
    score: 0,
    explanation: "Share of the chosen per-post comment targets captured. This changes confidence, not observed risk.",
    examples: incomplete
      .slice(0, 3)
      .map(({ post, ratio }) => `${post.id}: ${formatPercent(ratio)} captured`),
  };
}

function anomalyEvidence(sample: ProfileSample): EvidenceItem {
  const eligiblePosts = settledPosts(sample);
  const freshPostCount = sample.posts.length - eligiblePosts.length;
  const postEngagement = eligiblePosts
    .map((post) => {
      if (post.likes === undefined) return undefined;
      return {
        post,
        engagement: post.likes + (post.commentCount ?? 0),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  const groups = new Map<string, typeof postEngagement>();
  for (const item of postEngagement) {
    const key = mediaGroup(item.post);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const comparableGroups = [...groups.values()].filter(
    (group) => group.length >= 4,
  );

  if (comparableGroups.length === 0) {
    return {
      id: "anomalies",
      label: "Engagement anomalies",
      value: "N/A",
      score: 0,
      explanation: "At least four settled posts of the same format with visible like totals are required.",
      examples: [],
    };
  }

  const anomalies = comparableGroups.flatMap((group) => {
    const typical = median(group.map((item) => item.engagement));
    const deviation = median(
      group.map((item) => Math.abs(item.engagement - typical)),
    );
    const threshold = typical + Math.max(deviation * 4, typical * 1.5);
    return group.filter((item) => item.engagement > threshold);
  });
  const comparablePostCount = comparableGroups.reduce(
    (total, group) => total + group.length,
    0,
  );

  return {
    id: "anomalies",
    label: "Engagement spikes",
    value: `${anomalies.length}`,
    score: clamp((anomalies.length / comparablePostCount) * 160),
    explanation: `Visible engagement far outside comparable settled posts of the same format.${freshPostCount ? ` ${freshPostCount} fresh post${freshPostCount === 1 ? " was" : "s were"} excluded.` : ""}`,
    examples: anomalies
      .slice(0, 3)
      .map(({ post, engagement }) => `${post.id}: ${engagement.toLocaleString()} interactions`),
  };
}

function engagementRateEvidence(sample: ProfileSample): EvidenceItem {
  const followerCount = sample.followerCount;
  const eligiblePosts = settledPosts(sample);
  const freshPostCount = sample.posts.length - eligiblePosts.length;
  const rates = eligiblePosts
    .map((post) =>
      followerCount && post.likes !== undefined
        ? {
            post,
            rate: (post.likes + (post.commentCount ?? 0)) / followerCount,
          }
        : undefined,
    )
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

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

  const typicalRate = medianByMedia(rates, (item) => item.rate);
  const conservativeFloor =
    followerCount < 100_000 ? 0.003 : followerCount < 1_000_000 ? 0.0015 : 0.0008;
  const shortfall = Math.max(0, conservativeFloor - typicalRate) / conservativeFloor;

  return {
    id: "engagement_rate",
    label: "Typical engagement",
    value: formatPercent(typicalRate),
    score: clamp(shortfall * 60),
    explanation: `Median visible interactions relative to followers, balanced by content format.${freshPostCount ? ` ${freshPostCount} post${freshPostCount === 1 ? "" : "s"} under 48 hours old excluded.` : ""}`,
    examples: [
      `${rates.length} posts with visible totals`,
      `${followerCount.toLocaleString()} followers observed`,
    ],
  };
}

function commentLikeRatioEvidence(sample: ProfileSample): EvidenceItem {
  const eligiblePosts = settledPosts(sample);
  const ratios = eligiblePosts
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

  const typicalRatio = medianByMedia(ratios, (item) => item.ratio);
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

function findHistoricalBaseline(
  sample: ProfileSample,
  history: ProfileHistorySnapshot[],
  minimumAge: number,
  maximumAge: number,
): ProfileHistorySnapshot | undefined {
  const scannedAt = Date.parse(sample.scannedAt);
  return [...history]
    .filter((snapshot) => {
      const timestamp = Date.parse(snapshot.scannedAt);
      const age = scannedAt - timestamp;
      return Number.isFinite(timestamp) && age >= minimumAge && age <= maximumAge;
    })
    .sort((left, right) => Date.parse(right.scannedAt) - Date.parse(left.scannedAt))[0];
}

function medianInteractions(posts: VisiblePost[]): number | undefined {
  const values = posts
    .filter((post) => post.likes !== undefined)
    .map((post) => (post.likes ?? 0) + (post.commentCount ?? 0));
  return values.length >= 3 ? median(values) : undefined;
}

function growthAlignmentEvidence(
  sample: ProfileSample,
  history: ProfileHistorySnapshot[],
): EvidenceItem {
  const baseline = findHistoricalBaseline(
    sample,
    history,
    7 * DAY_MS,
    120 * DAY_MS,
  );
  const currentFollowers = sample.followerCount;
  const previousFollowers = baseline?.followerCount;
  const currentEngagement = medianInteractions(settledPosts(sample));
  const previousEngagement = baseline
    ? medianInteractions(baseline.posts)
    : undefined;

  if (
    !baseline ||
    !currentFollowers ||
    !previousFollowers ||
    currentEngagement === undefined ||
    previousEngagement === undefined
  ) {
    return {
      id: "growth_alignment",
      label: "Growth alignment",
      value: "N/A",
      score: 0,
      explanation: "Requires comparable scans at least seven days apart with follower and engagement totals.",
      examples: [],
    };
  }

  const followerGrowth = (currentFollowers - previousFollowers) / previousFollowers;
  const engagementGrowth =
    (currentEngagement - previousEngagement) / Math.max(1, previousEngagement);
  const isMisaligned =
    followerGrowth >= 0.1 && engagementGrowth < followerGrowth * 0.25;
  const mismatch = isMisaligned
    ? (followerGrowth - Math.max(0, engagementGrowth)) / followerGrowth
    : 0;

  return {
    id: "growth_alignment",
    label: "Follower-growth alignment",
    value: formatPercent(followerGrowth),
    score: clamp(mismatch * 55),
    explanation: "Checks whether substantial follower growth is accompanied by movement in typical visible post engagement.",
    examples: [
      `Typical engagement change: ${formatPercent(engagementGrowth)}`,
      `Compared with ${new Date(baseline.scannedAt).toLocaleDateString()}`,
    ],
  };
}

function historicalSpikeEvidence(
  sample: ProfileSample,
  history: ProfileHistorySnapshot[],
): EvidenceItem {
  const baseline = findHistoricalBaseline(
    sample,
    history,
    DAY_MS,
    30 * DAY_MS,
  );
  if (!baseline) {
    return {
      id: "historical_spikes",
      label: "Historical post changes",
      value: "N/A",
      score: 0,
      explanation: "Requires the same posts in scans taken at least one day apart.",
      examples: [],
    };
  }

  const previousPosts = new Map(baseline.posts.map((post) => [post.id, post]));
  const changes = sample.posts
    .map((post) => {
      const previous = previousPosts.get(post.id);
      if (post.likes === undefined || previous?.likes === undefined) return undefined;
      const before = previous.likes + (previous.commentCount ?? 0);
      const after = post.likes + (post.commentCount ?? 0);
      return before > 0 ? { post, growth: Math.max(0, (after - before) / before) } : undefined;
    })
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  if (changes.length < 3) {
    return {
      id: "historical_spikes",
      label: "Historical post changes",
      value: "N/A",
      score: 0,
      explanation: "At least three matching posts with visible totals are required.",
      examples: [],
    };
  }

  const typical = median(changes.map((item) => item.growth));
  const deviation = median(
    changes.map((item) => Math.abs(item.growth - typical)),
  );
  const threshold = typical + Math.max(deviation * 4, 1);
  const spikes = changes.filter((item) => item.growth > threshold);

  return {
    id: "historical_spikes",
    label: "Historical post changes",
    value: `${spikes.length}`,
    score: clamp((spikes.length / changes.length) * 80, 0, 60),
    explanation: "Flags unusually large interaction increases relative to other matching posts between two scans.",
    examples: spikes
      .slice(0, 3)
      .map(({ post, growth }) => `${post.id}: ${formatPercent(growth)} increase`),
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
  sample_coverage: 0,
  growth_alignment: 0.1,
  historical_spikes: 0.08,
};

export function analyzeProfile(
  sample: ProfileSample,
  history: ProfileHistorySnapshot[] = [],
): AnalysisResult {
  const coverageEvidence = sampleCoverageEvidence(sample);
  const sampleCoverage =
    coverageEvidence.value === "N/A"
      ? undefined
      : Number.parseFloat(coverageEvidence.value) / 100;
  const evidence = [
    coverageEvidence,
    duplicateEvidence(sample.comments),
    genericEvidence(sample.comments),
    recurringEvidence(sample.comments, sample.posts.length),
    diversityEvidence(sample.comments),
    anomalyEvidence(sample),
    engagementRateEvidence(sample),
    commentLikeRatioEvidence(sample),
    growthAlignmentEvidence(sample, history),
    historicalSpikeEvidence(sample, history),
  ];
  const confidence = getConfidence(
    sample.posts.length,
    sample.comments.length,
    sampleCoverage,
  );

  const availableEvidence = evidence.filter((item) => item.value !== "N/A");
  const availableWeight = availableEvidence.reduce(
    (total, item) => total + EVIDENCE_WEIGHTS[item.id],
    0,
  );
  const rawSuspicionScore =
    availableWeight === 0
      ? 0
      : availableEvidence.reduce(
          (total, item) => total + item.score * EVIDENCE_WEIGHTS[item.id],
          0,
        ) / availableWeight;
  const confidenceFactor: Record<Exclude<Confidence, "insufficient">, number> = {
    low: 0.6,
    medium: 0.85,
    high: 1,
  };
  const suspicionScore =
    confidence === "insufficient"
      ? undefined
      : Math.round(
          50 +
            (rawSuspicionScore - 50) * confidenceFactor[confidence],
        );

  return {
    handle: sample.handle,
    trustScore: suspicionScore === undefined ? undefined : 100 - suspicionScore,
    suspicionScore,
    confidence,
    postsScanned: sample.posts.length,
    commentsScanned: sample.comments.length,
    evidence,
    scannedAt: sample.scannedAt,
    sampleCoverage,
    historySnapshots: history.length,
  };
}
