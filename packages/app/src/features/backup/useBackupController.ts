import { type ChangeEvent, useCallback, useMemo, useRef, useState, useEffect } from "react";

import {
  createBackupDataSignature,
  createBackupPayload,
  createLocalImportMetadata,
  createLocalSyncedMetadata,
  createRemoteBackupFiles,
  createRemoteBackupMetadata,
  checkRemoteBackup,
  debugSyncLog,
  downloadJsonFile,
  downloadTextFile,
  exportFilename,
  extractGistId,
  fetchRemoteBackupPayloadWithFiles,
  isRemoteGistMissingError,
  isRemoteTokenInvalidError,
  parseBackupJsonContent,
  remoteBackupDataFilename,
  remoteBackupManifestFilename,
  resolveBackupGistId,
  remoteParentVersionOf,
  remoteVersionOf,
  sanitizeBackupData,
  syncSnapshotDebug,
  updateBackupGist,
  type BackupConflict,
  type BackupData,
  type BackupGistResult,
  type BackupPayload,
  type BackupSourceData,
  type RemoteBackupFiles,
} from "../../backup/backup";
import {
  browserBookmarkExportFilename,
  createBrowserBookmarkHtml,
  parseBrowserBookmarkFile,
  type BrowserBookmarkExportData,
  type BrowserBookmarkImportData,
} from "../../backup/bookmark-import";
import { parseTabyJsonFile } from "../../backup/taby-import";
import { type AppData, readAppData, readBackupData } from "../../core/app-data";
import {
  db,
  DEFAULT_COLLECTION_ID,
  getActiveCollectionId,
  markRemoteUnchanged,
  markRemoteUploadCompleted,
  nowIso,
  setActiveCollectionId,
} from "../../db";
import { tagRelationPairKey } from "../tags/relation-utils";
import { readSettings } from "../../storage";
import type { BackupProvider, Id, RuntimeInfo } from "../../types";

export type BackupStatus = {
  type: "idle" | "running" | "success" | "error";
  message: string;
  url?: string;
};

export type ImportKind = "linktag-json" | "browser-bookmarks" | "taby-json";
export type ImportMode = "replace" | "append";

export type MissingGistConfirm = {
  provider: BackupProvider;
  token: string;
  gist: string;
  url: string;
};

export type InvalidTokenConfirm = {
  provider: BackupProvider;
  status: number;
  message: string;
};

type LockManagerLike = {
  request<T>(
    name: string,
    options: { ifAvailable: true },
    callback: (lock: unknown | null) => T | Promise<T>,
  ): Promise<T>;
};

type PreparedBackupFiles = {
  version: string;
  parentVersion: string | null;
  files: RemoteBackupFiles;
};

type UploadBackupResult = BackupGistResult & {
  prepared: PreparedBackupFiles;
};

const remotePullIntervalMs = 5 * 60 * 1000;
const startupSyncDelayMs = 5 * 1000;
const syncDebounceMs = 20 * 1000;
const maxPendingSyncMs = 60 * 1000;
const foregroundSyncMinGapMs = 60 * 1000;

function getWebLocks(): LockManagerLike | null {
  const locks = (navigator as Navigator & { locks?: LockManagerLike }).locks;
  return locks ?? null;
}

function remoteBackupConfigured(provider: BackupProvider, githubToken: string, giteeToken: string) {
  return Boolean((provider === "github" ? githubToken : giteeToken).trim());
}

function sanitizeCollectionImportData(data: BrowserBookmarkImportData, collectionId: Id): BrowserBookmarkImportData {
  return {
    links: data.links.map((link) => ({ ...link, collectionId })),
    tags: data.tags.map((tag) => ({ ...tag, collectionId })),
    link_tags: data.link_tags.map((binding) => ({
      collectionId,
      linkId: binding.linkId,
      tagId: binding.tagId,
    })),
    tag_relations: data.tag_relations.map((relation) => ({ ...relation, collectionId })),
  };
}

export function importAcceptForKind(kind: ImportKind) {
  return kind === "browser-bookmarks" ? "text/html,.html,.htm" : "application/json,.json";
}

