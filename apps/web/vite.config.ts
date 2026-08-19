import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const appSrc = fileURLToPath(new URL("../../packages/app/src", import.meta.url));

export default defineConfig({
  plugins: [react()],
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
});
