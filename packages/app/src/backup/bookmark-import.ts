import { colorChoices } from "../core/colors";
import { getActiveCollectionId, nowIso } from "../db";
import type { Id, LinkRecord, LinkTagRecord, TagRecord, TagRelationRecord } from "../types";

export type BrowserBookmarkImportData = {
  links: LinkRecord[];
  tags: TagRecord[];
  link_tags: LinkTagRecord[];
  tag_relations: TagRelationRecord[];
};

export type BrowserBookmarkExportData = {
  links: LinkRecord[];
  tags: TagRecord[];
  linkTags: LinkTagRecord[];
};

export type BrowserBookmarkFolder = {
  tag: TagRecord;
  links: LinkRecord[];
  children: BrowserBookmarkFolder[];
};

export type BrowserBookmarkHierarchy = {
  folders: BrowserBookmarkFolder[];
  untaggedLinks: LinkRecord[];
};

function isCollectableUrl(url: string | null | undefined) {
  return Boolean(url && /^(https?|file):/i.test(url));
}

function hashText(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function linkIdForUrl(url: string) {
  return `link_${hashText(url)}`;
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

function colorForBookmarkPath(path: string[]) {
  return colorChoices[
    hashText(path.join("\u001f"))
      .split("")
      .reduce((total, char) => total + char.charCodeAt(0), 0) % colorChoices.length
  ];
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function bookmarkTimestamp() {
  return Math.floor(Date.now() / 1000);
}

function compareTags(left: TagRecord, right: TagRecord) {
  const sortDiff = (right.sort ?? 0) - (left.sort ?? 0);
  if (sortDiff !== 0) return sortDiff;
  return left.name.localeCompare(right.name);
}

function linksForTag(tagId: Id, linkTags: LinkTagRecord[], linksById: Map<Id, LinkRecord>) {
  return linkTags
    .filter((binding) => binding.tagId === tagId)
    .map((binding) => linksById.get(binding.linkId))
    .filter((link): link is LinkRecord => Boolean(link));
}

export function createBrowserBookmarkHierarchy(data: BrowserBookmarkExportData): BrowserBookmarkHierarchy {
  const linksById = new Map(data.links.map((link) => [link.id, link]));
  const linkTagIds = new Set(data.linkTags.map((binding) => binding.linkId));

  return {
    folders: [...data.tags].sort(compareTags).map((tag) => ({
      tag,
      links: linksForTag(tag.id, data.linkTags, linksById),
      children: [],
    })),
    untaggedLinks: data.links.filter((link) => !linkTagIds.has(link.id)),
  };
}

function pushBookmarkFolderLines(lines: string[], folder: BrowserBookmarkFolder, timestamp: number, indent: string) {
  lines.push(
    `${indent}<DT><H3 ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}">${escapeHtml(folder.tag.name)}</H3>`,
  );
  lines.push(`${indent}<DL><p>`);
  for (const link of folder.links) lines.push(...linkBookmarkLine(link, timestamp, `${indent}    `));
  for (const child of folder.children) pushBookmarkFolderLines(lines, child, timestamp, `${indent}    `);
  lines.push(`${indent}</DL><p>`);
}

function linkBookmarkLine(link: LinkRecord, timestamp: number, indent = "        ") {
  const title = escapeHtml(link.title || link.url);
  const url = escapeHtml(link.url);
  const note = link.note?.trim();
  return [
    `${indent}<DT><A HREF="${url}" ADD_DATE="${timestamp}">${title}</A>`,
    note ? `${indent}<DD>${escapeHtml(note)}` : null,
  ].filter((line): line is string => Boolean(line));
}

export function createBrowserBookmarkHtml(data: BrowserBookmarkExportData) {
  const timestamp = bookmarkTimestamp();
  const hierarchy = createBrowserBookmarkHierarchy(data);
  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
    `    <DT><H3 ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}">LinkTag</H3>`,
    "    <DL><p>",
  ];

  for (const folder of hierarchy.folders) pushBookmarkFolderLines(lines, folder, timestamp, "        ");

  if (hierarchy.untaggedLinks.length > 0) {
    lines.push(`        <DT><H3 ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}">未绑定标签</H3>`);
    lines.push("        <DL><p>");
    for (const link of hierarchy.untaggedLinks) lines.push(...linkBookmarkLine(link, timestamp));
    lines.push("        </DL><p>");
  }

  lines.push("    </DL><p>", "</DL><p>");
  return lines.join("\n");
}

export function browserBookmarkExportFilename(exportedAt: string) {
  return `linktag-bookmarks-${exportedAt.replace(/[:.]/g, "-")}.html`;
}

function directChildElementByTag(parent: Element, tagName: string) {
  const normalized = tagName.toUpperCase();
  return Array.from(parent.children).find((child) => child.tagName === normalized) ?? null;
}

function nextElementAfterBookmarkFolder(dtElement: Element, childDl: Element | null) {
  if (childDl && childDl.parentElement === dtElement) return dtElement.nextElementSibling;
  if (childDl && childDl.previousElementSibling === dtElement) return childDl.nextElementSibling;
  return dtElement.nextElementSibling;
}

export function parseBrowserBookmarkFile(content: string): BrowserBookmarkImportData {
  const collectionId = getActiveCollectionId();
  const document = new DOMParser().parseFromString(content, "text/html");
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

  const addBookmarkLink = (anchor: Element, currentTagId: Id | null, currentPath: string[]) => {
    const url = anchor.getAttribute("href")?.trim() ?? "";
    if (!isCollectableUrl(url)) return;
    const id = linkIdForUrl(url);
    const link: LinkRecord = {
      id,
      collectionId,
      url,
      title: anchor.textContent?.trim() || url,
      note: "",
      sort: sortCursor--,
    };
    if (!linksById.has(id)) linksById.set(id, link);

    const tagIds = currentPath
      .map((_, index) => addFolderTag(currentPath.slice(0, index + 1))?.id)
      .filter((tagId): tagId is Id => Boolean(tagId));
    if (tagIds.length === 0 && currentTagId) tagIds.push(currentTagId);
    if (tagIds.length === 0) {
      const fallbackTag = addFolderTag(currentPath.length > 0 ? currentPath : ["浏览器书签"]);
      if (fallbackTag) tagIds.push(fallbackTag.id);
    }
    for (const tagId of tagIds) {
      const linkTagKey = `${id}:${tagId}`;
      if (!linkTagsByKey.has(linkTagKey)) linkTagsByKey.set(linkTagKey, { collectionId, linkId: id, tagId });
    }
  };

  const parseDl = (dlElement: Element, path: string[], parentTagId: Id | null) => {
    let child = dlElement.firstElementChild;
    while (child) {
      if (child.tagName !== "DT") {
        child = child.nextElementSibling;
        continue;
      }

      const folderElement = directChildElementByTag(child, "h3");
      const linkElement = directChildElementByTag(child, "a");
      if (folderElement) {
        const folderName = folderElement.textContent?.trim();
        if (!folderName) {
          child = child.nextElementSibling;
          continue;
        }
        const nextPath = [...path, folderName];
        const tag = addFolderTag(nextPath);
        addFolderRelation(parentTagId, tag?.id ?? null);
        const childDl =
          directChildElementByTag(child, "dl") ??
          (child.nextElementSibling?.tagName === "DL" ? child.nextElementSibling : null);
        if (childDl) parseDl(childDl, nextPath, tag?.id ?? null);
        child = nextElementAfterBookmarkFolder(child, childDl);
        continue;
      }

      if (linkElement) addBookmarkLink(linkElement, parentTagId, path);
      child = child.nextElementSibling;
    }
  };

  const rootDl = document.querySelector("dl");
  if (rootDl) parseDl(rootDl, [], null);

  return {
    links: [...linksById.values()],
    tags: [...tagsById.values()],
    link_tags: [...linkTagsByKey.values()],
    tag_relations: [...relationsByKey.values()],
  };
}
