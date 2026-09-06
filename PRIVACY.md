# LinkTag Privacy Policy / 隐私权政策

Effective Date / 生效日期: 2026-09-06

## English

LinkTag manages opened and saved web pages through tag relationships. LinkTag is local-first by default. It does not operate its own server, sell user data, serve ads, or track user behavior.

### 1. Data Stored by LinkTag

LinkTag may store the following data on the user's device:

- Link information: URL, title, and note.
- Tag information: tag name, color, sort order, and expanded or collapsed state.
- Bindings between links and tags.
- Relationship names and directions between tags.
- Application settings: display mode, graph layout, shortcuts, sync configuration, and similar settings.
- Sync metadata: software version, data version, last sync time, and runtime information.

This data is mainly stored in the browser's IndexedDB and localStorage.

### 2. Browser Permission Usage

The LinkTag browser extension requests the following permissions:

- `tabs`: to read currently opened tabs and windows, display window groups and open pages on the LinkTag home page, and support saving the current page.
- `tabGroups`: to create browser Tab Groups and set group names and colors when opening multiple links as a group.
- `bookmarks`: to import browser bookmarks and, when local bookmark sync is enabled, sync LinkTag data to a LinkTag folder in browser bookmarks.
- `storage`: to save sync configuration such as remote backup provider, access token, and Gist ID, so users can restore sync settings under the same browser account.

LinkTag does not read page body content, form contents, passwords, cookies, or browsing history.

### 3. Remote Backup and Sync

Users may choose to configure GitHub Gist or Gitee Gist for remote backup and sync.

When remote backup is enabled, LinkTag uploads links, tags, link-tag bindings, tag relationships, and sync metadata to the user's own Gist. Remote backup is performed by directly accessing the selected platform API with the GitHub Token or Gitee Access Token provided by the user.

LinkTag does not send remote backup data to any LinkTag-owned server. Data handling by remote platforms is governed by GitHub's or Gitee's own privacy policies.

Remote access tokens are stored in browser local storage. In the extension environment, they may also be stored in `chrome.storage.sync` or compatible browser sync storage, so users can restore sync settings after reinstalling the browser or switching devices. Do not configure remote access tokens on untrusted devices.

### 4. Local Bookmark Sync

Users may enable local bookmark sync. When enabled, LinkTag syncs current LinkTag data to a `LinkTag` folder in the browser bookmarks.

Local bookmark sync writes only to the user's browser bookmark system and does not upload data to a LinkTag server. Any bookmark sync performed by the browser account itself is controlled by the browser vendor.

### 5. Import and Export

LinkTag supports importing and exporting formats such as JSON and browser bookmarks. Imported files are parsed and written to the local database only in the user's current browser. Exported files are saved and managed by the user.

In Web mode, LinkTag supports importing remote sync configuration through URL parameters, such as backup provider and access token. After reading and saving these settings, LinkTag removes the related parameters from the address bar to reduce the risk of continued token exposure.

### 6. Website Icons

When displaying link cards, LinkTag may try to load website icons from the following sources:

- The favicon provided by the browser for the current tab.
- The target site's own `/favicon.ico`.
- `https://a.favicon.im/`.
- `https://www.google.com/s2/favicons`.

When these icon services are requested, the services may see the requested website domain. LinkTag does not intentionally send user tags, notes, relationship names, or the full database to these icon services.

### 7. Data Deletion

Users can delete links, tags, link-tag bindings, and tag relationships in LinkTag. After deletion, the corresponding data is removed from local IndexedDB.

If remote backup or local bookmark sync is enabled, later sync operations may sync the deletion result to the remote Gist or browser bookmarks. Users may also delete the remote Gist, browser bookmark folder, or browser site data to remove LinkTag data.

### 8. Data Security

LinkTag attempts to keep data on the user's device and in remote accounts configured by the user. Remote access tokens are sensitive information. Users should protect them carefully and grant only the minimum permissions required for Gist backup.

Because LinkTag data is stored in the browser environment, the same browser user, browser extensions, operating system account, or software with local device access may be able to access related local data. Use LinkTag only on trusted devices.

### 9. Changes to This Privacy Policy

This Privacy Policy may be updated when LinkTag functionality changes. Updated versions will be provided with the project files or release package.

### 10. Contact

If you have questions about this Privacy Policy or LinkTag's data handling practices, please contact the maintainer through the project repository, release page, or contact channel provided by the application.

## 中文

LinkTag 用标签关系管理浏览器中已经打开或已经收藏的网页。LinkTag 默认本地优先运行，不运营独立服务器，不出售用户数据，不投放广告，不做用户行为追踪。

