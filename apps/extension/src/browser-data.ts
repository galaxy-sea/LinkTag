import { createRuntimeInfo, db, getActiveCollectionId, markLocalDataChanged, nowIso } from "@linktag/app/db";
import { createBrowserBookmarkHierarchy } from "@linktag/app/backup/bookmark-import";
import type { BrowserBookmarkExportData } from "@linktag/app";
import type {
  BrowserTab,
  BrowserWindow,
  GroupOpenMode,
  Id,
  LinkRecord,
  LinkTagRecord,
  TagRecord,
  TagRelationRecord,
} from "@linktag/app/types";
import { browser, type Browser } from "wxt/browser";

type BrowserWithTabGroups = typeof browser & {
  tabs: typeof browser.tabs & {
    group(options: { tabIds: number[] }): Promise<number>;
  };
  tabGroups: {
    update(groupId: number, options: { title: string }): Promise<unknown>;
  };
};

type ChromeTabGroupsApi = {
  runtime?: { lastError?: { message?: string } };
  tabs?: {
    group(options: { tabIds: number[] }, callback: (groupId: number) => void): void;
  };
  tabGroups?: {
    update(groupId: number, options: { title: string }, callback: () => void): void;
  };
};

type TabGroupController = {
  group(tabIds: number[]): Promise<number>;
  update(groupId: number, title: string): Promise<void>;
};

export function isCollectableUrl(url?: string) {
  if (!url) return false;
  return /^(https?|file):/i.test(url);
}

export function linkIdForUrl(url: string) {
  return `link_${hashText(url)}`;
}

function hashText(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function tagIdForBookmarkPath(path: string[]) {
  return `tag_bookmark_${hashText(path.join("\u001f"))}`;
}

function relationIdForBookmarkFolders(sourceTagId: Id, targetTagId: Id) {
  return `rel_bookmark_${hashText(`${sourceTagId}->${targetTagId}`)}`;
}

function tagRelationPairKey(firstTagId: Id, secondTagId: Id) {
  return [firstTagId, secondTagId].sort().join("::");
}

export function faviconForUrl(url: string, fallback?: string) {
  if (fallback) return fallback;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return undefined;
  }
}

export async function getCurrentTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

export async function readCollectCurrentPageShortcut() {
  const commands = await browser.commands.getAll();
  return commands.find((command) => command.name === "collect-current-page")?.shortcut ?? "";
}

export async function openExtensionShortcutSettings() {
  await browser.tabs.create({ url: "chrome://extensions/shortcuts" });
}

export async function openLinksInBrowser(links: LinkRecord[], title: string, mode: GroupOpenMode) {
  const uniqueUrls = [...new Set(links.map((link) => link.url).filter(Boolean))];
  if (uniqueUrls.length === 0) return;

  const openedTabs: Browser.tabs.Tab[] = [];
  for (const url of uniqueUrls) {
    openedTabs.push(await browser.tabs.create({ url, active: false }));
  }

  if (mode !== "tab-group") return;
  const tabGroups = getTabGroupController();
  if (!tabGroups) return;
  const tabIds = openedTabs.map((tab) => tab.id).filter((id): id is number => typeof id === "number");
  if (tabIds.length === 0) return;
  const groupId = await tabGroups.group(tabIds);
  await tabGroups.update(groupId, title.slice(0, 80) || "LinkTag");
}

function getTabGroupController(): TabGroupController | null {
  const browserWithGroups = browser as Partial<BrowserWithTabGroups>;
  if (typeof browserWithGroups.tabs?.group === "function" && browserWithGroups.tabGroups) {
    return {
      group: (tabIds) => browserWithGroups.tabs!.group({ tabIds }),
      update: async (groupId, title) => {
        await browserWithGroups.tabGroups!.update(groupId, { title });
      },
    };
  }

  const chromeApi = (globalThis as { chrome?: ChromeTabGroupsApi }).chrome;
  if (typeof chromeApi?.tabs?.group !== "function" || !chromeApi.tabGroups) return null;
  return {
    group: (tabIds) =>
      new Promise((resolve, reject) => {
        chromeApi.tabs!.group({ tabIds }, (groupId) => {
          const error = chromeApi.runtime?.lastError?.message;
          if (error) reject(new Error(error));
          else resolve(groupId);
        });
      }),
    update: (groupId, title) =>
      new Promise((resolve, reject) => {
        chromeApi.tabGroups!.update(groupId, { title }, () => {
          const error = chromeApi.runtime?.lastError?.message;
          if (error) reject(new Error(error));
          else resolve();
        });
      }),
  };
}

