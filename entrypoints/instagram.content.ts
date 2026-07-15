import type { ProfileSample } from "../lib/analysis/types";
import {
  findInstagramHandle,
  readVisibleInstagramSample,
} from "../lib/platforms/instagram";

export default defineContentScript({
  matches: ["https://www.instagram.com/*"],
  main() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== "CREATOR_TRUST_LENS_SCAN_VISIBLE") return;

      try {
        const sample: ProfileSample = readVisibleInstagramSample(document, location);
        sendResponse({ ok: true, sample });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Unable to scan this page.",
          handle: findInstagramHandle(location.pathname),
        });
      }

      return true;
    });
  },
});
