# LinkTag

LinkTag 用标签关系管理浏览器中已经打开或已经收藏的网页。

## 开发

```bash
pnpm install
pnpm dev:web
pnpm dev:extension
```

Web App 默认运行在 `http://localhost:5173/`。浏览器插件使用 WXT 开发服务器。

## 验证

```bash
pnpm typecheck
pnpm build
```

插件构建产物位于 `apps/extension/.output/chrome-mv3/`，可在 Chromium 系浏览器的扩展管理页中以“加载已解压的扩展程序”方式加载。
