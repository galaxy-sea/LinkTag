import type {
  BackupProvider,
  EdgeLineType,
  ElkLayout,
  GraphWindowRect,
  GroupOpenMode,
  LinkView,
  MainMode,
  TagDisplayFormat,
  TagGroupSort,
  WindowGroupLayout,
} from "./types";

type BackupSyncSettingName =
  "backupProvider" | "backupGithubToken" | "backupGiteeToken" | "backupGithubGist" | "backupGiteeGist";

type BrowserSyncStorageArea = {
  get(keys: string[], callback?: (items: Record<string, unknown>) => void): Promise<Record<string, unknown>> | void;
  set(items: Record<string, string>, callback?: () => void): Promise<void> | void;
};

type BrowserStorageGlobal = {
  chrome?: {
    runtime?: { lastError?: { message?: string } };
    storage?: { sync?: BrowserSyncStorageArea };
  };
  browser?: {
    storage?: { sync?: BrowserSyncStorageArea };
  };
};

const key = {
  lastMainMode: "linktag.lastMainMode",
  linkView: "linktag.linkView",
  windowGroupLayout: "linktag.windowGroupLayout",
  tagGroupSort: "linktag.tagGroupSort",
  tagDisplayFormat: "linktag.tagDisplayFormat",
  filterWindowLinks: "linktag.filterWindowLinks",
  groupOpenMode: "linktag.groupOpenMode",
  elkLayout: "linktag.elkLayout",
  edgeLineType: "linktag.edgeLineType",
  graphShortcut: "linktag.graphShortcut",
  searchShortcut: "linktag.searchShortcut",
  backupProvider: "linktag.backupProvider",
  backupGithubToken: "linktag.backupGithubToken",
  backupGiteeToken: "linktag.backupGiteeToken",
  backupGithubGist: "linktag.backupGithubGist",
  backupGiteeGist: "linktag.backupGiteeGist",
  localBookmarkBackupEnabled: "linktag.localBookmarkBackupEnabled",
  syncSetupPromptDismissed: "linktag.syncSetupPromptDismissed",
  graphWindowRect: "linktag.graphWindowRect",
} as const;

function defaultGraphWindowRect(): GraphWindowRect {
  const viewportWidth = globalThis.innerWidth || 1024;
  const viewportHeight = globalThis.innerHeight || 768;
  if (viewportWidth < 640) {
    return {
      x: 8,
      y: 96,
      width: Math.max(280, viewportWidth - 16),
      height: Math.max(260, viewportHeight - 104),
    };
  }
  return { x: 72, y: 92, width: 840, height: 560 };
}
const backupSyncSettingNames: BackupSyncSettingName[] = [
  "backupProvider",
  "backupGithubToken",
  "backupGiteeToken",
  "backupGithubGist",
  "backupGiteeGist",
];

function isBackupSyncSettingName(name: keyof typeof key): name is BackupSyncSettingName {
  return backupSyncSettingNames.includes(name as BackupSyncSettingName);
}

function browserSyncStorage() {
  const global = globalThis as BrowserStorageGlobal;
  return global.chrome?.storage?.sync ?? global.browser?.storage?.sync ?? null;
}

function browserLastErrorMessage() {
  const global = globalThis as BrowserStorageGlobal;
  return global.chrome?.runtime?.lastError?.message;
}

async function browserSyncGet(area: BrowserSyncStorageArea, keysToRead: string[]) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const done = (items: Record<string, unknown>) => {
      const error = browserLastErrorMessage();
      if (error) reject(new Error(error));
      else resolve(items);
    };
    const result = area.get(keysToRead, done);
    if (result && typeof result.then === "function") result.then(resolve, reject);
  });
}

async function browserSyncSet(area: BrowserSyncStorageArea, items: Record<string, string>) {
  return new Promise<void>((resolve, reject) => {
    const done = () => {
      const error = browserLastErrorMessage();
      if (error) reject(new Error(error));
      else resolve();
    };
    const result = area.set(items, done);
    if (result && typeof result.then === "function") result.then(resolve, reject);
  });
}

function writeBackupSettingToSyncStorage(name: BackupSyncSettingName, value: string) {
  const area = browserSyncStorage();
  if (!area) return;
  void browserSyncSet(area, { [key[name]]: value }).catch(() => undefined);
}

