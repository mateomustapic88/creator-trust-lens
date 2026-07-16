import type { ProfileSample, VisibleComment } from "../analysis/types";

const POST_COUNT = 6;
const RECURRING_AUTHORS = [
  "daily_style_feed",
  "lifestyle_circle",
  "trend_watch_today",
  "inspo_collective",
  "city_looks_daily",
  "creator_support_hub",
];

const REPEATED_COMMENTS = [
  "Amazing content 🔥",
  "Love this so much ❤️",
  "Perfect post 😍",
];

export function createDemoProfileSample(): ProfileSample {
  const comments: VisibleComment[] = [];
  const scannedAt = new Date();

  for (let postIndex = 0; postIndex < POST_COUNT; postIndex += 1) {
    const postId = `demo-post-${postIndex + 1}`;

    RECURRING_AUTHORS.forEach((author, authorIndex) => {
      comments.push({
        author,
        text: REPEATED_COMMENTS[authorIndex % REPEATED_COMMENTS.length]!,
        postId,
      });
    });

    for (let commentIndex = 0; commentIndex < 10; commentIndex += 1) {
      comments.push({
        author: `viewer_${postIndex + 1}_${commentIndex + 1}`,
        text: `I liked detail ${commentIndex + 1} in post ${postIndex + 1}`,
        postId,
      });
    }
  }

  const likes = [4_200, 4_450, 4_100, 4_700, 4_300, 19_800];

  return {
    handle: "sample_creator",
    scannedAt: scannedAt.toISOString(),
    followerCount: 120_000,
    posts: likes.map((likeCount, index) => ({
      id: `demo-post-${index + 1}`,
      url: `https://www.instagram.com/p/demo-${index + 1}/`,
      likes: likeCount,
      commentCount: 16,
      mediaType: "post",
      publishedAt: new Date(
        scannedAt.getTime() - (index + 3) * 24 * 60 * 60 * 1_000,
      ).toISOString(),
      sampleTarget: 16,
    })),
    comments,
  };
}
