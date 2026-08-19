import { useCallback, useEffect, useMemo, useState } from "react";

import { type BrowserBookmarkExportData, type BrowserBookmarkImportData } from "./backup/bookmark-import";
import {
  createRuntimeInfo,
  db,
  ensureCollection,
  ensureMetadata,
  getActiveCollectionId,
  markLocalDataChanged,
  nowIso,
} from "./db";
import { sortValuesForOrder } from "./core/sort";
import { useBadgeFilters } from "./core/useBadgeFilters";
import { useLinkTagData } from "./features/app/useLinkTagData";
import { BackupConfirmDialogs } from "./features/backup/BackupConfirmDialogs";
import { CollectionDrawer } from "./features/collections/CollectionDrawer";
import { GraphFloatingWindow } from "./features/graph/GraphFloatingWindow";
import { GraphMode } from "./features/graph/GraphMode";
import { GraphWindowControls } from "./features/graph/GraphWindowControls";
import { preventNativeContextMenu } from "./core/layer-events";
import { LinkMode } from "./features/link-mode/LinkMode";
import { useToolbarWindowGroups } from "./features/link-mode/useToolbarWindowGroups";
import { MainToolbar } from "./features/layout/MainToolbar";
import { useBackupController } from "./features/backup/useBackupController";
import { RelationDialog } from "./features/tags/RelationDialog";
import { SettingsDialog } from "./features/settings/SettingsDialog";
import { SyncSetupPrompt } from "./features/settings/SyncSetupPrompt";
import { useAppSettings } from "./features/settings/useAppSettings";
import { shortcutMatchesEvent } from "./core/shortcuts";
import { TagConfirmDialogs } from "./features/tags/TagConfirmDialogs";
import { useTagActions } from "./features/tags/useTagActions";
import { TagEditDialog } from "./features/tags/TagEditDialog";
import type { AppRuntime, BrowserWindow, GroupOpenMode, Id, LinkRecord, TagRecord, TagRelationRecord } from "./types";

export interface AppProps {
  browserWindows?: BrowserWindow[];
  runtime?: AppRuntime;
  showWindowGroupLayoutSelector?: boolean;
  readBrowserBookmarks?: () => Promise<BrowserBookmarkImportData>;
  writeBrowserBookmarkBackup?: (data: BrowserBookmarkExportData) => Promise<void>;
  collectShortcut?: string;
  onOpenShortcutSettings?: () => void;
  onOpenLinks?: (links: LinkRecord[], title: string, mode: GroupOpenMode) => void | Promise<void>;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
}

