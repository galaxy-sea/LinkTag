import { ChevronDown, Copy, ExternalLink, Settings, X } from "lucide-react";
import { type ChangeEvent, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@linktag/ui";

import { ShortcutRecorder } from "../../components/ShortcutRecorder";
import type { BackupProvider, GroupOpenMode, LinkView, TagDisplayFormat, WindowGroupLayout } from "../../types";

export type BackupStatus = {
  type: "idle" | "running" | "success" | "error";
  message: string;
  url?: string;
};

export type ImportKind = "linktag-json" | "browser-bookmarks" | "taby-json";

export function SettingsDialog({
  triggerLabel,
  triggerLabelVisible,
  triggerClassName,
  open,
  onOpenChange,
  linkView,
  onLinkViewChange,
  showWindowGroupLayoutSelector,
  windowGroupLayout,
  onWindowGroupLayoutChange,
  tagDisplayFormat,
  onTagDisplayFormatChange,
  filterWindowLinks,
  onFilterWindowLinksChange,
  showGroupOpenModeSetting,
  groupOpenMode,
  onGroupOpenModeChange,
  graphShortcut,
  onGraphShortcutChange,
  searchShortcut,
  onSearchShortcutChange,
  collectShortcut,
  onOpenShortcutSettings,
  backupProvider,
  onBackupProviderChange,
  backupGithubToken,
  onBackupGithubTokenChange,
  backupGiteeToken,
  onBackupGiteeTokenChange,
  showLocalBookmarkBackupSetting,
  localBookmarkBackupEnabled,
  onLocalBookmarkBackupEnabledChange,
  currentBackupGistHref,
  lastSyncTimeText,
  backupStatus,
  importFileInputRef,
  importAccept,
  onImportFileChange,
  importMenuOpen,
  onImportMenuOpenChange,
  onOpenImportFilePicker,
  exportMenuOpen,
  onExportMenuOpenChange,
  canReadBrowserBookmarks,
  onReadBrowserBookmarks,
  onExportJson,
  onExportBrowserBookmarks,
  onRequestRestore,
  onBackup,
}: {
  triggerLabel?: ReactNode;
  triggerLabelVisible?: boolean;
  triggerClassName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkView: LinkView;
  onLinkViewChange: (value: LinkView) => void;
  showWindowGroupLayoutSelector: boolean;
  windowGroupLayout: WindowGroupLayout;
  onWindowGroupLayoutChange: (value: WindowGroupLayout) => void;
  tagDisplayFormat: TagDisplayFormat;
  onTagDisplayFormatChange: (value: TagDisplayFormat) => void;
  filterWindowLinks: boolean;
  onFilterWindowLinksChange: (enabled: boolean) => void;
  showGroupOpenModeSetting: boolean;
  groupOpenMode: GroupOpenMode;
  onGroupOpenModeChange: (value: GroupOpenMode) => void;
  graphShortcut: string;
  onGraphShortcutChange: (value: string) => void;
  searchShortcut: string;
  onSearchShortcutChange: (value: string) => void;
  collectShortcut?: string;
  onOpenShortcutSettings?: () => void;
  backupProvider: BackupProvider;
  onBackupProviderChange: (value: BackupProvider) => void;
  backupGithubToken: string;
  onBackupGithubTokenChange: (value: string) => void;
  backupGiteeToken: string;
  onBackupGiteeTokenChange: (value: string) => void;
  showLocalBookmarkBackupSetting: boolean;
  localBookmarkBackupEnabled: boolean;
  onLocalBookmarkBackupEnabledChange: (enabled: boolean) => void;
  currentBackupGistHref: string;
  lastSyncTimeText: string;
  backupStatus: BackupStatus;
  importFileInputRef: RefObject<HTMLInputElement | null>;
  importAccept: string;
  onImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  importMenuOpen: boolean;
  onImportMenuOpenChange: (open: boolean) => void;
  onOpenImportFilePicker: (kind: ImportKind) => void;
  exportMenuOpen: boolean;
  onExportMenuOpenChange: (open: boolean) => void;
  canReadBrowserBookmarks: boolean;
  onReadBrowserBookmarks: () => void;
  onExportJson: () => void;
  onExportBrowserBookmarks: () => void;
  onRequestRestore: () => void;
  onBackup: () => void;
}) {
  const running = backupStatus.type === "running";
  const [webLinkCopied, setWebLinkCopied] = useState(false);
  const [webLinkError, setWebLinkError] = useState("");
  const [shortcutSettingsOpen, setShortcutSettingsOpen] = useState(false);
  const previousOpenRef = useRef(open);
  const currentBackupToken = backupProvider === "github" ? backupGithubToken : backupGiteeToken;
  const syncSettingsConfigured = Boolean(
    currentBackupToken.trim() || (showLocalBookmarkBackupSetting && localBookmarkBackupEnabled),
  );
  const [syncSettingsOpen, setSyncSettingsOpen] = useState(!syncSettingsConfigured);
  const tokenHelpHref =
    backupProvider === "github"
      ? "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens"
      : "https://gitee.com/profile/personal_access_tokens";
  const copyWebBackupLink = async () => {
    if (!currentBackupToken.trim()) {
      setWebLinkCopied(false);
      setWebLinkError("需要配置远程配置");
      window.setTimeout(() => setWebLinkError(""), 2400);
      return;
    }
    const url = new URL("https://tag.wcj.plus");
    url.searchParams.set("type", backupProvider);
    url.searchParams.set("Token", currentBackupToken.trim());
    const copied = await copyText(url.toString());
    setWebLinkCopied(copied);
    setWebLinkError(copied ? "" : "剪切板写入失败");
    window.setTimeout(
      () => {
        setWebLinkCopied(false);
        setWebLinkError("");
      },
      copied ? 1600 : 2400,
    );
  };
  useEffect(() => {
    if (open && !previousOpenRef.current) setSyncSettingsOpen(!syncSettingsConfigured);
    previousOpenRef.current = open;
  }, [open, syncSettingsConfigured]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button
        className={cn(
          triggerLabel ? "h-9 min-w-0 justify-start gap-2 bg-transparent px-0 text-muted-foreground" : "h-8 w-8",
          triggerClassName,
        )}
        data-ui-name="设置按钮"
        variant="ghost"
        size={triggerLabel ? "sm" : "icon"}
        onClick={() => onOpenChange(true)}
        aria-label="设置"
        title="设置"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
          <Settings className="h-4 w-4" />
        </span>
        {triggerLabel ? (
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm font-medium transition-opacity",
              triggerLabelVisible ? "opacity-100" : "opacity-0",
            )}
          >
            {triggerLabel}
          </span>
        ) : null}
      </Button>
      <DialogContent
        className="max-h-[calc(100dvh-16px)] w-[calc(100vw-16px)] max-w-[520px] gap-3 overflow-y-auto p-4 sm:max-h-[calc(100dvh-32px)] sm:p-5"
        data-ui-name="设置弹窗"
      >
        <div className="flex min-w-0 items-center justify-between gap-3" data-ui-name="设置弹窗标题栏">
          <DialogTitle className="min-w-0 flex-1 truncate text-base font-semibold">设置</DialogTitle>
          <DialogClose asChild>
            <Button data-ui-name="设置关闭按钮" variant="ghost" size="icon" aria-label="关闭设置" title="关闭设置">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </div>
        <div
          className="order-2 grid gap-3 rounded-md border border-border bg-background p-3"
          data-ui-name="页面展示设置"
        >
          <div className="text-sm font-semibold" data-ui-name="页面展示设置标题">
            页面展示
          </div>
          <div className="grid gap-2" data-ui-name="链接展示样式设置">
            <Label htmlFor="link-view">链接展示样式</Label>
            <Select value={linkView} onValueChange={(value) => onLinkViewChange(value as LinkView)}>
              <SelectTrigger id="link-view" data-ui-name="链接展示样式选择器">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="list">List</SelectItem>
                <SelectItem value="grid">Grid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showWindowGroupLayoutSelector ? (
            <div className="grid gap-2" data-ui-name="窗口分组布局设置">
              <Label htmlFor="window-group-layout">窗口分组布局</Label>
              <Select
                value={windowGroupLayout}
                onValueChange={(value) => onWindowGroupLayoutChange(value as WindowGroupLayout)}
              >
                <SelectTrigger id="window-group-layout" data-ui-name="窗口分组布局选择器">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">顶部展示</SelectItem>
                  <SelectItem value="top-hover">顶部收纳</SelectItem>
                  <SelectItem value="right">右侧展示</SelectItem>
                  <SelectItem value="right-hover">右侧收纳</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid gap-2" data-ui-name="标签展示格式设置">
            <Label htmlFor="tag-display-format">标签展示格式</Label>
            <Select
              value={tagDisplayFormat}
              onValueChange={(value) => onTagDisplayFormatChange(value as TagDisplayFormat)}
            >
              <SelectTrigger id="tag-display-format" data-ui-name="标签展示格式选择器">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tag">标签名称</SelectItem>
                <SelectItem value="relation">关系名称</SelectItem>
                <SelectItem value="tag-relation">标签关系</SelectItem>
                <SelectItem value="relation-tag">关系标签</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2"
            data-ui-name="窗口链接参与过滤设置"
          >
            <span className="text-sm font-medium">窗口链接参与过滤</span>
            <input
              checked={filterWindowLinks}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
              data-ui-name="窗口链接参与过滤开关"
              type="checkbox"
              onChange={(event) => onFilterWindowLinksChange(event.target.checked)}
            />
          </label>
          {showGroupOpenModeSetting ? (
            <label
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2"
              data-ui-name="分组打开链接设置"
            >
              <span className="text-sm font-medium">分组打开链接</span>
              <input
                checked={groupOpenMode === "tab-group"}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
                data-ui-name="分组打开链接开关"
                type="checkbox"
                onChange={(event) => onGroupOpenModeChange(event.target.checked ? "tab-group" : "tabs")}
              />
            </label>
          ) : null}
        </div>
        <div
          className="order-2 grid gap-3 rounded-md border border-border bg-background p-3"
          data-ui-name="快捷键设置"
          onClick={() => {
            if (!shortcutSettingsOpen) setShortcutSettingsOpen(true);
          }}
        >
          <div
            className="flex h-8 w-full items-center justify-between gap-3 text-left text-sm font-semibold"
            data-ui-name="快捷键设置标题"
            role="button"
            tabIndex={0}
            aria-expanded={shortcutSettingsOpen}
            onClick={(event) => {
              event.stopPropagation();
              setShortcutSettingsOpen((open) => !open);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              setShortcutSettingsOpen((open) => !open);
            }}
          >
            快捷键
            <ChevronDown className={cn("h-4 w-4 transition-transform", shortcutSettingsOpen && "rotate-180")} />
          </div>
          {shortcutSettingsOpen ? (
            <div className="grid gap-3" data-ui-name="快捷键设置内容">
              <div className="grid gap-2" data-ui-name="关系图快捷键设置">
                <Label htmlFor="graph-shortcut">关系图快捷键</Label>
                <ShortcutRecorder
                  id="graph-shortcut"
                  value={graphShortcut}
                  onChange={onGraphShortcutChange}
                  defaultValue="Mod+G"
                />
              </div>
              <div className="grid gap-2" data-ui-name="搜索快捷键设置">
                <Label htmlFor="search-shortcut">搜索快捷键</Label>
                <ShortcutRecorder
                  id="search-shortcut"
                  value={searchShortcut}
                  onChange={onSearchShortcutChange}
                  defaultValue="Mod+F"
                />
              </div>
              {onOpenShortcutSettings ? (
                <div className="grid gap-2" data-ui-name="快速收藏快捷键设置">
                  <Label>快速收藏快捷键</Label>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
                    <span className="text-sm font-medium" data-ui-name="快速收藏快捷键当前值">
                      {collectShortcut || "未设置"}
                    </span>
                    <Button
                      data-ui-name="快速收藏快捷键修改按钮"
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onOpenShortcutSettings}
                    >
                      修改
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div
          className="order-1 grid gap-3 rounded-md border border-border bg-background p-3"
          data-ui-name="同步导入导出设置"
        >
          <div
            className="flex min-w-0 cursor-pointer flex-wrap items-center justify-between gap-2"
            data-ui-name="远程备份设置标题行"
            onClick={() => setSyncSettingsOpen((current) => !current)}
          >
            <div
              className="flex h-8 w-fit flex-none items-center justify-start text-left text-sm font-semibold"
              data-ui-name="远程备份设置标题"
              role="button"
              tabIndex={0}
              aria-expanded={syncSettingsOpen}
              onClick={(event) => {
                event.stopPropagation();
                setSyncSettingsOpen((current) => !current);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                setSyncSettingsOpen((current) => !current);
              }}
            >
              <span>远程备份</span>
            </div>
            <div
              className="flex min-w-0 items-center justify-end gap-2"
              data-ui-name="Web网页同步链接操作区"
              onClick={(event) => event.stopPropagation()}
            >
              {webLinkError ? (
                <span
                  className="min-w-0 truncate text-xs font-medium text-destructive"
                  data-ui-name="复制Web网页同步链接提示"
                >
                  {webLinkError}
                </span>
              ) : null}
              <Button
                data-ui-name="复制Web网页同步链接按钮"
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyWebBackupLink()}
              >
                <Copy className="h-4 w-4" />
                {webLinkCopied ? "已复制" : "复制 Web 链接"}
              </Button>
              <Button
                data-ui-name="远程备份设置展开按钮"
                type="button"
                variant="ghost"
                size="icon"
                className="hover:bg-transparent active:bg-transparent"
                aria-expanded={syncSettingsOpen}
                onClick={() => setSyncSettingsOpen((current) => !current)}
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", syncSettingsOpen && "rotate-180")} />
              </Button>
            </div>
          </div>
          {syncSettingsOpen ? (
            <>
              {showLocalBookmarkBackupSetting ? (
                <label
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2"
                  data-ui-name="本地书签同步设置"
                >
                  <span className="text-sm font-medium">本地书签同步</span>
                  <input
                    checked={localBookmarkBackupEnabled}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                    data-ui-name="本地书签同步开关"
                    type="checkbox"
                    onChange={(event) => onLocalBookmarkBackupEnabledChange(event.target.checked)}
                  />
                </label>
              ) : null}
              <div className="grid gap-2" data-ui-name="远程备份设置">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <Label htmlFor="backup-provider">远程备份</Label>
                  <a
                    data-ui-name="远程备份Token帮助链接"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                    href={tokenHelpHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    创建 Token
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                <Select
                  value={backupProvider}
                  onValueChange={(value) => onBackupProviderChange(value as BackupProvider)}
                >
                  <SelectTrigger id="backup-provider" data-ui-name="远程备份选择器">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="github">GitHub Gist</SelectItem>
                    <SelectItem value="gitee">Gitee Gist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2" data-ui-name="远程同步密钥设置">
                <Label htmlFor="backup-token">
                  {backupProvider === "github" ? "GitHub Token" : "Gitee Access Token"}
                </Label>
                <Input
                  id="backup-token"
                  data-ui-name="远程同步密钥输入框"
                  type="text"
                  value={backupProvider === "github" ? backupGithubToken : backupGiteeToken}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    backupProvider === "github"
                      ? onBackupGithubTokenChange(event.target.value)
                      : onBackupGiteeTokenChange(event.target.value)
                  }
                  placeholder={backupProvider === "github" ? "需要 Gists 写入权限" : "Gitee 私人令牌"}
                />
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3" data-ui-name="远程同步状态行">
                <div className="flex min-w-0 items-center gap-2 text-xs" data-ui-name="导入导出同步状态行">
                  <span className="shrink-0 text-muted-foreground" data-ui-name="最近同步时间">
                    最近：{lastSyncTimeText}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      backupStatus.type === "error" ? "text-destructive" : "text-muted-foreground",
                    )}
                    data-ui-name="导入导出状态"
                  >
                    {backupStatus.message}
                  </span>
                  {backupStatus.url ? (
                    <a
                      className="shrink-0 font-medium text-primary underline-offset-2 hover:underline"
                      href={backupStatus.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      打开远程文件
                    </a>
                  ) : null}
                </div>
                {currentBackupGistHref ? (
                  <a
                    data-ui-name="远程同步Gist打开链接"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                    href={currentBackupGistHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开 Gist
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
              <div
                className="flex min-w-0 flex-wrap items-center justify-between gap-3"
                data-ui-name="同步导入导出操作区"
              >
                <span />
                <input
                  ref={importFileInputRef}
                  className="hidden"
                  data-ui-name="导入文件输入框"
                  type="file"
                  accept={importAccept}
                  onChange={onImportFileChange}
                />
                <div className="flex min-w-0 flex-wrap items-center gap-3" data-ui-name="导入导出操作按钮组">
                  <div className="flex items-center gap-2" data-ui-name="本地导入导出操作区">
                    <Popover open={importMenuOpen} onOpenChange={onImportMenuOpenChange}>
                      <PopoverTrigger asChild>
                        <Button data-ui-name="导入下拉按钮" type="button" variant="outline" disabled={running}>
                          导入
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-1" align="end" data-ui-name="导入分类下拉菜单">
                        <Button
                          data-ui-name="导入LinkTagJSON选项"
                          type="button"
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => onOpenImportFilePicker("linktag-json")}
                        >
                          LinkTag JSON
                        </Button>
                        {canReadBrowserBookmarks ? (
                          <Button
                            data-ui-name="直接导入浏览器书签选项"
                            type="button"
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={onReadBrowserBookmarks}
                          >
                            浏览器书签
                          </Button>
                        ) : null}
                        <Button
                          data-ui-name="导入浏览器导出书签选项"
                          type="button"
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => onOpenImportFilePicker("browser-bookmarks")}
                        >
                          浏览器书签 HTML
                        </Button>
                        <Button
                          data-ui-name="导入TabyJSON选项"
                          type="button"
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => onOpenImportFilePicker("taby-json")}
                        >
                          Taby JSON
                        </Button>
                      </PopoverContent>
                    </Popover>
                    <Popover open={exportMenuOpen} onOpenChange={onExportMenuOpenChange}>
                      <PopoverTrigger asChild>
                        <Button data-ui-name="导出下拉按钮" type="button" variant="outline" disabled={running}>
                          导出
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-1" align="end" data-ui-name="导出分类下拉菜单">
                        <Button
                          data-ui-name="导出LinkTagJSON选项"
                          type="button"
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={onExportJson}
                        >
                          LinkTag JSON
                        </Button>
                        <Button
                          data-ui-name="导出浏览器书签选项"
                          type="button"
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={onExportBrowserBookmarks}
                        >
                          浏览器书签
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div
                    className="hidden h-6 w-px bg-border sm:block"
                    data-ui-name="导入导出操作分割线"
                    aria-hidden="true"
                  />
                  <div className="flex items-center gap-2" data-ui-name="远程同步操作区">
                    <Button
                      data-ui-name="远程同步拉取按钮"
                      type="button"
                      variant="outline"
                      onClick={onRequestRestore}
                      disabled={running}
                    >
                      拉取远程
                    </Button>
                    <Button data-ui-name="远程同步按钮" type="button" onClick={onBackup} disabled={running}>
                      {running ? "处理中" : "立即同步"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
        <div className="order-2 flex justify-end">
          <DialogClose asChild>
            <Button data-ui-name="设置完成按钮">完成</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Continue to the DOM fallback below.
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "true");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  input.style.top = "0";
  document.body.appendChild(input);
  input.focus();
  input.select();
  input.setSelectionRange(0, value.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(input);
  }
}
