import type { ExtensionRequest, ExtensionResponse } from "../lib/messages";
import { MESSAGE_TYPES } from "../lib/messages";
import {
  captureInstagramPost,
  discoverInstagramProfile,
} from "../lib/platforms/instagram";

export default defineContentScript({
  matches: ["https://www.instagram.com/*"],
  main() {
    chrome.runtime.onMessage.addListener(
      (message: ExtensionRequest, _sender, sendResponse) => {
        try {
          if (message?.type === MESSAGE_TYPES.discoverProfile) {
            const profile = discoverInstagramProfile(document, location);
            const response: ExtensionResponse = {
              ok: true,
              kind: "profile",
              profile,
            };
            sendResponse(response);
            return;
          }

          if (message?.type === MESSAGE_TYPES.capturePost) {
            const post = captureInstagramPost(document, location);
            const response: ExtensionResponse = {
              ok: true,
              kind: "post",
              post,
            };
            sendResponse(response);
          }
        } catch (error) {
          const response: ExtensionResponse = {
            ok: false,
            error: error instanceof Error ? error.message : "Unable to scan this page.",
          };
          sendResponse(response);
        }
      },
    );
  },
});