function formatBackupTime(value: string | undefined) {
  if (!value) return "未导出";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useBackupController({
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
  onActiveCollectionChange,
}: {
  data: AppData;
  liveData: AppData | undefined;
  runtimeInfo: RuntimeInfo;
  backupProvider: BackupProvider;
  backupGithubToken: string;
  backupGiteeToken: string;
  backupGithubGist: string;
  backupGiteeGist: string;
  localBookmarkBackupEnabled: boolean;
  saveBackupGistForProvider: (provider: BackupProvider, nextGist: string) => void;
  readBrowserBookmarks?: () => Promise<BrowserBookmarkImportData>;
  writeBrowserBookmarkBackup?: (data: BrowserBookmarkExportData) => Promise<void>;
  clearBadgeFilters: () => void;
  onActiveCollectionChange?: (collectionId: Id) => void;
}) {
  const [backupStatus, setBackupStatus] = useState<BackupStatus>({ type: "idle", message: "" });
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [importPayload, setImportPayload] = useState<BackupPayload | null>(null);
  const [importBookmarkData, setImportBookmarkData] = useState<BrowserBookmarkImportData | null>(null);
  const [importBookmarkCollectionId, setImportBookmarkCollectionId] = useState<Id | null>(null);
  const [importBookmarkSourceName, setImportBookmarkSourceName] = useState("浏览器书签");
  const [backupConflict, setBackupConflict] = useState<BackupConflict>(null);
  const [missingGistConfirm, setMissingGistConfirm] = useState<MissingGistConfirm | null>(null);
  const [invalidTokenConfirm, setInvalidTokenConfirm] = useState<InvalidTokenConfirm | null>(null);
  const autoBackupTimerRef = useRef<number | null>(null);
  const startupSyncTimerRef = useRef<number | null>(null);
  const startupSyncDoneRef = useRef(false);
  const autoBackupReadyRef = useRef(false);
  const remoteBackupReady = remoteBackupConfigured(backupProvider, backupGithubToken, backupGiteeToken);
  const remoteBackupPreviousEnabledRef = useRef(remoteBackupReady);
  const localBookmarkBackupPreviousEnabledRef = useRef(localBookmarkBackupEnabled);
  const autoBackupLastSignatureRef = useRef<string | null>(null);
  const autoBackupSkipNextChangeRef = useRef(false);
  const autoBackupIgnoreNextUiChangeRef = useRef(false);
  const autoBackupRunningRef = useRef(false);
  const autoBackupPendingRef = useRef(false);
  const remotePullRunningRef = useRef(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImportKindRef = useRef<ImportKind>("linktag-json");

  const lastSyncTimeText = useMemo(
    () => formatBackupTime(data.metadata?.lastSyncAt ?? undefined),
    [data.metadata?.lastSyncAt],
  );

  const skipNextAutoBackupForUiState = useCallback(() => {
    autoBackupIgnoreNextUiChangeRef.current = true;
  }, []);

  const switchToRestoredCollection = useCallback(
    async (backupData: BackupData) => {
      const currentCollectionId = getActiveCollectionId();
      const nextCollectionId = backupData.collections.some((collection) => collection.id === currentCollectionId)
        ? currentCollectionId
        : (backupData.collections[0]?.id ?? DEFAULT_COLLECTION_ID);
      await setActiveCollectionId(nextCollectionId);
      onActiveCollectionChange?.(nextCollectionId);
    },
    [onActiveCollectionChange],
  );

  const applyBackupPayload = useCallback(
    async (payload: BackupPayload, source: "remote" | "local-file" = "remote") => {
      const payloadVersion = remoteVersionOf(payload) || nowIso();
      const backupData = sanitizeBackupData(payload.data);
      const metadata =
        source === "remote"
          ? createLocalSyncedMetadata(payloadVersion, data.metadata, runtimeInfo, "pull")
          : createLocalImportMetadata(nowIso(), data.metadata, runtimeInfo);
      await db.transaction(
        "rw",
        [db.collections, db.links, db.tags, db.link_tags, db.tag_relations, db.metadata],
        async () => {
          await db.link_tags.clear();
          await db.tag_relations.clear();
          await db.links.clear();
          await db.tags.clear();
          await db.collections.clear();
          if (backupData.collections.length) await db.collections.bulkAdd(backupData.collections);
          if (backupData.links.length) await db.links.bulkAdd(backupData.links);
          if (backupData.tags.length) await db.tags.bulkAdd(backupData.tags);
          if (backupData.link_tags.length) await db.link_tags.bulkAdd(backupData.link_tags);
          if (backupData.tag_relations.length) await db.tag_relations.bulkAdd(backupData.tag_relations);
          await db.metadata.put(metadata);
        },
      );
      await switchToRestoredCollection(backupData);
      clearBadgeFilters();
    },
    [clearBadgeFilters, data.metadata, runtimeInfo, switchToRestoredCollection],
  );

  const appendBackupData = useCallback(
    async (backupData: BackupData) => {
      const sanitizedData = sanitizeBackupData(backupData);
      const importedAt = nowIso();
      const metadata = createLocalImportMetadata(importedAt, data.metadata, runtimeInfo);
      await db.transaction(
        "rw",
        [db.collections, db.links, db.tags, db.link_tags, db.tag_relations, db.metadata],
        async () => {
          if (sanitizedData.collections.length) await db.collections.bulkPut(sanitizedData.collections);
          if (sanitizedData.links.length) await db.links.bulkPut(sanitizedData.links);
          if (sanitizedData.tags.length) await db.tags.bulkPut(sanitizedData.tags);
          if (sanitizedData.link_tags.length) await db.link_tags.bulkPut(sanitizedData.link_tags);
          if (sanitizedData.tag_relations.length) await db.tag_relations.bulkPut(sanitizedData.tag_relations);
          await db.metadata.put(metadata);
        },
      );
      await switchToRestoredCollection(sanitizedData);
      clearBadgeFilters();
    },
    [clearBadgeFilters, data.metadata, runtimeInfo, switchToRestoredCollection],
  );

  const appendCollectionImportData = useCallback(
    async (importData: BrowserBookmarkImportData, collectionId: Id) => {
      const sanitizedData = sanitizeCollectionImportData(importData, collectionId);
      const importedAt = nowIso();
      const metadata = createLocalImportMetadata(importedAt, data.metadata, runtimeInfo);
      await db.transaction("rw", db.links, db.tags, db.link_tags, db.tag_relations, db.metadata, async () => {
        if (sanitizedData.links.length) await db.links.bulkPut(sanitizedData.links);
        if (sanitizedData.tags.length) await db.tags.bulkPut(sanitizedData.tags);
        if (sanitizedData.link_tags.length) await db.link_tags.bulkPut(sanitizedData.link_tags);
        if (sanitizedData.tag_relations.length) {
          const existingRelations = await db.tag_relations.where("collectionId").equals(collectionId).toArray();
          const relationPairKeys = new Set(
            existingRelations.map((relation) => tagRelationPairKey(relation.sourceTagId, relation.targetTagId)),
          );
          const relationsToPut = sanitizedData.tag_relations.filter((relation) => {
            const key = tagRelationPairKey(relation.sourceTagId, relation.targetTagId);
            if (relationPairKeys.has(key)) return false;
            relationPairKeys.add(key);
            return true;
          });
          if (relationsToPut.length) await db.tag_relations.bulkPut(relationsToPut);
        }
        await db.metadata.put(metadata);
      });
      clearBadgeFilters();
    },
    [clearBadgeFilters, data.metadata, runtimeInfo],
  );

  const runExportJson = async () => {
    setBackupStatus({ type: "running", message: "正在导出..." });
    try {
      const exportedAt = nowIso();
      const snapshot = await readBackupData();
      const metadata = createRemoteBackupMetadata(
        snapshot.metadata?.localVersion || exportedAt,
        snapshot.metadata?.baseVersion ?? null,
        snapshot.metadata,
        runtimeInfo,
      );
      const content = JSON.stringify(createBackupPayload(snapshot, metadata), null, 2);
      downloadJsonFile(exportFilename(exportedAt), content);
      setBackupStatus({ type: "success", message: "导出完成。" });
    } catch (error) {
      setBackupStatus({ type: "error", message: error instanceof Error ? error.message : "导出失败。" });
    }
  };

  const runExportBrowserBookmarks = async () => {
    setBackupStatus({ type: "running", message: "正在导出浏览器书签..." });
    try {
      const exportedAt = nowIso();
      const snapshot = await readAppData();
      const content = createBrowserBookmarkHtml({
        links: snapshot.links,
        tags: snapshot.tags,
        linkTags: snapshot.linkTags,
      });
      downloadTextFile(browserBookmarkExportFilename(exportedAt), content, "text/html;charset=utf-8");
      setBackupStatus({ type: "success", message: "浏览器书签导出完成。" });
    } catch (error) {
      setBackupStatus({ type: "error", message: error instanceof Error ? error.message : "浏览器书签导出失败。" });
    }
  };

  const runLocalBookmarkBackup = useCallback(
    async (snapshot: AppData) => {
      if (!writeBrowserBookmarkBackup) return false;
      await writeBrowserBookmarkBackup({
        links: snapshot.links,
        tags: snapshot.tags,
        linkTags: snapshot.linkTags,
      });
      return true;
    },
    [writeBrowserBookmarkBackup],
  );

  const prepareBackupFiles = useCallback(
    async (snapshot: BackupSourceData, remoteBaseVersion?: string | null): Promise<PreparedBackupFiles> => {
      const version = snapshot.metadata?.localVersion || nowIso();
      const parentVersion = remoteBaseVersion ?? snapshot.metadata?.baseVersion ?? null;
      const metadata = createRemoteBackupMetadata(version, parentVersion, snapshot.metadata, runtimeInfo);
      const files = await createRemoteBackupFiles(createBackupPayload(snapshot, metadata));
      return { version, parentVersion, files };
    },
    [runtimeInfo],
  );

  const readBrowserBookmarkFile = (content: string) => {
    const bookmarkData = parseBrowserBookmarkFile(content);
    if (bookmarkData.links.length === 0) throw new Error("没有找到可导入的浏览器书签。");
    setImportPayload(null);
    setImportBookmarkSourceName("浏览器书签");
    setImportBookmarkCollectionId(null);
    setImportBookmarkData(bookmarkData);
    setBackupStatus({
      type: "idle",
      message: `已读取 ${bookmarkData.links.length} 个浏览器书签，${bookmarkData.tags.length} 个文件夹。`,
    });
  };

  const readTabyJsonFile = (content: string) => {
    const tabyData = parseTabyJsonFile(content);
    if (tabyData.links.length === 0) throw new Error("没有找到可导入的 Taby 链接。");
    const exportedAt = nowIso();
    const metadata = createRemoteBackupMetadata(exportedAt, null, data.metadata, runtimeInfo);
    const payload = createBackupPayload(
      {
        collections: tabyData.collections,
        links: tabyData.links,
        tags: tabyData.tags,
        linkTags: tabyData.link_tags,
        relations: tabyData.tag_relations,
        metadata: data.metadata,
      },
      metadata,
    );
    setImportPayload(payload);
    setImportBookmarkCollectionId(null);
    setImportBookmarkData(null);
    setBackupStatus({
      type: "idle",
      message: `已读取 ${tabyData.links.length} 个 Taby 链接，${tabyData.collections.length} 个 Collection，${tabyData.tags.length} 个标签。`,
    });
  };

  const readBrowserBookmarksDirectly = async () => {
    if (!readBrowserBookmarks) return;
    setImportMenuOpen(false);
    setBackupStatus({ type: "running", message: "正在读取浏览器书签..." });
    try {
      const bookmarkData = await readBrowserBookmarks();
      if (bookmarkData.links.length === 0) throw new Error("没有找到可导入的浏览器书签。");
      setImportPayload(null);
      setImportBookmarkSourceName("浏览器书签");
      setImportBookmarkCollectionId(null);
      setImportBookmarkData(bookmarkData);
      setBackupStatus({
        type: "idle",
        message: `已读取 ${bookmarkData.links.length} 个浏览器书签，${bookmarkData.tags.length} 个文件夹。`,
      });
    } catch (error) {
      setImportBookmarkData(null);
      setImportBookmarkCollectionId(null);
      setBackupStatus({ type: "error", message: error instanceof Error ? error.message : "读取浏览器书签失败。" });
    }
  };

  const runImportBrowserBookmarks = async (mode: ImportMode) => {
    if (!importBookmarkData) return;
    if (!importBookmarkCollectionId) {
      setBackupStatus({ type: "error", message: "请选择要导入到的 Collection。" });
      return;
    }
    const importedAt = nowIso();
    const metadata = createLocalImportMetadata(importedAt, data.metadata, runtimeInfo);
    const collectionId = importBookmarkCollectionId;
    setBackupStatus({
      type: "running",
      message:
        mode === "replace"
          ? `正在覆盖导入${importBookmarkSourceName}...`
          : `正在追加导入${importBookmarkSourceName}...`,
    });
    try {
      if (mode === "replace") {
        const bookmarkData = sanitizeCollectionImportData(importBookmarkData, collectionId);
        await db.transaction("rw", db.links, db.tags, db.link_tags, db.tag_relations, db.metadata, async () => {
          await db.link_tags.where("collectionId").equals(collectionId).delete();
          await db.tag_relations.where("collectionId").equals(collectionId).delete();
          await db.links.where("collectionId").equals(collectionId).delete();
          await db.tags.where("collectionId").equals(collectionId).delete();
          if (bookmarkData.links.length > 0) await db.links.bulkAdd(bookmarkData.links);
          if (bookmarkData.tags.length > 0) await db.tags.bulkAdd(bookmarkData.tags);
          if (bookmarkData.link_tags.length > 0) await db.link_tags.bulkAdd(bookmarkData.link_tags);
          if (bookmarkData.tag_relations.length > 0) await db.tag_relations.bulkAdd(bookmarkData.tag_relations);
          await db.metadata.put(metadata);
        });
        clearBadgeFilters();
      } else {
        await appendCollectionImportData(importBookmarkData, collectionId);
      }
      setBackupStatus({
        type: "success",
        message: `已${mode === "replace" ? "覆盖" : "追加"}导入 ${importBookmarkData.links.length} 个链接，${importBookmarkData.tags.length} 个标签。`,
      });
      setImportBookmarkData(null);
      setImportBookmarkCollectionId(null);
    } catch (error) {
      autoBackupSkipNextChangeRef.current = false;
      setBackupStatus({
        type: "error",
        message: error instanceof Error ? error.message : `${importBookmarkSourceName}导入失败。`,
      });
    }
  };

  const readImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const selectedImportKind = pendingImportKindRef.current;
    setBackupStatus({ type: "running", message: "正在读取导入文件..." });
    try {
      const content = await file.text();
      if (selectedImportKind === "browser-bookmarks") {
        readBrowserBookmarkFile(content);
      } else if (selectedImportKind === "taby-json") {
        readTabyJsonFile(content);
      } else {
        const payload = parseBackupJsonContent(content);
        setImportBookmarkData(null);
        setImportPayload(payload);
        setBackupStatus({
          type: "idle",
          message: `已读取：${file.name}，${payload.data.collections.length} 个集合。`,
        });
      }
    } catch (error) {
      setImportPayload(null);
      setImportBookmarkData(null);
      setImportBookmarkCollectionId(null);
      setBackupStatus({ type: "error", message: error instanceof Error ? error.message : "导入文件读取失败。" });
    }
  };

  const openImportFilePicker = (kind: ImportKind) => {
    pendingImportKindRef.current = kind;
    const input = importFileInputRef.current;
    if (input) input.accept = importAcceptForKind(kind);
    setImportMenuOpen(false);
    window.setTimeout(() => input?.click(), 0);
  };

  const runImportJson = async (mode: ImportMode) => {
    if (!importPayload) return;
    setBackupStatus({ type: "running", message: mode === "replace" ? "正在覆盖导入..." : "正在追加导入..." });
    try {
      if (mode === "replace") {
        await applyBackupPayload(importPayload, "local-file");
      } else {
        await appendBackupData(importPayload.data);
      }
      setImportPayload(null);
      setBackupStatus({ type: "success", message: `${mode === "replace" ? "覆盖" : "追加"}导入完成。` });
    } catch (error) {
      autoBackupSkipNextChangeRef.current = false;
      setBackupStatus({ type: "error", message: error instanceof Error ? error.message : "导入失败。" });
    }
  };

  const uploadPreparedBackup = useCallback(
    async (
      prepared: PreparedBackupFiles,
      provider: BackupProvider,
      token: string,
      gist: string,
    ): Promise<BackupGistResult> => {
      debugSyncLog("上传远程：已生成拆分文件", {
        远程类型: provider,
        Gist: extractGistId(gist) || gist || null,
        元数据文件: remoteBackupManifestFilename,
        数据文件: prepared.files.manifest.data.file,
        数据编码: prepared.files.manifest.data.encoding,
        原始字节: prepared.files.manifest.data.originalBytes,
        压缩字节: prepared.files.manifest.data.compressedBytes,
        备份版本: prepared.version,
        父版本: prepared.parentVersion,
      });
      const result = await updateBackupGist(provider, token, gist, {
        [remoteBackupDataFilename]: prepared.files.dataContent,
        [remoteBackupManifestFilename]: JSON.stringify(prepared.files.manifest, null, 2),
      });
      if (result.id) saveBackupGistForProvider(provider, result.id);
      return result;
    },
    [saveBackupGistForProvider],
  );

  const uploadLocalBackup = useCallback(
    async (
      snapshot: BackupSourceData,
      provider: BackupProvider,
      token: string,
      gist: string,
      remoteBaseVersion?: string | null,
    ): Promise<UploadBackupResult> => {
      const prepared = await prepareBackupFiles(snapshot, remoteBaseVersion);
      const result = await uploadPreparedBackup(prepared, provider, token, gist);
      await markRemoteUploadCompleted(prepared.version, runtimeInfo);
      autoBackupLastSignatureRef.current = createBackupDataSignature(snapshot);
      return { ...result, prepared };
    },
    [prepareBackupFiles, runtimeInfo, uploadPreparedBackup],
  );

  const saveResolvedGist = useCallback(
    (provider: BackupProvider, resolvedGist: string) => {
      const gistId = extractGistId(resolvedGist);
      if (!gistId) return;
      const currentGist = provider === "github" ? backupGithubGist.trim() : backupGiteeGist.trim();
      if (extractGistId(currentGist) !== gistId) saveBackupGistForProvider(provider, gistId);
    },
    [backupGiteeGist, backupGithubGist, saveBackupGistForProvider],
  );

  const promptMissingGist = useCallback((provider: BackupProvider, token: string, gist: string, url: string) => {
    setMissingGistConfirm({ provider, token, gist, url });
    setBackupStatus({ type: "error", message: "现有 Gist ID 无法使用，请确认是否创建新的 Gist。" });
  }, []);

  const promptInvalidToken = useCallback((provider: BackupProvider, status: number, message: string) => {
    setInvalidTokenConfirm({ provider, status, message });
    setBackupStatus({ type: "error", message: `${provider} Token 无法使用，请确认是否更换 Token。` });
  }, []);

  const createReplacementGist = async () => {
    const target = missingGistConfirm;
    if (!target) return;
    setBackupStatus({ type: "running", message: "正在创建新的远程 Gist..." });
    try {
      const snapshot = await readBackupData();
      debugSyncLog("重新创建远程 Gist：开始", {
        远程类型: target.provider,
        失效Gist: extractGistId(target.gist) || target.gist,
        ...syncSnapshotDebug(snapshot),
      });
      const result = await uploadLocalBackup(snapshot, target.provider, target.token, "", null);
      await syncMirrorTargets(target.provider, snapshot, result.prepared);
      setMissingGistConfirm(null);
      debugSyncLog("重新创建远程 Gist：完成", {
        远程类型: target.provider,
        新Gist: result.id || null,
        远程地址: result.url || null,
        ...syncSnapshotDebug(snapshot),
      });
      setBackupStatus({ type: "success", message: "已用本地数据创建新的远程 Gist。", url: result.url });
    } catch (error) {
      if (isRemoteTokenInvalidError(error)) {
        promptInvalidToken(error.provider, error.status, error.message);
        return;
      }
      debugSyncLog("重新创建远程 Gist：失败", {
        远程类型: target.provider,
        失效Gist: extractGistId(target.gist) || target.gist,
        错误信息: error instanceof Error ? error.message : String(error),
      });
      setBackupStatus({ type: "error", message: error instanceof Error ? error.message : "创建新的远程 Gist 失败。" });
    }
  };

  const syncMirrorTargets = useCallback(
    async (primaryProvider: BackupProvider, snapshot: BackupSourceData, prepared?: PreparedBackupFiles) => {
      const latestSettings = readSettings();
      const mirrorProvider: BackupProvider = primaryProvider === "github" ? "gitee" : "github";
      const mirrorToken =
        mirrorProvider === "github" ? latestSettings.backupGithubToken.trim() : latestSettings.backupGiteeToken.trim();
      const mirrorGist =
        mirrorProvider === "github" ? latestSettings.backupGithubGist.trim() : latestSettings.backupGiteeGist.trim();

      if (mirrorToken) {
        try {
          const mirrorResolvedGist = (await resolveBackupGistId(mirrorProvider, mirrorToken, mirrorGist)) || mirrorGist;
          const mirrorBackup = prepared ?? (await prepareBackupFiles(snapshot));
          saveResolvedGist(mirrorProvider, mirrorResolvedGist);
          await uploadPreparedBackup(mirrorBackup, mirrorProvider, mirrorToken, mirrorResolvedGist);
          debugSyncLog("主配置同步后：镜像远程完成", {
            主远程类型: primaryProvider,
            镜像远程类型: mirrorProvider,
            Gist: mirrorResolvedGist || null,
            备份版本: mirrorBackup.version,
            父版本: mirrorBackup.parentVersion,
          });
        } catch (error) {
          if (isRemoteTokenInvalidError(error)) {
            promptInvalidToken(error.provider, error.status, error.message);
            return;
          }
          debugSyncLog("主配置同步后：镜像远程失败", {
            主远程类型: primaryProvider,
            镜像远程类型: mirrorProvider,
            错误信息: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (latestSettings.localBookmarkBackupEnabled && writeBrowserBookmarkBackup) {
        const bookmarkSnapshot = await readAppData();
        await runLocalBookmarkBackup(bookmarkSnapshot);
        debugSyncLog("主配置同步后：本地书签同步完成", {
          链接数量: bookmarkSnapshot.links.length,
          标签数量: bookmarkSnapshot.tags.length,
        });
      }
    },
    [
      prepareBackupFiles,
      promptInvalidToken,
      runLocalBookmarkBackup,
      saveResolvedGist,
      uploadPreparedBackup,
      writeBrowserBookmarkBackup,
    ],
  );

  const runBackup = async () => {
    const token = backupProvider === "github" ? backupGithubToken.trim() : backupGiteeToken.trim();
    const gist = backupProvider === "github" ? backupGithubGist.trim() : backupGiteeGist.trim();
    const shouldRunLocalBookmarkBackup = localBookmarkBackupEnabled && Boolean(writeBrowserBookmarkBackup);
    const canRunRemoteBackup = Boolean(token);
    if (!canRunRemoteBackup && !shouldRunLocalBookmarkBackup) {
      setBackupStatus({ type: "error", message: "请先填写密钥信息或开启本地书签同步。" });
      return;
    }
    setBackupStatus({ type: "running", message: "正在同步..." });
    try {
      const snapshot = await readBackupData();
      let localBookmarkBackedUp = false;
      debugSyncLog("立即同步：开始", {
        远程类型: backupProvider,
        Gist: extractGistId(gist) || gist || null,
        本地书签同步: shouldRunLocalBookmarkBackup,
        远程自动同步: canRunRemoteBackup,
        ...syncSnapshotDebug(snapshot),
      });
      if (!canRunRemoteBackup) {
        if (shouldRunLocalBookmarkBackup) {
          const bookmarkSnapshot = await readAppData();
          await runLocalBookmarkBackup(bookmarkSnapshot);
          debugSyncLog("立即同步：本地书签同步完成", {
            链接数量: bookmarkSnapshot.links.length,
            标签数量: bookmarkSnapshot.tags.length,
          });
        }
        autoBackupLastSignatureRef.current = createBackupDataSignature(snapshot);
        setBackupStatus({
          type: "success",
          message: "本地书签同步完成；未填写密钥，远程未同步。",
        });
        return;
      }
      const preflight = await checkRemoteBackup(snapshot, backupProvider, token, gist);
      if (preflight.type === "missing-gist") {
        promptMissingGist(backupProvider, token, preflight.gist, preflight.url);
        return;
      }
      if (preflight.type !== "conflict") saveResolvedGist(backupProvider, preflight.gist);
      else saveResolvedGist(backupProvider, preflight.conflict.gist);
      const resolvedGist = preflight.type === "conflict" ? preflight.conflict.gist : preflight.gist || gist;
      if (preflight.type === "pull") {
        debugSyncLog("立即同步：拉取远程", {
          远程类型: backupProvider,
          Gist: resolvedGist || null,
          ...syncSnapshotDebug(snapshot, preflight.remoteManifest),
        });
        autoBackupSkipNextChangeRef.current = true;
        const remoteBackup = await fetchRemoteBackupPayloadWithFiles(
          backupProvider,
          token,
          resolvedGist,
          preflight.remoteManifest,
        );
        await applyBackupPayload(remoteBackup.payload, "remote");
        setBackupStatus({
          type: "success",
          message: "远程数据较新，已同步到本地。",
        });
        return;
      }
      if (preflight.type === "unchanged") {
        debugSyncLog("立即同步：无需处理", {
          远程类型: backupProvider,
          Gist: resolvedGist || null,
          预检查远程版本: preflight.remoteVersion,
          ...syncSnapshotDebug(snapshot),
        });
        await markRemoteUnchanged(runtimeInfo);
        setBackupStatus({
          type: "success",
          message: "本地和远程已一致。",
        });
        return;
      }
      if (preflight.type === "conflict") {
        debugSyncLog("立即同步：发生冲突", {
          远程类型: backupProvider,
          Gist: preflight.conflict.gist || null,
          远程版本: preflight.conflict.remoteVersion,
          远程父版本: preflight.conflict.remoteParentVersion,
          本地版本: preflight.conflict.localVersion,
          本地基线版本: preflight.conflict.localBaseVersion,
          是否待同步: preflight.conflict.pendingSync,
        });
        setBackupConflict(preflight.conflict);
        setBackupStatus({ type: "error", message: "发现远程同步冲突，请选择使用远程或本地。" });
        return;
      }
      debugSyncLog("立即同步：上传本地", {
        远程类型: backupProvider,
        Gist: resolvedGist || null,
        预检查远程版本: preflight.remoteVersion,
        ...syncSnapshotDebug(snapshot),
      });
      const result = await uploadLocalBackup(snapshot, backupProvider, token, resolvedGist, preflight.remoteVersion);
      await syncMirrorTargets(backupProvider, snapshot, result.prepared);
      localBookmarkBackedUp = shouldRunLocalBookmarkBackup;
      debugSyncLog("立即同步：上传完成", {
        远程类型: backupProvider,
        Gist: result.id || extractGistId(gist) || gist || null,
        远程地址: result.url || null,
        ...syncSnapshotDebug(snapshot),
      });
      setBackupStatus({
        type: "success",
        message: localBookmarkBackedUp ? "同步上传完成，其他目标已同步。" : "同步上传完成。",
        url: result.url,
      });
    } catch (error) {
      if (isRemoteGistMissingError(error)) {
        promptMissingGist(backupProvider, token, error.gistId, error.url);
        return;
      }
      if (isRemoteTokenInvalidError(error)) {
        promptInvalidToken(error.provider, error.status, error.message);
        return;
      }
      debugSyncLog("立即同步：失败", {
        远程类型: backupProvider,
        Gist: extractGistId(gist) || gist || null,
        错误信息: error instanceof Error ? error.message : String(error),
      });
      setBackupStatus({ type: "error", message: error instanceof Error ? error.message : "同步失败。" });
    }
  };

  const runRestore = async () => {
    const token = backupProvider === "github" ? backupGithubToken.trim() : backupGiteeToken.trim();
    const gist = backupProvider === "github" ? backupGithubGist.trim() : backupGiteeGist.trim();
    if (!token) {
      setBackupStatus({ type: "error", message: "请先填写密钥信息。" });
      return;
    }
    autoBackupSkipNextChangeRef.current = true;
    setBackupStatus({ type: "running", message: "正在从远程同步..." });
    try {
      const resolvedGist = await resolveBackupGistId(backupProvider, token, gist);
      const localSnapshot = await readBackupData();
      if (!resolvedGist) {
        debugSyncLog("拉取远程：未找到远程备份，创建新的远程备份", {
          远程类型: backupProvider,
          Gist: null,
          ...syncSnapshotDebug(localSnapshot),
        });
        const result = await uploadLocalBackup(localSnapshot, backupProvider, token, "", null);
        await syncMirrorTargets(backupProvider, localSnapshot, result.prepared);
        setBackupStatus({ type: "success", message: "未找到远程备份，已创建新的远程备份。", url: result.url });
        return;
      }
      saveResolvedGist(backupProvider, resolvedGist);
      debugSyncLog("拉取远程：开始", {
        远程类型: backupProvider,
        Gist: resolvedGist,
        ...syncSnapshotDebug(localSnapshot),
      });
      const remoteBackup = await fetchRemoteBackupPayloadWithFiles(backupProvider, token, resolvedGist);
      debugSyncLog("拉取远程：已读取远程", {
        远程类型: backupProvider,
        Gist: resolvedGist,
        ...syncSnapshotDebug(localSnapshot, remoteBackup.files.manifest),
      });
      await applyBackupPayload(remoteBackup.payload);
      debugSyncLog("拉取远程：已覆盖本地", {
        远程类型: backupProvider,
        Gist: resolvedGist,
        远程版本: remoteVersionOf(remoteBackup.payload) || null,
        远程父版本: remoteParentVersionOf(remoteBackup.payload),
      });
      setBackupStatus({
        type: "success",
        message: "远程同步完成。",
      });
    } catch (error) {
      autoBackupSkipNextChangeRef.current = false;
      if (isRemoteGistMissingError(error)) {
        promptMissingGist(backupProvider, token, error.gistId, error.url);
        return;
      }
      if (isRemoteTokenInvalidError(error)) {
        promptInvalidToken(error.provider, error.status, error.message);
        return;
      }
      debugSyncLog("拉取远程：失败", {
        远程类型: backupProvider,
        Gist: extractGistId(gist) || gist,
        错误信息: error instanceof Error ? error.message : String(error),
      });
      setBackupStatus({ type: "error", message: error instanceof Error ? error.message : "远程同步失败。" });
    }
  };

  const runAutoBackup = useCallback(
    async function runAutoBackup(force = false) {
      const execute = async () => {
        if (autoBackupRunningRef.current) {
          autoBackupPendingRef.current = true;
          return;
        }

        const latestSettings = readSettings();
        const shouldRunRemoteBackup = remoteBackupConfigured(
          latestSettings.backupProvider,
          latestSettings.backupGithubToken,
          latestSettings.backupGiteeToken,
        );
        const shouldRunLocalBookmarkBackup =
          latestSettings.localBookmarkBackupEnabled && Boolean(writeBrowserBookmarkBackup);
        if (!shouldRunRemoteBackup && !shouldRunLocalBookmarkBackup) return;
        const provider = latestSettings.backupProvider;
        const token =
          provider === "github" ? latestSettings.backupGithubToken.trim() : latestSettings.backupGiteeToken.trim();
        const gist =
          provider === "github" ? latestSettings.backupGithubGist.trim() : latestSettings.backupGiteeGist.trim();
        const canRunRemoteBackup = shouldRunRemoteBackup && Boolean(token);

        autoBackupRunningRef.current = true;
        setBackupStatus({ type: "running", message: "正在自动同步..." });
        try {
          const latestSnapshot = await readBackupData();
          const latestSignature = createBackupDataSignature(latestSnapshot);
          if (
            !force &&
            (!canRunRemoteBackup || !latestSnapshot.metadata?.pendingSync) &&
            latestSignature === autoBackupLastSignatureRef.current
          ) {
            setBackupStatus({ type: "success", message: "自动同步已处理最新数据。" });
            return;
          }

          if (!canRunRemoteBackup) {
            if (shouldRunLocalBookmarkBackup) {
              const bookmarkSnapshot = await readAppData();
              await runLocalBookmarkBackup(bookmarkSnapshot);
              debugSyncLog("自动同步：本地书签同步完成", {
                链接数量: bookmarkSnapshot.links.length,
                标签数量: bookmarkSnapshot.tags.length,
              });
            }
            autoBackupLastSignatureRef.current = latestSignature;
            setBackupStatus({
              type: "success",
              message: "本地书签同步完成。",
            });
            return;
          }

          let localBookmarkBackedUp = false;
          const preflight = await checkRemoteBackup(latestSnapshot, provider, token, gist);
          if (preflight.type === "missing-gist") {
            promptMissingGist(provider, token, preflight.gist, preflight.url);
            return;
          }
          if (preflight.type !== "conflict") saveResolvedGist(provider, preflight.gist);
          else saveResolvedGist(provider, preflight.conflict.gist);
          const resolvedGist = preflight.type === "conflict" ? preflight.conflict.gist : preflight.gist || gist;
          if (preflight.type === "pull") {
            autoBackupSkipNextChangeRef.current = true;
            const remoteBackup = await fetchRemoteBackupPayloadWithFiles(
              provider,
              token,
              resolvedGist,
              preflight.remoteManifest,
            );
            await applyBackupPayload(remoteBackup.payload, "remote");
            setBackupStatus({
              type: "success",
              message: "远程数据较新，已自动同步到本地。",
            });
            return;
          }
          if (preflight.type === "unchanged") {
            await markRemoteUnchanged(runtimeInfo);
            setBackupStatus({
              type: "success",
              message: "本地和远程已一致。",
            });
            return;
          }
          if (preflight.type === "conflict") {
            setBackupConflict(preflight.conflict);
            setBackupStatus({ type: "error", message: "发现远程同步冲突，自动同步已停止。" });
            return;
          }
          const result = await uploadLocalBackup(
            latestSnapshot,
            provider,
            token,
            resolvedGist,
            preflight.remoteVersion,
          );
          await syncMirrorTargets(provider, latestSnapshot, result.prepared);
          localBookmarkBackedUp = shouldRunLocalBookmarkBackup;
          setBackupStatus({
            type: "success",
            message: localBookmarkBackedUp ? "自动同步上传完成，其他目标已同步。" : "自动同步上传完成。",
            url: result.url,
          });
        } catch (error) {
          if (isRemoteGistMissingError(error)) {
            promptMissingGist(provider, token, error.gistId, error.url);
            return;
          }
          if (isRemoteTokenInvalidError(error)) {
            promptInvalidToken(error.provider, error.status, error.message);
            return;
          }
          setBackupStatus({ type: "error", message: error instanceof Error ? error.message : "自动同步失败。" });
        } finally {
          autoBackupRunningRef.current = false;
          const pending = autoBackupPendingRef.current;
          autoBackupPendingRef.current = false;
          if (pending) window.setTimeout(() => void runAutoBackup(), 0);
        }
      };

      const locks = getWebLocks();
      if (locks) {
        await locks.request("linktag-sync", { ifAvailable: true }, async (lock) => {
          if (!lock) return;
          await execute();
        });
        return;
      }

      await execute();
    },
    [
      applyBackupPayload,
      promptMissingGist,
      promptInvalidToken,
      runLocalBookmarkBackup,
      runtimeInfo,
      saveResolvedGist,
      syncMirrorTargets,
      uploadLocalBackup,
      writeBrowserBookmarkBackup,
    ],
  );

  const runRemotePullCheck = useCallback(async () => {
    if (
      backupConflict ||
      missingGistConfirm ||
      invalidTokenConfirm ||
      remotePullRunningRef.current ||
      autoBackupRunningRef.current
    )
      return;

    const latestSettings = readSettings();
    if (
      !remoteBackupConfigured(
        latestSettings.backupProvider,
        latestSettings.backupGithubToken,
        latestSettings.backupGiteeToken,
      )
    )
      return;
    const provider = latestSettings.backupProvider;
    const token =
      provider === "github" ? latestSettings.backupGithubToken.trim() : latestSettings.backupGiteeToken.trim();
    const gist = provider === "github" ? latestSettings.backupGithubGist.trim() : latestSettings.backupGiteeGist.trim();
    if (!token) return;

    const execute = async () => {
      remotePullRunningRef.current = true;
      try {
        const localSnapshot = await readBackupData();
        const preflight = await checkRemoteBackup(localSnapshot, provider, token, gist);
        if (preflight.type === "missing-gist") {
          promptMissingGist(provider, token, preflight.gist, preflight.url);
          return;
        }
        if (preflight.type !== "conflict") saveResolvedGist(provider, preflight.gist);
        else saveResolvedGist(provider, preflight.conflict.gist);
        const resolvedGist = preflight.type === "conflict" ? preflight.conflict.gist : preflight.gist || gist;
        if (preflight.type === "unchanged") {
          await markRemoteUnchanged(runtimeInfo);
          return;
        }
        if (preflight.type === "pull") {
          autoBackupSkipNextChangeRef.current = true;
          const remoteBackup = await fetchRemoteBackupPayloadWithFiles(
            provider,
            token,
            resolvedGist,
            preflight.remoteManifest,
          );
          await applyBackupPayload(remoteBackup.payload, "remote");
          setBackupStatus({ type: "success", message: "已自动同步远程更新。" });
          return;
        }
        if (preflight.type === "upload") return;
        setBackupConflict(preflight.conflict);
        setBackupStatus({ type: "error", message: "发现远程同步冲突，请选择使用远程或本地。" });
      } catch (error) {
        if (isRemoteGistMissingError(error)) {
          promptMissingGist(provider, token, error.gistId, error.url);
          return;
        }
        if (isRemoteTokenInvalidError(error)) {
          promptInvalidToken(error.provider, error.status, error.message);
          return;
        }
        setBackupStatus({ type: "error", message: error instanceof Error ? error.message : "远程定时同步失败。" });
      } finally {
        remotePullRunningRef.current = false;
      }
    };

    const locks = getWebLocks();
    if (locks) {
      await locks.request("linktag-sync", { ifAvailable: true }, async (lock) => {
        if (!lock) return;
        await execute();
      });
      return;
    }

    await execute();
  }, [
    applyBackupPayload,
    backupConflict,
    invalidTokenConfirm,
    missingGistConfirm,
    promptInvalidToken,
    promptMissingGist,
    runtimeInfo,
    saveResolvedGist,
  ]);

  const useRemoteBackup = async () => {
    const conflict = backupConflict;
    if (!conflict) return;
    autoBackupSkipNextChangeRef.current = true;
    setBackupStatus({ type: "running", message: "正在使用远程数据..." });
    try {
      const remoteBackup = await fetchRemoteBackupPayloadWithFiles(
        conflict.provider,
        conflict.token,
        conflict.gist,
        conflict.remoteManifest,
      );
      await applyBackupPayload(remoteBackup.payload);
      setBackupConflict(null);
      setBackupStatus({
        type: "success",
        message: "已使用远程数据。",
      });
    } catch (error) {
      autoBackupSkipNextChangeRef.current = false;
      if (isRemoteTokenInvalidError(error)) {
        promptInvalidToken(error.provider, error.status, error.message);
        return;
      }
      setBackupStatus({ type: "error", message: error instanceof Error ? error.message : "使用远程数据失败。" });
    }
  };

  const useLocalBackup = async () => {
    const conflict = backupConflict;
    if (!conflict) return;
    setBackupStatus({ type: "running", message: "正在使用本地数据覆盖远程..." });
    try {
      const result = await uploadLocalBackup(
        conflict.localSnapshot,
        conflict.provider,
        conflict.token,
        conflict.gist,
        conflict.remoteVersion || null,
      );
      await syncMirrorTargets(conflict.provider, conflict.localSnapshot, result.prepared);
      setBackupConflict(null);
      setBackupStatus({ type: "success", message: "已使用本地数据覆盖远程，其他目标已同步。", url: result.url });
    } catch (error) {
      if (isRemoteGistMissingError(error)) {
        promptMissingGist(conflict.provider, conflict.token, error.gistId, error.url);
        return;
      }
      if (isRemoteTokenInvalidError(error)) {
        promptInvalidToken(error.provider, error.status, error.message);
        return;
      }
      setBackupStatus({ type: "error", message: error instanceof Error ? error.message : "使用本地数据失败。" });
    }
  };

  useEffect(() => {
    if (autoBackupIgnoreNextUiChangeRef.current) {
      autoBackupIgnoreNextUiChangeRef.current = false;
      return;
    }

    if (autoBackupTimerRef.current !== null) {
      window.clearTimeout(autoBackupTimerRef.current);
      autoBackupTimerRef.current = null;
    }
    if (!liveData || backupConflict || missingGistConfirm || invalidTokenConfirm) return;

    const autoSyncEnabled = remoteBackupReady || localBookmarkBackupEnabled;
    const remoteJustEnabled = !remoteBackupPreviousEnabledRef.current && remoteBackupReady;
    const localBookmarkJustEnabled = !localBookmarkBackupPreviousEnabledRef.current && localBookmarkBackupEnabled;
    const justEnabled = remoteJustEnabled || localBookmarkJustEnabled;
    remoteBackupPreviousEnabledRef.current = remoteBackupReady;
    localBookmarkBackupPreviousEnabledRef.current = localBookmarkBackupEnabled;

    if (!autoSyncEnabled) {
      autoBackupLastSignatureRef.current = null;
      return;
    }

    if (!autoBackupReadyRef.current) {
      autoBackupReadyRef.current = true;
      if (!data.metadata?.pendingSync && !justEnabled) return;
    }

    if (autoBackupSkipNextChangeRef.current) {
      autoBackupSkipNextChangeRef.current = false;
      return;
    }

    if (!data.metadata?.pendingSync && !justEnabled) {
      return;
    }

    const pendingSyncAt = data.metadata?.pendingSyncAt ? new Date(data.metadata.pendingSyncAt).getTime() : null;
    const pendingAge = pendingSyncAt && !Number.isNaN(pendingSyncAt) ? Date.now() - pendingSyncAt : 0;
    const delay = pendingAge >= maxPendingSyncMs || justEnabled ? 0 : syncDebounceMs;

    autoBackupTimerRef.current = window.setTimeout(() => {
      autoBackupTimerRef.current = null;
      void runAutoBackup();
    }, delay);
  }, [
    backupConflict,
    data,
    invalidTokenConfirm,
    liveData,
    localBookmarkBackupEnabled,
    missingGistConfirm,
    remoteBackupReady,
    runAutoBackup,
  ]);

  useEffect(() => {
    return () => {
      if (autoBackupTimerRef.current !== null) {
        window.clearTimeout(autoBackupTimerRef.current);
        autoBackupTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void runRemotePullCheck();
    }, remotePullIntervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [runRemotePullCheck]);

  useEffect(() => {
    if (
      !(remoteBackupReady || localBookmarkBackupEnabled) ||
      !liveData ||
      backupConflict ||
      missingGistConfirm ||
      invalidTokenConfirm ||
      startupSyncDoneRef.current ||
      startupSyncTimerRef.current !== null
    )
      return;
    startupSyncTimerRef.current = window.setTimeout(() => {
      startupSyncTimerRef.current = null;
      startupSyncDoneRef.current = true;
      void runAutoBackup(true);
    }, startupSyncDelayMs);

    return () => {
      if (startupSyncTimerRef.current !== null) {
        window.clearTimeout(startupSyncTimerRef.current);
        startupSyncTimerRef.current = null;
      }
    };
  }, [
    backupConflict,
    data,
    invalidTokenConfirm,
    liveData,
    localBookmarkBackupEnabled,
    missingGistConfirm,
    remoteBackupReady,
    runAutoBackup,
  ]);

  useEffect(() => {
    const syncWhenVisible = () => {
      if (
        document.visibilityState !== "visible" ||
        !(remoteBackupReady || localBookmarkBackupEnabled) ||
        !liveData ||
        backupConflict ||
        missingGistConfirm ||
        invalidTokenConfirm
      )
        return;
      const lastSyncAt = data.metadata?.lastSyncAt ? new Date(data.metadata.lastSyncAt).getTime() : 0;
      if (lastSyncAt && Date.now() - lastSyncAt < foregroundSyncMinGapMs) return;
      void runAutoBackup(true);
    };
    document.addEventListener("visibilitychange", syncWhenVisible);
    window.addEventListener("focus", syncWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.removeEventListener("focus", syncWhenVisible);
    };
  }, [
    backupConflict,
    data,
    invalidTokenConfirm,
    liveData,
    localBookmarkBackupEnabled,
    missingGistConfirm,
    remoteBackupReady,
    runAutoBackup,
  ]);

  return {
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
    pendingImportKindRef,
    importAccept: importAcceptForKind(pendingImportKindRef.current),
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
  };
}
