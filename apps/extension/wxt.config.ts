import { defineConfig } from "wxt";
import { fileURLToPath, URL } from "node:url";

const appSrc = fileURLToPath(new URL("../../packages/app/src", import.meta.url));

export default defineConfig({
  srcDir: ".",
  manifest: {
    name: "LinkTag",
    description: "用标签关系管理浏览器中已经打开或已经收藏的网页。",
    icons: {
      16: "icon.svg",
      32: "icon.svg",
      48: "icon.svg",
      128: "icon.svg",
    },
    action: {
      default_icon: {
        16: "icon.svg",
        32: "icon.svg",
        48: "icon.svg",
        128: "icon.svg",
      },
    },
    permissions: ["tabs", "tabGroups", "bookmarks", "storage"],
    commands: {
      "collect-current-page": {
        suggested_key: {
          default: "Alt+E",
          mac: "Alt+D",
        },
        description: "收藏当前页面到 LinkTag",
      },
    },
  },
  vite: () => ({
    resolve: {
      alias: [
        { find: /^@linktag\/app$/, replacement: `${appSrc}/index.ts` },
        { find: /^@linktag\/app\/(.*)$/, replacement: `${appSrc}/$1` },
        {
          find: /^@linktag\/ui$/,
          replacement: fileURLToPath(new URL("../../packages/ui/src/index.tsx", import.meta.url)),
        },
      ],
    },
    server: {
      host: "0.0.0.0",
    },
  }),
});