export async function getBrowserWindows(): Promise<BrowserWindow[]> {
  const windows = await browser.windows.getAll({ populate: true, windowTypes: ["normal"] });
  return windows.map((window, index) => ({
    id: `window_${window.id ?? index + 1}`,
    name: `窗口 ${index + 1}`,
    tabs: (window.tabs ?? [])
      .filter((tab) => isCollectableUrl(tab.url))
      .map((tab) => browserTabToLinkTagTab(tab, `window_${window.id ?? index + 1}`)),
  }));
}

export function browserTabToLinkTagTab(tab: Browser.tabs.Tab, windowId: string): BrowserTab {
  const url = tab.url ?? "";
  return {
    id: `tab_${tab.id ?? linkIdForUrl(url)}`,
    windowId,
    linkId: linkIdForUrl(url),
    url,
    title: tab.title || url,
    favicon: faviconForUrl(url, tab.favIconUrl),
  };
}

const bookmarkTagColors = [
  "#93c5fd",
  "#67e8f9",
  "#6ee7b7",
  "#bef264",
  "#fde047",
  "#fdba74",
  "#fca5a5",
  "#f9a8d4",
  "#e9d5ff",
  "#c4b5fd",
  "#a5b4fc",
  "#5eead4",
  "#86efac",
  "#d9f99d",
  "#fef08a",
  "#fed7aa",
  "#fecaca",
  "#fbcfe8",
  "#ddd6fe",
  "#cbd5e1",
];

const localBookmarkBackupFolderName = "LinkTag";
const untaggedBookmarkFolderName = "未绑定标签";

function colorForBookmarkPath(path: string[]) {
  return bookmarkTagColors[
    hashText(path.join("\u001f"))
      .split("")
      .reduce((total, char) => total + char.charCodeAt(0), 0) % bookmarkTagColors.length
  ];
}

export type BrowserBookmarkImportData = {
  links: LinkRecord[];
  tags: TagRecord[];
  link_tags: LinkTagRecord[];
  tag_relations: TagRelationRecord[];
};

async function readBookmarkChildren(parentId: string) {
  return browser.bookmarks.getChildren(parentId);
}

async function getDefaultBookmarkParentId() {
  const [root] = await browser.bookmarks.getTree();
  const writableTopFolder = root.children?.find((node) => !node.unmodifiable);
  return writableTopFolder?.id ?? root.children?.[0]?.id ?? root.id;
}

async function findLocalBookmarkBackupFolder() {
  const matches = await browser.bookmarks.search({ title: localBookmarkBackupFolderName });
  return matches.find((node) => !node.url && !node.unmodifiable) ?? null;
}

async function ensureLocalBookmarkBackupFolder() {
  const existingFolder = await findLocalBookmarkBackupFolder();
  if (existingFolder) return existingFolder;
  return browser.bookmarks.create({
    parentId: await getDefaultBookmarkParentId(),
    title: localBookmarkBackupFolderName,
  });
}

async function clearBookmarkFolder(folderId: string) {
  const children = await readBookmarkChildren(folderId);
  for (const child of children) {
    await browser.bookmarks.removeTree(child.id);
  }
}