### 1. LinkTag 保存的数据

LinkTag 会在用户本机保存以下数据：

- 链接信息：URL、标题、备注。
- 标签信息：标签名称、颜色、排序、展开或收纳状态。
- 链接和标签的绑定关系。
- 标签之间的关系名称和方向。
- 应用设置：页面展示方式、关系图布局、快捷键、同步配置等。
- 同步元数据：软件版本、数据版本、最近同步时间、运行环境信息。

这些数据主要保存在浏览器的 IndexedDB 和 localStorage 中。

### 2. 浏览器权限用途

LinkTag 浏览器插件会请求以下权限：

- `tabs`：读取当前打开的标签页和窗口信息，在 LinkTag 首页展示窗口分组和已打开网页，并支持收藏当前网页。
- `tabGroups`：按分组打开多个链接时，创建浏览器 Tab Group，并设置分组名称和颜色。
- `bookmarks`：导入浏览器书签；开启本地书签同步时，将 LinkTag 数据同步到浏览器书签中的 LinkTag 文件夹。
- `storage`：保存远程备份类型、访问令牌、Gist ID 等同步配置，便于用户在同一浏览器账号下恢复同步设置。

LinkTag 不会读取网页正文、表单内容、密码、Cookie 或浏览历史记录。

### 3. 远程备份与同步

用户可以选择配置 GitHub Gist 或 Gitee Gist 进行远程备份和同步。

启用远程备份后，LinkTag 会把链接、标签、绑定关系、标签关系和同步元数据上传到用户自己的 Gist 中。远程备份由用户提供的 GitHub Token 或 Gitee Access Token 直接访问对应平台 API 完成。

LinkTag 不会把远程备份数据发送到 LinkTag 自有服务器。远程平台如何处理数据，受 GitHub 或 Gitee 各自隐私政策约束。

远程访问令牌会保存在浏览器本地存储中；在插件环境中，也可能保存到 `chrome.storage.sync` 或兼容浏览器的同步存储中，以便用户重新安装浏览器或切换设备后恢复同步配置。请不要在不可信设备上配置远程访问令牌。

### 4. 本地书签同步

用户可以开启本地书签同步。开启后，LinkTag 会把当前 LinkTag 数据同步到浏览器书签中的 `LinkTag` 文件夹。

本地书签同步只写入用户浏览器的书签系统，不会上传到 LinkTag 服务器。浏览器账号自身的书签同步行为由浏览器厂商控制。

### 5. 导入与导出

LinkTag 支持导入和导出 JSON、浏览器书签等格式。导入文件只在用户当前浏览器中解析和写入本地数据库。导出文件由用户自行保存和管理。

Web 模式支持通过 URL 参数导入远程同步配置，例如备份类型和访问令牌。LinkTag 读取并保存这些配置后，会从地址栏移除相关参数，减少令牌继续暴露在地址栏中的风险。

### 6. 网站图标

LinkTag 展示链接卡片时会尝试加载网站图标。图标来源可能包括：

- 浏览器提供的当前标签页图标。
- 目标网站自身的 `/favicon.ico`。
- `https://a.favicon.im/`。
- `https://www.google.com/s2/favicons`。

请求这些图标服务时，相关服务可能看到被请求的网站域名。LinkTag 不会主动向这些服务发送用户的标签、备注、关系名称或完整数据库。

### 7. 数据删除

用户可以在 LinkTag 中删除链接、标签、绑定关系和标签关系。删除后，对应数据会从本地 IndexedDB 中移除。

如果用户启用了远程备份或本地书签同步，后续同步可能会把删除结果同步到远程 Gist 或浏览器书签中。用户也可以自行删除远程 Gist、浏览器书签文件夹，或清除浏览器站点数据来移除 LinkTag 数据。

### 8. 数据安全

LinkTag 尽量把数据保留在用户本地和用户自己配置的远程账号中。远程访问令牌属于敏感信息，用户应妥善保管，并只授予完成 Gist 备份所需的最小权限。

由于 LinkTag 数据保存在浏览器环境中，同一浏览器用户、浏览器扩展、操作系统账号或具备本机访问权限的软件，可能能够访问相关本地数据。请在可信设备上使用 LinkTag。

### 9. 隐私权政策更新

LinkTag 功能变化时，本隐私权政策可能会更新。更新后的版本会随项目文件或发布版本一起提供。

### 10. 联系方式

如对隐私权政策或数据处理方式有疑问，请通过项目仓库、发布页面或应用提供的联系方式联系维护者。
