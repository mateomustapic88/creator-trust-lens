import type { CapturedPost, DiscoveredProfile } from "./analysis/types";

export const MESSAGE_TYPES = {
  discoverProfile: "CREATOR_TRUST_LENS_DISCOVER_PROFILE",
  capturePost: "CREATOR_TRUST_LENS_CAPTURE_POST",
  captureProgress: "CREATOR_TRUST_LENS_CAPTURE_PROGRESS",
} as const;

export type CaptureProgress = {
  type: typeof MESSAGE_TYPES.captureProgress;
  postId: string;
  collected: number;
  target: number;
  attempt: number;
  maxAttempts: number;
  status: "loading" | "complete" | "stalled";
};

export type ExtensionRequest =
  | { type: typeof MESSAGE_TYPES.discoverProfile }
  | {
      type: typeof MESSAGE_TYPES.capturePost;
      postUrl?: string;
      maxComments?: number;
    };

export type ExtensionResponse =
  | { ok: true; kind: "profile"; profile: DiscoveredProfile }
  | { ok: true; kind: "post"; post: CapturedPost }
  | { ok: false; error: string };

export type ExtensionRuntimeMessage = ExtensionRequest | CaptureProgress;
