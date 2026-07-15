import type { CapturedPost, DiscoveredProfile } from "./analysis/types";

export const MESSAGE_TYPES = {
  discoverProfile: "CREATOR_TRUST_LENS_DISCOVER_PROFILE",
  capturePost: "CREATOR_TRUST_LENS_CAPTURE_POST",
} as const;

export type ExtensionRequest =
  | { type: typeof MESSAGE_TYPES.discoverProfile }
  | { type: typeof MESSAGE_TYPES.capturePost };

export type ExtensionResponse =
  | { ok: true; kind: "profile"; profile: DiscoveredProfile }
  | { ok: true; kind: "post"; post: CapturedPost }
  | { ok: false; error: string };
