import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Creator Trust Lens: Instagram Review",
    description:
      "Review Instagram creators with trust scores, comment analysis, engagement signals, and clear confidence levels.",
    permissions: ["activeTab", "sidePanel", "storage"],
    host_permissions: ["https://www.instagram.com/*"],
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
    action: {
      default_title: "Open Creator Trust Lens",
      default_icon: {
        16: "icon/16.png",
        32: "icon/32.png",
      },
    },
  },
});
