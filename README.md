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

## Cloudflare Pages 部署

Cloudflare 网页登录回调不稳定时，不要使用 `wrangler login`，改用 API Token。

1. 在 Cloudflare 创建 API Token，至少需要 Pages 项目的编辑权限。
2. 配置环境变量，可以使用操作系统环境变量，也可以复制 `apps/web/.env.example` 为 `apps/web/.env`：

```bash
CLOUDFLARE_ACCOUNT_ID=你的 Account ID
CLOUDFLARE_API_TOKEN=你的 API Token
```

3. 在项目根目录执行：

```bash
pnpm deploy:cloudflare
```

该命令会先构建 Web 产物，再用 Wrangler 上传 `apps/web/dist` 到 Cloudflare Pages 项目 `linktag`。
