import type { ExtensionRequest, ExtensionResponse } from "../lib/messages";
import { MESSAGE_TYPES } from "../lib/messages";
import {
  discoverInstagramProfile,
  loadAndCaptureInstagramPost,
} from "../lib/platforms/instagram";

export default defineContentScript({
  matches: ["https://www.instagram.com/*"],
  main() {
    chrome.runtime.onMessage.addListener(
      (message: ExtensionRequest, _sender, sendResponse) => {
        if (message?.type === MESSAGE_TYPES.discoverProfile) {
          try {
            const profile = discoverInstagramProfile(document, location);
            const response: ExtensionResponse = {
              ok: true,
              kind: "profile",
              profile,
            };
            sendResponse(response);
          } catch (error) {
            const response: ExtensionResponse = {
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to scan this page.",
            };
            sendResponse(response);
          }
          return false;
        }

        if (message?.type === MESSAGE_TYPES.capturePost) {
          void loadAndCaptureInstagramPost(document, location, message.postUrl, {
            maxComments: message.maxComments,
          })
            .then((post) => {
              const response: ExtensionResponse = {
                ok: true,
                kind: "post",
                post,
              };
              sendResponse(response);
            })
            .catch((error: unknown) => {
              const response: ExtensionResponse = {
                ok: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "Unable to scan this post.",
              };
              sendResponse(response);
            });
          return true;
        }

        return false;
      },
    );
  },
});
