import type { CapturedPost, DiscoveredProfile } from "./analysis/types";

export const MESSAGE_TYPES = {
  discoverProfile: "CREATOR_TRUST_LENS_DISCOVER_PROFILE",
  startCollection: "CREATOR_TRUST_LENS_START_COLLECTION",
  finishCollection: "CREATOR_TRUST_LENS_FINISH_COLLECTION",
  cancelCollection: "CREATOR_TRUST_LENS_CANCEL_COLLECTION",
  captureProgress: "CREATOR_TRUST_LENS_CAPTURE_PROGRESS",
} as const;

export type CaptureProgress = {
  type: typeof MESSAGE_TYPES.captureProgress;
  postId: string;
  collected: number;
  target: number;
  status: "collecting" | "ready";
};

export type ExtensionRequest =
  | { type: typeof MESSAGE_TYPES.discoverProfile }
  | {
      type: typeof MESSAGE_TYPES.startCollection;
      postUrl?: string;
      maxComments?: number;
    }
  | { type: typeof MESSAGE_TYPES.finishCollection }
  | { type: typeof MESSAGE_TYPES.cancelCollection };

export type ExtensionResponse =
  | { ok: true; kind: "profile"; profile: DiscoveredProfile }
  | {
      ok: true;
      kind: "collection";
      collected: number;
      target: number;
    }
  | { ok: true; kind: "cancelled" }
  | { ok: true; kind: "post"; post: CapturedPost }
  | { ok: false; error: string };

export type ExtensionRuntimeMessage = ExtensionRequest | CaptureProgress;
