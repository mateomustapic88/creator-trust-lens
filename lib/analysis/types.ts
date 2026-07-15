export type VisibleComment = {
  author: string;
  text: string;
  postId: string;
};

export type VisiblePost = {
  id: string;
  url: string;
  likes?: number;
  commentCount?: number;
};

export type ProfileSample = {
  handle: string;
  scannedAt: string;
  followerCount?: number;
  posts: VisiblePost[];
  comments: VisibleComment[];
};

export type EvidenceItem = {
  id: "duplicates" | "generic" | "recurring" | "anomalies";
  label: string;
  value: string;
  score: number;
  explanation: string;
  examples: string[];
};

export type Confidence = "insufficient" | "low" | "medium" | "high";

export type AnalysisResult = {
  handle: string;
  trustScore?: number;
  suspicionScore?: number;
  confidence: Confidence;
  postsScanned: number;
  commentsScanned: number;
  evidence: EvidenceItem[];
  scannedAt: string;
};