function readOne<T extends string>(storageKey: string, fallback: T, allowed: readonly T[]) {
  const value = localStorage.getItem(storageKey);
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function readBoolean(storageKey: string, fallback: boolean) {
  const value = localStorage.getItem(storageKey);
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function readUrlParam(params: URLSearchParams, names: string[]) {
  for (const name of names) {
    const value = params.get(name);
    if (value !== null && value.trim()) return value.trim();
  }
  return "";
}

function normalizeBackupProvider(value: string): BackupProvider | "" {
  const normalized = value.trim().toLowerCase();
  return normalized === "github" || normalized === "gitee" ? normalized : "";
}

function extractGistIdFromSetting(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    return url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  } catch {
    return trimmed;
  }
}

export function applyWebBackupSettingsFromUrl() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const nextProvider = normalizeBackupProvider(readUrlParam(params, ["type"]));
  const token = readUrlParam(params, ["Token"]);
  const gist = readUrlParam(params, ["Gist"]);
  if (!nextProvider && !token && !gist) return false;

  const provider = nextProvider || readSettings().backupProvider;
  writeSetting("backupProvider", provider);
  if (token) writeSetting(provider === "github" ? "backupGithubToken" : "backupGiteeToken", token);
  if (gist)
    writeSetting(provider === "github" ? "backupGithubGist" : "backupGiteeGist", extractGistIdFromSetting(gist));

  for (const name of ["type", "Token", "Gist"]) {
    params.delete(name);
  }
  const nextSearch = params.toString();
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`,
  );
  return true;
}

function readGraphWindowRect() {
  const raw = localStorage.getItem(key.graphWindowRect);
  if (!raw) return defaultGraphWindowRect();
  try {
    const parsed = JSON.parse(raw) as Partial<GraphWindowRect>;
    const values = [parsed.x, parsed.y, parsed.width, parsed.height];
    if (values.every((value) => typeof value === "number" && Number.isFinite(value))) {
      return {
        x: parsed.x!,
        y: parsed.y!,
        width: parsed.width!,
        height: parsed.height!,
      };
    }
  } catch {
    return defaultGraphWindowRect();
  }
  return defaultGraphWindowRect();
}

export function readSettings() {
  const lastMainMode = readOne<MainMode>(key.lastMainMode, "links", ["links", "graph"]);
  const graphShortcut = localStorage.getItem(key.graphShortcut);
  const searchShortcut = localStorage.getItem(key.searchShortcut);
  return {
    lastMainMode,
    initialMode: lastMainMode,
    linkView: readOne<LinkView>(key.linkView, "card", ["card", "compact", "list", "grid"]),
    windowGroupLayout: readOne<WindowGroupLayout>(key.windowGroupLayout, "right", [
      "top",
      "top-hover",
      "right",
      "right-hover",
    ]),
    tagGroupSort: readOne<TagGroupSort>(key.tagGroupSort, "updated-desc", [
      "updated-desc",
      "updated-asc",
      "weight-desc",
      "weight-asc",
      "name-asc",
      "name-desc",
    ]),
    tagDisplayFormat: readOne<TagDisplayFormat>(key.tagDisplayFormat, "tag", [
      "tag",
      "relation",
      "tag-relation",
      "relation-tag",
    ]),
    filterWindowLinks: readBoolean(key.filterWindowLinks, true),
    groupOpenMode: readOne<GroupOpenMode>(key.groupOpenMode, "tab-group", ["tab-group", "tabs"]),
    elkLayout: readOne<ElkLayout>(key.elkLayout, "horizontal", ["horizontal", "vertical", "force", "stress"]),
    edgeLineType: readOne<EdgeLineType>(key.edgeLineType, "curve", ["curve", "orthogonal", "straight", "none"]),
    graphShortcut: graphShortcut || "Mod+G",
    searchShortcut: searchShortcut || "Mod+F",
    backupProvider: readOne<BackupProvider>(key.backupProvider, "github", ["github", "gitee"]),
    backupGithubToken: localStorage.getItem(key.backupGithubToken) || "",
    backupGiteeToken: localStorage.getItem(key.backupGiteeToken) || "",
    backupGithubGist: localStorage.getItem(key.backupGithubGist) || "",
    backupGiteeGist: localStorage.getItem(key.backupGiteeGist) || "",
    localBookmarkBackupEnabled: readBoolean(key.localBookmarkBackupEnabled, false),
    syncSetupPromptDismissed: readBoolean(key.syncSetupPromptDismissed, false),
    graphWindowRect: readGraphWindowRect(),
  };
}

export function writeSetting(name: keyof typeof key, value: string) {
  localStorage.setItem(key[name], value);
  if (isBackupSyncSettingName(name)) writeBackupSettingToSyncStorage(name, value);
}

export async function hydrateBackupSettingsFromSyncStorage() {
  const area = browserSyncStorage();
  if (!area) return null;

  const storageKeys = backupSyncSettingNames.map((name) => key[name]);
  const synced = await browserSyncGet(area, storageKeys);
  const missingSyncValues: Record<string, string> = {};

  for (const name of backupSyncSettingNames) {
    const storageKey = key[name];
    const syncedValue = synced[storageKey];
    if (typeof syncedValue === "string" && (syncedValue || name === "backupProvider")) {
      localStorage.setItem(storageKey, syncedValue);
      continue;
    }

    const localValue = localStorage.getItem(storageKey) || "";
    if (localValue || name === "backupProvider") {
      missingSyncValues[storageKey] = localValue || readSettings().backupProvider;
    }
  }

  if (Object.keys(missingSyncValues).length) {
    await browserSyncSet(area, missingSyncValues);
  }

  const settings = readSettings();
  return {
    backupProvider: settings.backupProvider,
    backupGithubToken: settings.backupGithubToken,
    backupGiteeToken: settings.backupGiteeToken,
    backupGithubGist: settings.backupGithubGist,
    backupGiteeGist: settings.backupGiteeGist,
  };
}
