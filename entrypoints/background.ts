import ExtPay from "extpay";
import { EXTENSION_PAY_ID } from "../lib/billing/config";

export default defineBackground(() => {
  ExtPay(EXTENSION_PAY_ID).startBackground();

  chrome.runtime.onInstalled.addListener(() => {
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  });
});
