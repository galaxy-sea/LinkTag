import { ChevronDown, ChevronRight, Link2 } from "lucide-react";

import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@linktag/ui";

import { SearchBox } from "../../components/SearchBox";
import { TagComposer } from "../tags/TagComposer";
import type { BackupStatus } from "../backup/useBackupController";
import type { BrowserBookmarkImportData } from "../../backup/bookmark-import";
import type {
  BackupProvider,
  GroupOpenMode,
  LinkView,
  MainMode,
  TagDisplayFormat,
  TagGroupSort,
  TagRecord,
  TagRelationRecord,
  WindowGroupLayout,
} from "../../types";
import type { ImportKind } from "../settings/SettingsDialog";
import type { ChangeEvent, RefObject } from "react";

export function MainToolbar({
  contextText,
  graphVisible,
  onModeChange,
  linkView,
  onLinkViewChange,
  showWindowGroupLayoutSelector,
  windowGroupLayout,
  onWindowGroupLayoutChange,
  tagGroupSort,
  onTagGroupSortChange,
  tagDisplayFormat,
  onTagDisplayFormatChange,
  onCreateTag,
  allGroupsCollapsed,
  groupCollapseControlDisabled,
  onToggleAllGroups,
  query,
  onQueryChange,
  tags,
  relations,
  searchShortcut,
  settingsOpen,
  onSettingsOpenChange,
  filterWindowLinks,
  onFilterWindowLinksChange,
  showGroupOpenModeSetting,
  groupOpenMode,
  onGroupOpenModeChange,
  graphShortcut,
  onGraphShortcutChange,
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
  onPointerEnter,
  onPointerLeave,
}: {
  contextText: string;
  graphVisible: boolean;
  onModeChange: (mode: MainMode) => void;
  linkView: LinkView;
  onLinkViewChange: (value: LinkView) => void;
  showWindowGroupLayoutSelector: boolean;
  windowGroupLayout: WindowGroupLayout;
  onWindowGroupLayoutChange: (value: WindowGroupLayout) => void;
  tagGroupSort: TagGroupSort;
  onTagGroupSortChange: (value: TagGroupSort) => void;
  tagDisplayFormat: TagDisplayFormat;
  onTagDisplayFormatChange: (value: TagDisplayFormat) => void;
  onCreateTag: (name: string, color: string) => Promise<TagRecord | null>;
  allGroupsCollapsed: boolean;
  groupCollapseControlDisabled: boolean;
  onToggleAllGroups: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  tags: TagRecord[];
  relations: TagRelationRecord[];
  searchShortcut: string;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  filterWindowLinks: boolean;
  onFilterWindowLinksChange: (enabled: boolean) => void;
  showGroupOpenModeSetting: boolean;
  groupOpenMode: GroupOpenMode;
  onGroupOpenModeChange: (value: GroupOpenMode) => void;
  graphShortcut: string;
  onGraphShortcutChange: (value: string) => void;
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
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-2 md:min-h-14 md:flex-nowrap md:px-4 md:py-0"
      data-ui-name="顶部工具栏"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="hidden min-w-0 shrink-0 md:block" data-ui-name="页面标题区">
        <div className="truncate text-base font-semibold" data-ui-name="页面标题">
          标签关系图
        </div>
        <div className="truncate text-xs text-muted-foreground" data-ui-name="当前上下文">
          {contextText}
        </div>
      </div>

      <div
        className="order-2 ml-auto flex max-w-full shrink-0 items-center gap-2 overflow-x-auto pb-0.5 md:order-none md:mx-0 md:ml-2 md:w-auto md:max-w-none md:overflow-visible md:px-0 md:pb-0"
        data-ui-name="左侧工具组"
      >
        <Button
          data-ui-name="主模式切换按钮"
          variant="default"
          size="sm"
          onClick={() => onModeChange(graphVisible ? "links" : "graph")}
        >
          <Link2 className="h-4 w-4" />
          {graphVisible ? "隐藏图" : "关系图"}
        </Button>

        <TagComposer onCreate={onCreateTag} />
        <Button
          data-ui-name="全部分组切换按钮"
          variant="outline"
          size="sm"
          disabled={groupCollapseControlDisabled}
          onClick={onToggleAllGroups}
        >
          {allGroupsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {allGroupsCollapsed ? "展开" : "收起"}
        </Button>
        <Select value={tagGroupSort} onValueChange={(value) => onTagGroupSortChange(value as TagGroupSort)}>
          <SelectTrigger
            className="h-9 w-auto min-w-0 shrink-0 justify-center gap-1 bg-background px-2.5"
            data-ui-name="标签分组排序选择器"
            aria-label="标签分组排序"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            align="start"
            avoidCollisions={false}
            className="overflow-visible"
          >
            <SelectItem value="updated-desc">最近倒序</SelectItem>
            <SelectItem value="updated-asc">最近正序</SelectItem>
            <SelectItem value="weight-desc">权重倒序</SelectItem>
            <SelectItem value="weight-asc">权重正序</SelectItem>
            <SelectItem value="name-asc">名称正序</SelectItem>
            <SelectItem value="name-desc">名称倒序</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div
        className="order-3 flex w-full min-w-0 flex-none items-center justify-end gap-2 md:order-none md:ml-auto md:flex-1"
        data-ui-name="右侧工具组"
      >
        <SearchBox value={query} onChange={onQueryChange} tags={tags} relations={relations} shortcut={searchShortcut} />
      </div>
    </div>
  );
}
