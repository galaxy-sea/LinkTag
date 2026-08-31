import { defineConfig } from "wxt";
import { fileURLToPath, URL } from "node:url";

const appSrc = fileURLToPath(new URL("../../packages/app/src", import.meta.url));

export default defineConfig({
  srcDir: ".",
  manifest: {
    name: "LinkTag",
    description: "用标签关系管理浏览器中已经打开或已经收藏的网页。",
    icons: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
    action: {
      default_icon: {
        16: "icons/icon-16.png",
        32: "icons/icon-32.png",
        48: "icons/icon-48.png",
        128: "icons/icon-128.png",
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