export function App({
  browserWindows,
  runtime = "web",
  showWindowGroupLayoutSelector = true,
  readBrowserBookmarks,
  writeBrowserBookmarkBackup,
  collectShortcut,
  onOpenShortcutSettings,
  onOpenLinks,
}: AppProps = {}) {
  const {
    initialSettings,
    mode,
    setMode,
    changeMode,
    linkView,
    windowGroupLayout,
    tagGroupSort,
    tagDisplayFormat,
    filterWindowLinks,
    groupOpenMode,
    elkLayout,
    edgeLineType,
    graphShortcut,
    searchShortcut,
    backupProvider,
    backupGithubToken,
    backupGiteeToken,
    backupGithubGist,
    backupGiteeGist,
    localBookmarkBackupEnabled,
    syncSetupPromptDismissed,
    backupSettingsLoaded,
    currentBackupGistHref,
    saveLinkView,
    saveWindowGroupLayout,
    saveTagGroupSort,
    saveTagDisplayFormat,
    saveFilterWindowLinks,
    saveGroupOpenMode,
    saveElkLayout,
    saveEdgeLineType,
    saveGraphShortcut,
    saveSearchShortcut,
    saveBackupProvider,
    saveBackupGithubToken,
    saveBackupGiteeToken,
    saveLocalBookmarkBackupEnabled,
    saveSyncSetupPromptDismissed,
    saveBackupGistForProvider,
    saveBackupGist,
  } = useAppSettings(runtime);
  const runtimeInfo = useMemo(() => createRuntimeInfo(runtime), [runtime]);
  const [collectionId, setCollectionId] = useState(() => getActiveCollectionId());
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 180);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncSetupPromptOpen, setSyncSetupPromptOpen] = useState(false);
  const { liveData, data, tagLinkCountsByTagId, tagsById, windows } = useLinkTagData(browserWindows, collectionId);
  const { badgeFilters, toggleBadgeFilter, clearBadgeFilters } = useBadgeFilters();
  const { toolbarWindowGroupsOpen, openToolbarWindowGroups, closeToolbarWindowGroups } = useToolbarWindowGroups();
  const [collapsedWindowGroups, setCollapsedWindowGroups] = useState<Record<string, boolean>>({});
  const [collapsedTagIds, setCollapsedTagIds] = useState<Set<Id>>(() => new Set());
  const windowGroupKeys = useMemo(
    () => windows.filter((window) => window.tabs.length > 0).map((window) => `window:${window.id}`),
    [windows],
  );
  const hasGroups = data.tags.length > 0 || windowGroupKeys.length > 0;
  const allGroupsCollapsed =
    hasGroups &&
    data.tags.every((tag) => collapsedTagIds.has(tag.id)) &&
    windowGroupKeys.every((key) => collapsedWindowGroups[key]);

  useEffect(() => {
    void Promise.all([ensureCollection(collectionId), ensureMetadata(runtimeInfo)]);
  }, [collectionId, runtimeInfo]);

  useEffect(() => {
    setCollapsedTagIds(new Set(data.tags.filter((tag) => tag.collapsed).map((tag) => tag.id)));
  }, [data.tags]);

  const toggleWindowGroup = useCallback((key: string) => {
    setCollapsedWindowGroups((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  const toggleTagGroup = useCallback(
    (tagId: Id) => {
      setCollapsedTagIds((current) => {
        const next = new Set(current);
        const collapsed = !next.has(tagId);
        if (collapsed) next.add(tagId);
        else next.delete(tagId);
        void db.tags.where("[collectionId+id]").equals([collectionId, tagId]).modify({ collapsed });
        return next;
      });
    },
    [collectionId],
  );

  useEffect(() => {
    if (!backupSettingsLoaded || syncSetupPromptDismissed) return;
    if (backupGithubToken.trim() || backupGiteeToken.trim()) return;
    setSyncSetupPromptOpen(true);
  }, [backupGiteeToken, backupGithubToken, backupSettingsLoaded, syncSetupPromptDismissed]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!graphShortcut || event.repeat || event.isComposing) return;
      if (isEditableTarget(event.target)) return;
      if (!shortcutMatchesEvent(graphShortcut, event)) return;
      event.preventDefault();
      setMode((current) => (current === "graph" ? "links" : "graph"));
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [graphShortcut]);

  const changeCollection = useCallback(
    (nextCollectionId: Id) => {
      setCollectionId(nextCollectionId);
      clearBadgeFilters();
      setCollapsedWindowGroups({});
    },
    [clearBadgeFilters],
  );

  const {
    backupStatus,
    setBackupStatus,
    importMenuOpen,
    setImportMenuOpen,
    exportMenuOpen,
    setExportMenuOpen,
    restoreConfirmOpen,
    setRestoreConfirmOpen,
    importPayload,
    setImportPayload,
    importBookmarkData,
    setImportBookmarkData,
    importBookmarkCollectionId,
    setImportBookmarkCollectionId,
    importBookmarkSourceName,
    backupConflict,
    missingGistConfirm,
    setMissingGistConfirm,
    invalidTokenConfirm,
    setInvalidTokenConfirm,
    importFileInputRef,
    importAccept,
    lastSyncTimeText,
    readBrowserBookmarksDirectly,
    readImportFile,
    openImportFilePicker,
    skipNextAutoBackupForUiState,
    runExportJson,
    runExportBrowserBookmarks,
    runImportJson,
    runImportBrowserBookmarks,
    runBackup,
    runRestore,
    useRemoteBackup,
    useLocalBackup,
    createReplacementGist,
  } = useBackupController({
    data,
    liveData,
    runtimeInfo,
    backupProvider,
    backupGithubToken,
    backupGiteeToken,
    backupGithubGist,
    backupGiteeGist,
    localBookmarkBackupEnabled,
    saveBackupGistForProvider,
    readBrowserBookmarks,
    writeBrowserBookmarkBackup,
    clearBadgeFilters,
    onActiveCollectionChange: changeCollection,
  });

  const setAllGroupsCollapsed = useCallback(
    (collapsed: boolean) => {
      if (data.tags.length > 0) skipNextAutoBackupForUiState();
      setCollapsedWindowGroups(Object.fromEntries(windowGroupKeys.map((key) => [key, collapsed])));
      setCollapsedTagIds(new Set(collapsed ? data.tags.map((tag) => tag.id) : []));
      if (data.tags.length === 0) return;
      void db.transaction("rw", db.tags, async () => {
        await db.tags.where("collectionId").equals(collectionId).modify({ collapsed });
      });
    },
    [collectionId, data.tags, skipNextAutoBackupForUiState, windowGroupKeys],
  );

  const reorderTagGroups = useCallback(
    async (orderedTags: TagRecord[]) => {
      const sortValues = sortValuesForOrder(orderedTags.map((tag) => tag.id));
      const updatedAt = nowIso();
      await db.tags.bulkPut(
        orderedTags.map((tag) => ({
          ...tag,
          sort: sortValues.get(tag.id) ?? tag.sort,
          updatedAt,
        })),
      );
      await markLocalDataChanged(runtimeInfo);
    },
    [runtimeInfo],
  );

  const reorderLinks = useCallback(
    async (orderedLinks: LinkRecord[]) => {
      const sortValues = sortValuesForOrder(orderedLinks.map((link) => link.id));
      await db.links.bulkPut(
        orderedLinks.map((link) => ({
          ...link,
          sort: sortValues.get(link.id) ?? link.sort,
        })),
      );
      await markLocalDataChanged(runtimeInfo);
    },
    [runtimeInfo],
  );

  const {
    pendingRelations,
    setPendingRelations,
    pendingRelationEndpoints,
    editingRelation,
    setEditingRelation,
    editingTag,
    setEditingTag,
    deleteTarget,
    setDeleteTarget,
    relationCleanupTarget,
    setRelationCleanupTarget,
    addTag,
    bindTagToLink,
    persistRuntimeTabLink,
    updateLink,
    requestGraphRelation,
    reversePendingRelation,
    reversePendingRelations,
    createRelations,
    updateRelation,
    reverseRelation,
    updateTag,
    requestDeleteBinding,
    requestEditTag,
    requestDeleteTag,
    confirmDelete,
    confirmRelationCleanup,
  } = useTagActions({ data, runtimeInfo, collectionId });

  const contextText = mode === "graph" ? "标签关系维护" : query.trim() ? "标签" : "标签";
  const graphVisible = mode === "graph";
  const reverseGraphRelation = useCallback(
    (relation: TagRelationRecord) => {
      void reverseRelation(relation);
    },
    [reverseRelation],
  );
  const deleteGraphRelation = useCallback((relationId: string) => {
    setDeleteTarget({ type: "relation", relationId });
  }, []);

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      data-ui-name="LinkTag主应用"
      onContextMenuCapture={preventNativeContextMenu}
    >
      <main className="flex h-screen w-full flex-col overflow-hidden" data-ui-name="主工作区">
        <MainToolbar
          contextText={contextText}
          graphVisible={graphVisible}
          onModeChange={changeMode}
          linkView={linkView}
          onLinkViewChange={saveLinkView}
          showWindowGroupLayoutSelector={showWindowGroupLayoutSelector}
          windowGroupLayout={windowGroupLayout}
          onWindowGroupLayoutChange={saveWindowGroupLayout}
          tagGroupSort={tagGroupSort}
          onTagGroupSortChange={saveTagGroupSort}
          tagDisplayFormat={tagDisplayFormat}
          onTagDisplayFormatChange={saveTagDisplayFormat}
          onCreateTag={addTag}
          allGroupsCollapsed={allGroupsCollapsed}
          groupCollapseControlDisabled={!hasGroups}
          onToggleAllGroups={() => setAllGroupsCollapsed(!allGroupsCollapsed)}
          query={query}
          onQueryChange={setQuery}
          tags={data.tags}
          relations={data.relations}
          searchShortcut={searchShortcut}
          settingsOpen={settingsOpen}
          onSettingsOpenChange={setSettingsOpen}
          filterWindowLinks={filterWindowLinks}
          onFilterWindowLinksChange={saveFilterWindowLinks}
          showGroupOpenModeSetting={Boolean(onOpenLinks)}
          groupOpenMode={groupOpenMode}
          onGroupOpenModeChange={saveGroupOpenMode}
          graphShortcut={graphShortcut}
          onGraphShortcutChange={saveGraphShortcut}
          onSearchShortcutChange={saveSearchShortcut}
          collectShortcut={collectShortcut}
          onOpenShortcutSettings={onOpenShortcutSettings}
          backupProvider={backupProvider}
          onBackupProviderChange={(value) => {
            setBackupStatus({ type: "idle", message: "" });
            saveBackupProvider(value);
          }}
          backupGithubToken={backupGithubToken}
          onBackupGithubTokenChange={saveBackupGithubToken}
          backupGiteeToken={backupGiteeToken}
          onBackupGiteeTokenChange={saveBackupGiteeToken}
          showLocalBookmarkBackupSetting={Boolean(writeBrowserBookmarkBackup)}
          localBookmarkBackupEnabled={localBookmarkBackupEnabled}
          onLocalBookmarkBackupEnabledChange={saveLocalBookmarkBackupEnabled}
          currentBackupGistHref={currentBackupGistHref}
          lastSyncTimeText={lastSyncTimeText}
          backupStatus={backupStatus}
          importFileInputRef={importFileInputRef}
          importAccept={importAccept}
          onImportFileChange={(event) => void readImportFile(event)}
          importMenuOpen={importMenuOpen}
          onImportMenuOpenChange={setImportMenuOpen}
          onOpenImportFilePicker={openImportFilePicker}
          exportMenuOpen={exportMenuOpen}
          onExportMenuOpenChange={setExportMenuOpen}
          canReadBrowserBookmarks={Boolean(readBrowserBookmarks)}
          onReadBrowserBookmarks={() => void readBrowserBookmarksDirectly()}
          onExportJson={() => {
            setExportMenuOpen(false);
            runExportJson();
          }}
          onExportBrowserBookmarks={() => {
            setExportMenuOpen(false);
            runExportBrowserBookmarks();
          }}
          onRequestRestore={() => setRestoreConfirmOpen(true)}
          onBackup={() => void runBackup()}
          onPointerEnter={openToolbarWindowGroups}
          onPointerLeave={closeToolbarWindowGroups}
        />

        <section className="relative min-h-0 flex-1 overflow-hidden bg-workspace-surface" data-ui-name="内容区">
          <CollectionDrawer
            activeCollectionId={collectionId}
            onActiveCollectionChange={changeCollection}
            onCollectionChange={async () => {
              await markLocalDataChanged(runtimeInfo);
            }}
            renderSettingsControl={(drawerExpanded, releaseDrawerTransientOpen) => (
              <SettingsDialog
                triggerLabel="设置"
                triggerLabelVisible={drawerExpanded}
                triggerClassName={drawerExpanded ? "w-full" : "w-8"}
                open={settingsOpen}
                onOpenChange={(open) => {
                  if (open) releaseDrawerTransientOpen();
                  setSettingsOpen(open);
                }}
                linkView={linkView}
                onLinkViewChange={saveLinkView}
                showWindowGroupLayoutSelector={showWindowGroupLayoutSelector}
                windowGroupLayout={windowGroupLayout}
                onWindowGroupLayoutChange={saveWindowGroupLayout}
                tagDisplayFormat={tagDisplayFormat}
                onTagDisplayFormatChange={saveTagDisplayFormat}
                filterWindowLinks={filterWindowLinks}
                onFilterWindowLinksChange={saveFilterWindowLinks}
                showGroupOpenModeSetting={Boolean(onOpenLinks)}
                groupOpenMode={groupOpenMode}
                onGroupOpenModeChange={saveGroupOpenMode}
                graphShortcut={graphShortcut}
                onGraphShortcutChange={saveGraphShortcut}
                searchShortcut={searchShortcut}
                onSearchShortcutChange={saveSearchShortcut}
                collectShortcut={collectShortcut}
                onOpenShortcutSettings={onOpenShortcutSettings}
                backupProvider={backupProvider}
                onBackupProviderChange={(value) => {
                  setBackupStatus({ type: "idle", message: "" });
                  saveBackupProvider(value);
                }}
                backupGithubToken={backupGithubToken}
                onBackupGithubTokenChange={saveBackupGithubToken}
                backupGiteeToken={backupGiteeToken}
                onBackupGiteeTokenChange={saveBackupGiteeToken}
                showLocalBookmarkBackupSetting={Boolean(writeBrowserBookmarkBackup)}
                localBookmarkBackupEnabled={localBookmarkBackupEnabled}
                onLocalBookmarkBackupEnabledChange={saveLocalBookmarkBackupEnabled}
                currentBackupGistHref={currentBackupGistHref}
                lastSyncTimeText={lastSyncTimeText}
                backupStatus={backupStatus}
                importFileInputRef={importFileInputRef}
                importAccept={importAccept}
                onImportFileChange={(event) => void readImportFile(event)}
                importMenuOpen={importMenuOpen}
                onImportMenuOpenChange={setImportMenuOpen}
                onOpenImportFilePicker={openImportFilePicker}
                exportMenuOpen={exportMenuOpen}
                onExportMenuOpenChange={setExportMenuOpen}
                canReadBrowserBookmarks={Boolean(readBrowserBookmarks)}
                onReadBrowserBookmarks={() => void readBrowserBookmarksDirectly()}
                onExportJson={() => {
                  setExportMenuOpen(false);
                  runExportJson();
                }}
                onExportBrowserBookmarks={() => {
                  setExportMenuOpen(false);
                  runExportBrowserBookmarks();
                }}
                onRequestRestore={() => setRestoreConfirmOpen(true)}
                onBackup={() => void runBackup()}
              />
            )}
          />
          <div className="h-full pl-12" data-ui-name="集合抽屉内容避让区">
            <LinkMode
              windows={windows}
              collectionId={collectionId}
              links={data.links}
              tags={data.tags}
              relations={data.relations}
              linkTags={data.linkTags}
              tagLinkCountsByTagId={tagLinkCountsByTagId}
              linkView={linkView}
              windowGroupLayout={windowGroupLayout}
              tagGroupSort={tagGroupSort}
              onTagGroupSortChange={saveTagGroupSort}
              tagDisplayFormat={tagDisplayFormat}
              collapsedWindowGroups={collapsedWindowGroups}
              collapsedTagIds={collapsedTagIds}
              onToggleWindowGroup={toggleWindowGroup}
              onToggleTagGroup={toggleTagGroup}
              badgeFilters={badgeFilters}
              onBadgeFilterChange={toggleBadgeFilter}
              filterWindowLinks={filterWindowLinks}
              onOpenLinks={
                onOpenLinks ? (groupLinks, title) => void onOpenLinks(groupLinks, title, groupOpenMode) : undefined
              }
              toolbarWindowGroupsOpen={toolbarWindowGroupsOpen}
              onWindowGroupsPanelEnter={openToolbarWindowGroups}
              onWindowGroupsPanelLeave={closeToolbarWindowGroups}
              query={debouncedQuery}
              onCreateTag={addTag}
              onBindTag={bindTagToLink}
              onDeleteBinding={requestDeleteBinding}
              onEditTag={requestEditTag}
              onPersistRuntimeTabLink={persistRuntimeTabLink}
              onUpdateLink={updateLink}
              onReorderTagGroups={reorderTagGroups}
              onReorderLinks={reorderLinks}
            />
          </div>
        </section>
      </main>

      <GraphFloatingWindow
        visible={graphVisible}
        initialRect={initialSettings.graphWindowRect}
        headerControls={
          <GraphWindowControls
            elkLayout={elkLayout}
            edgeLineType={edgeLineType}
            onElkLayoutChange={saveElkLayout}
            onEdgeLineTypeChange={saveEdgeLineType}
            onClose={() => changeMode("links")}
          />
        }
      >
        {graphVisible ? (
          <GraphMode
            visible={graphVisible}
            tags={data.tags}
            relations={data.relations}
            query={debouncedQuery}
            elkLayout={elkLayout}
            edgeLineType={edgeLineType}
            badgeFilters={badgeFilters}
            onBadgeFilterChange={toggleBadgeFilter}
            onEditTag={requestEditTag}
            onDeleteTag={requestDeleteTag}
            onEditRelation={setEditingRelation}
            onReverseRelation={reverseGraphRelation}
            onDeleteRelation={deleteGraphRelation}
            onCreateRelation={requestGraphRelation}
          />
        ) : null}
      </GraphFloatingWindow>

      <RelationDialog
        open={pendingRelations.length > 0}
        title="新增标签关系"
        description="请输入关系名称"
        endpoints={pendingRelationEndpoints}
        initialName=""
        onOpenChange={(open) => {
          if (!open) setPendingRelations([]);
        }}
        onSaveMany={createRelations}
        onReverseEndpoint={reversePendingRelation}
        onReverseAllEndpoints={reversePendingRelations}
      />

      <RelationDialog
        open={Boolean(editingRelation)}
        title="编辑名称"
        initialName={editingRelation?.name ?? ""}
        onOpenChange={(open) => {
          if (!open) setEditingRelation(null);
        }}
        onSave={(name) => {
          if (editingRelation) void updateRelation(editingRelation.id, name);
        }}
      />

      <TagEditDialog
        tag={editingTag}
        onOpenChange={(open) => {
          if (!open) setEditingTag(null);
        }}
        onSave={updateTag}
      />

      <BackupConfirmDialogs
        restoreConfirmOpen={restoreConfirmOpen}
        onRestoreConfirmOpenChange={setRestoreConfirmOpen}
        onRestore={() => void runRestore()}
        importPayload={importPayload}
        onImportPayloadClear={() => setImportPayload(null)}
        onImportJson={(mode) => void runImportJson(mode)}
        importBookmarkData={importBookmarkData}
        importBookmarkSourceName={importBookmarkSourceName}
        importBookmarkCollectionId={importBookmarkCollectionId}
        onImportBookmarkCollectionChange={setImportBookmarkCollectionId}
        onImportBookmarkDataClear={() => {
          setImportBookmarkData(null);
          setImportBookmarkCollectionId(null);
        }}
        onImportBrowserBookmarks={(mode) => void runImportBrowserBookmarks(mode)}
        backupConflict={backupConflict}
        missingGistConfirm={missingGistConfirm}
        onMissingGistConfirmChange={setMissingGistConfirm}
        onCreateReplacementGist={() => void createReplacementGist()}
        invalidTokenConfirm={invalidTokenConfirm}
        onInvalidTokenConfirmChange={setInvalidTokenConfirm}
        onChangeRemoteToken={(provider) => {
          setInvalidTokenConfirm(null);
          if (backupProvider !== provider) saveBackupProvider(provider);
          setSettingsOpen(true);
        }}
        backupStatus={backupStatus}
        onUseRemoteBackup={() => void useRemoteBackup()}
        onUseLocalBackup={() => void useLocalBackup()}
      />

      <TagConfirmDialogs
        deleteTarget={deleteTarget}
        onDeleteTargetChange={setDeleteTarget}
        onConfirmDelete={() => void confirmDelete()}
        relationCleanupTarget={relationCleanupTarget}
        onRelationCleanupTargetChange={setRelationCleanupTarget}
        onConfirmRelationCleanup={() => void confirmRelationCleanup()}
        tagsById={tagsById}
      />

      <SyncSetupPrompt
        open={syncSetupPromptOpen}
        onOpenChange={setSyncSetupPromptOpen}
        onConfigure={() => setSettingsOpen(true)}
        onDismissPermanently={() => saveSyncSetupPromptDismissed(true)}
      />
    </div>
  );
}
