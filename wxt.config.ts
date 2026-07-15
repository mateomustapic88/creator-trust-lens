import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Creator Trust Lens",
    description:
      "Inspect public Instagram engagement signals and review the evidence behind a profile trust score.",
    permissions: ["activeTab", "sidePanel", "storage"],
    host_permissions: ["https://www.instagram.com/*"],
    action: {
      default_title: "Open Creator Trust Lens",
    },
  },
});
