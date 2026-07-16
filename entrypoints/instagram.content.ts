import type { ExtensionRequest, ExtensionResponse } from "../lib/messages";
import { MESSAGE_TYPES } from "../lib/messages";
import {
  createPassiveInstagramCollector,
  discoverInstagramProfile,
} from "../lib/platforms/instagram";
import type { PassiveInstagramCollector } from "../lib/platforms/instagram";

export default defineContentScript({
  matches: ["https://www.instagram.com/*"],
  main() {
    let collector: PassiveInstagramCollector | undefined;

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

        if (message?.type === MESSAGE_TYPES.startCollection) {
          try {
            collector?.cancel();
            collector = createPassiveInstagramCollector(
              document,
              location,
              message.postUrl,
              {
                maxComments: message.maxComments,
                onProgress: (progress) => {
                  void chrome.runtime
                    .sendMessage({
                      type: MESSAGE_TYPES.captureProgress,
                      ...progress,
                    })
                    .catch(() => undefined);
                },
              },
            );
            const progress = collector.getProgress();
            sendResponse({
              ok: true,
              kind: "collection",
              collected: progress.collected,
              target: progress.target,
            } satisfies ExtensionResponse);
          } catch (error) {
            sendResponse({
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to start comment collection.",
            } satisfies ExtensionResponse);
          }
          return false;
        }

        if (message?.type === MESSAGE_TYPES.finishCollection) {
          try {
            if (!collector) {
              throw new Error("Start passive collection on this post first.");
            }
            const post = collector.finish();
            collector = undefined;
            sendResponse({
              ok: true,
              kind: "post",
              post,
            } satisfies ExtensionResponse);
          } catch (error) {
            sendResponse({
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to save this comment sample.",
            } satisfies ExtensionResponse);
          }
          return false;
        }

        if (message?.type === MESSAGE_TYPES.cancelCollection) {
          collector?.cancel();
          collector = undefined;
          sendResponse({
            ok: true,
            kind: "cancelled",
          } satisfies ExtensionResponse);
          return false;
        }

        return false;
      },
    );
  },
});