async function createBookmark(parentId: string, title: string, url: string) {
  try {
    await browser.bookmarks.create({ parentId, title, url });
    return true;
  } catch (error) {
    console.warn("[LinkTag] 本地书签同步：链接写入失败", {
      标题: title,
      URL: url,
      错误信息: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function createBookmarkFolder(parentId: string, title: string) {
  return browser.bookmarks.create({ parentId, title });
}

export async function writeBrowserBookmarkBackup(data: BrowserBookmarkExportData) {
  const folder = await ensureLocalBookmarkBackupFolder();
  await clearBookmarkFolder(folder.id);

  const hierarchy = createBrowserBookmarkHierarchy(data);
  let writtenCount = 0;

  const writeFolder = async (parentId: string, bookmarkFolder: (typeof hierarchy.folders)[number]) => {
    const tagFolder = await createBookmarkFolder(parentId, bookmarkFolder.tag.name);
    for (const link of bookmarkFolder.links) {
      if (await createBookmark(tagFolder.id, link.title || link.url, link.url)) writtenCount += 1;
    }
    for (const child of bookmarkFolder.children) await writeFolder(tagFolder.id, child);
  };

  for (const bookmarkFolder of hierarchy.folders) {
    await writeFolder(folder.id, bookmarkFolder);
  }

  if (hierarchy.untaggedLinks.length > 0) {
    const untaggedFolder = await createBookmarkFolder(folder.id, untaggedBookmarkFolderName);
    for (const link of hierarchy.untaggedLinks) {
      if (await createBookmark(untaggedFolder.id, link.title || link.url, link.url)) writtenCount += 1;
    }
  }

  console.info("[LinkTag] 本地书签同步完成", {
    文件夹: localBookmarkBackupFolderName,
    链接数量: writtenCount,
    标签数量: data.tags.length,
  });
}

export async function readBrowserBookmarkData(): Promise<BrowserBookmarkImportData> {
  const collectionId = getActiveCollectionId();
  const exportedAt = nowIso();
  let sortCursor = Date.now();
  const linksById = new Map<Id, LinkRecord>();
  const tagsById = new Map<Id, TagRecord>();
  const linkTagsByKey = new Map<string, LinkTagRecord>();
  const relationsByKey = new Map<string, TagRelationRecord>();

  const addFolderTag = (path: string[]) => {
    const name = path.at(-1)?.trim();
    if (!name) return null;
    const id = tagIdForBookmarkPath(path);
    if (!tagsById.has(id)) {
      tagsById.set(id, {
        id,
        collectionId,
        name,
        color: colorForBookmarkPath(path),
        sort: sortCursor--,
        updatedAt: exportedAt,
      });
    }
    return tagsById.get(id) ?? null;
  };

  const addFolderRelation = (sourceTagId: Id | null, targetTagId: Id | null) => {
    if (!sourceTagId || !targetTagId || sourceTagId === targetTagId) return;
    const key = tagRelationPairKey(sourceTagId, targetTagId);
    if (relationsByKey.has(key)) return;
    relationsByKey.set(key, {
      id: relationIdForBookmarkFolders(sourceTagId, targetTagId),
      collectionId,
      sourceTagId,
      targetTagId,
      name: "包含",
    });
  };

  const addBookmarkLink = (node: Browser.bookmarks.BookmarkTreeNode, path: string[], currentTagId: Id | null) => {
    if (!isCollectableUrl(node.url) || !node.url) return;
    const id = linkIdForUrl(node.url);
    if (!linksById.has(id)) {
      linksById.set(id, {
        id,
        collectionId,
        url: node.url,
        title: node.title || node.url,
        note: "",
        sort: sortCursor--,
      });
    }

    const tagIds = path
      .map((_, index) => addFolderTag(path.slice(0, index + 1))?.id)
      .filter((tagId): tagId is Id => Boolean(tagId));
    if (tagIds.length === 0 && currentTagId) tagIds.push(currentTagId);
    if (tagIds.length === 0) {
      const fallbackTag = addFolderTag(["浏览器书签"]);
      if (fallbackTag) tagIds.push(fallbackTag.id);
    }
    for (const tagId of tagIds) {
      const key = `${id}:${tagId}`;
      if (!linkTagsByKey.has(key)) linkTagsByKey.set(key, { collectionId, linkId: id, tagId });
    }
  };

  const visit = (nodes: Browser.bookmarks.BookmarkTreeNode[], path: string[], parentTagId: Id | null) => {
    for (const node of nodes) {
      if (node.url) {
        addBookmarkLink(node, path, parentTagId);
        continue;
      }
      const folderName = node.title?.trim();
      const nextPath = folderName ? [...path, folderName] : path;
      const tag = folderName ? addFolderTag(nextPath) : null;
      addFolderRelation(parentTagId, tag?.id ?? null);
      if (node.children) visit(node.children, nextPath, tag?.id ?? parentTagId);
    }
  };

  visit(await browser.bookmarks.getTree(), [], null);
  return {
    links: [...linksById.values()],
    tags: [...tagsById.values()],
    link_tags: [...linkTagsByKey.values()],
    tag_relations: [...relationsByKey.values()],
  };
}

export async function importBrowserBookmarks() {
  const data = await readBrowserBookmarkData();
  if (data.links.length === 0) return 0;

  await db.transaction("rw", db.links, db.tags, db.link_tags, db.tag_relations, async () => {
    if (data.links.length) await db.links.bulkPut(data.links);
    if (data.tags.length) await db.tags.bulkPut(data.tags);
    if (data.link_tags.length) await db.link_tags.bulkPut(data.link_tags);
    if (data.tag_relations.length) {
      const collectionId = getActiveCollectionId();
      const existingRelations = await db.tag_relations.where("collectionId").equals(collectionId).toArray();
      const relationKeys = new Set(
        existingRelations.map((relation) => tagRelationPairKey(relation.sourceTagId, relation.targetTagId)),
      );
      const relationsToPut = data.tag_relations.filter((relation) => {
        const key = tagRelationPairKey(relation.sourceTagId, relation.targetTagId);
        if (relationKeys.has(key)) return false;
        relationKeys.add(key);
        return true;
      });
      if (relationsToPut.length) await db.tag_relations.bulkPut(relationsToPut);
    }
  });
  await markLocalDataChanged(createRuntimeInfo("extension"));

  return data.links.length;
}
