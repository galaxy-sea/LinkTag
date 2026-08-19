import { useCallback, useEffect, useMemo, useState } from "react";

import { extractGistId, remoteGistHref } from "../../backup/backup";
import {
  applyWebBackupSettingsFromUrl,
  hydrateBackupSettingsFromSyncStorage,
  readSettings,
  writeSetting,
} from "../../storage";
import { normalizeRecordedShortcut } from "../../core/shortcuts";
import type {
  AppRuntime,
  BackupProvider,
  EdgeLineType,
  ElkLayout,
  GroupOpenMode,
  LinkView,
  MainMode,
  TagDisplayFormat,
  TagGroupSort,
  WindowGroupLayout,
} from "../../types";

export function useAppSettings(runtime: AppRuntime) {
  const initialSettings = useMemo(() => {
    if (runtime === "web") applyWebBackupSettingsFromUrl();
    return readSettings();
  }, [runtime]);
  const [mode, setMode] = useState<MainMode>(initialSettings.initialMode);
  const [linkView, setLinkView] = useState<LinkView>(initialSettings.linkView);
  const [windowGroupLayout, setWindowGroupLayout] = useState<WindowGroupLayout>(initialSettings.windowGroupLayout);
  const [tagGroupSort, setTagGroupSort] = useState<TagGroupSort>(initialSettings.tagGroupSort);
  const [tagDisplayFormat, setTagDisplayFormat] = useState<TagDisplayFormat>(initialSettings.tagDisplayFormat);
  const [filterWindowLinks, setFilterWindowLinks] = useState(initialSettings.filterWindowLinks);
  const [groupOpenMode, setGroupOpenMode] = useState<GroupOpenMode>(initialSettings.groupOpenMode);
  const [elkLayout, setElkLayout] = useState<ElkLayout>(initialSettings.elkLayout);
  const [edgeLineType, setEdgeLineType] = useState<EdgeLineType>(initialSettings.edgeLineType);
  const [graphShortcut, setGraphShortcut] = useState(initialSettings.graphShortcut);
  const [searchShortcut, setSearchShortcut] = useState(initialSettings.searchShortcut);
  const [backupProvider, setBackupProvider] = useState<BackupProvider>(initialSettings.backupProvider);
  const [backupGithubToken, setBackupGithubToken] = useState(initialSettings.backupGithubToken);
  const [backupGiteeToken, setBackupGiteeToken] = useState(initialSettings.backupGiteeToken);
  const [backupGithubGist, setBackupGithubGist] = useState(initialSettings.backupGithubGist);
  const [backupGiteeGist, setBackupGiteeGist] = useState(initialSettings.backupGiteeGist);
  const [localBookmarkBackupEnabled, setLocalBookmarkBackupEnabled] = useState(
    initialSettings.localBookmarkBackupEnabled,
  );
  const [syncSetupPromptDismissed, setSyncSetupPromptDismissed] = useState(initialSettings.syncSetupPromptDismissed);
  const [backupSettingsLoaded, setBackupSettingsLoaded] = useState(runtime === "web");

  useEffect(() => {
    if (runtime === "web") {
      setBackupSettingsLoaded(true);
      return;
    }
    let disposed = false;
    void hydrateBackupSettingsFromSyncStorage()
      .then((settings) => {
        if (disposed || !settings) return;
        setBackupProvider(settings.backupProvider);
        setBackupGithubToken(settings.backupGithubToken);
        setBackupGiteeToken(settings.backupGiteeToken);
        setBackupGithubGist(extractGistId(settings.backupGithubGist));
        setBackupGiteeGist(extractGistId(settings.backupGiteeGist));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!disposed) setBackupSettingsLoaded(true);
      });
    return () => {
      disposed = true;
    };
  }, [runtime]);

  useEffect(() => {
    writeSetting("lastMainMode", mode);
  }, [mode]);

  const changeMode = useCallback((nextMode: MainMode) => {
    setMode(nextMode);
    writeSetting("lastMainMode", nextMode);
  }, []);

  const saveLinkView = useCallback((nextLinkView: LinkView) => {
    setLinkView(nextLinkView);
    writeSetting("linkView", nextLinkView);
  }, []);

  const saveWindowGroupLayout = useCallback((nextLayout: WindowGroupLayout) => {
    setWindowGroupLayout(nextLayout);
    writeSetting("windowGroupLayout", nextLayout);
  }, []);

  const saveTagGroupSort = useCallback((nextSort: TagGroupSort) => {
    setTagGroupSort(nextSort);
    writeSetting("tagGroupSort", nextSort);
  }, []);

  const saveTagDisplayFormat = useCallback((nextFormat: TagDisplayFormat) => {
    setTagDisplayFormat(nextFormat);
    writeSetting("tagDisplayFormat", nextFormat);
  }, []);

  const saveFilterWindowLinks = useCallback((enabled: boolean) => {
    setFilterWindowLinks(enabled);
    writeSetting("filterWindowLinks", String(enabled));
  }, []);

  const saveGroupOpenMode = useCallback((nextMode: GroupOpenMode) => {
    setGroupOpenMode(nextMode);
    writeSetting("groupOpenMode", nextMode);
  }, []);

  const saveElkLayout = useCallback((nextLayout: ElkLayout) => {
    setElkLayout(nextLayout);
    writeSetting("elkLayout", nextLayout);
  }, []);

  const saveEdgeLineType = useCallback((nextLineType: EdgeLineType) => {
    setEdgeLineType(nextLineType);
    writeSetting("edgeLineType", nextLineType);
  }, []);

  const saveGraphShortcut = useCallback((nextShortcut: string) => {
    const normalized = normalizeRecordedShortcut(nextShortcut);
    setGraphShortcut(normalized);
    writeSetting("graphShortcut", normalized);
  }, []);

  const saveSearchShortcut = useCallback((nextShortcut: string) => {
    const normalized = normalizeRecordedShortcut(nextShortcut);
    setSearchShortcut(normalized);
    writeSetting("searchShortcut", normalized);
  }, []);

  const saveBackupProvider = useCallback((nextProvider: BackupProvider) => {
    setBackupProvider(nextProvider);
    writeSetting("backupProvider", nextProvider);
  }, []);

  const saveBackupGithubToken = useCallback((nextToken: string) => {
    setBackupGithubToken(nextToken);
    writeSetting("backupGithubToken", nextToken);
  }, []);

  const saveBackupGiteeToken = useCallback((nextToken: string) => {
    setBackupGiteeToken(nextToken);
    writeSetting("backupGiteeToken", nextToken);
  }, []);

  const saveLocalBookmarkBackupEnabled = useCallback((enabled: boolean) => {
    setLocalBookmarkBackupEnabled(enabled);
    writeSetting("localBookmarkBackupEnabled", String(enabled));
  }, []);

  const saveSyncSetupPromptDismissed = useCallback((dismissed: boolean) => {
    setSyncSetupPromptDismissed(dismissed);
    writeSetting("syncSetupPromptDismissed", String(dismissed));
  }, []);

  const saveBackupGistForProvider = useCallback((provider: BackupProvider, nextGist: string) => {
    const gistId = extractGistId(nextGist);
    if (provider === "github") {
      setBackupGithubGist(gistId);
      writeSetting("backupGithubGist", gistId);
    } else {
      setBackupGiteeGist(gistId);
      writeSetting("backupGiteeGist", gistId);
    }
  }, []);

  const saveBackupGist = useCallback(
    (nextGist: string) => {
      saveBackupGistForProvider(backupProvider, nextGist);
    },
    [backupProvider, saveBackupGistForProvider],
  );

  const currentBackupGist = backupProvider === "github" ? backupGithubGist : backupGiteeGist;
  const currentBackupGistHref = useMemo(
    () => remoteGistHref(backupProvider, currentBackupGist),
    [backupProvider, currentBackupGist],
  );

  return {
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
    currentBackupGist,
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
  };
}
