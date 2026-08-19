import { colorChoices } from "../core/colors";
import { nowIso } from "../db";
import type { CollectionRecord, Id, LinkRecord, LinkTagRecord, TagRecord, TagRelationRecord } from "../types";
import type { BackupData } from "./backup";

type TabyLabel = {
  title?: unknown;
  color?: unknown;
};

type TabyCard = {
  title?: unknown;
  url?: unknown;
  description?: unknown;
};

type TabyCollection = {
  id?: unknown;
  title?: unknown;
  labels?: unknown;
  cards?: unknown;
};

type TabyWorkspace = {
  id?: unknown;
  title?: unknown;
  collections?: unknown;
};

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hashText(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function colorForText(value: string) {
  return colorChoices[
    hashText(value)
      .split("")
      .reduce((total, char) => total + char.charCodeAt(0), 0) % colorChoices.length
  ];
}

function normalizedColor(value: unknown, fallbackKey: string) {
  const color = textValue(value);
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  return colorForText(fallbackKey);
}

function linkIdForUrl(url: string) {
  return `link_taby_${hashText(url)}`;
}

function collectionIdForTabyWorkspace(workspaceKey: string) {
  return `collection_taby_${hashText(workspaceKey)}`;
}

function tagIdForName(name: string) {
  return `tag_taby_${hashText(name.toLowerCase())}`;
}

function relationIdForTabyTags(collectionId: Id, sourceTagId: Id, targetTagId: Id) {
  return `rel_taby_${hashText(`${collectionId}\u001f${sourceTagId}->${targetTagId}`)}`;
}

function tagRelationPairKey(firstTagId: Id, secondTagId: Id) {
  return [firstTagId, secondTagId].sort().join("::");
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function parseTabyJsonFile(content: string): BackupData {
  const parsed = JSON.parse(content) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Taby JSON 格式不正确。");

  const importedAt = nowIso();
  let sortCursor = Date.now();
  const collectionsById = new Map<Id, CollectionRecord>();
  const linksByKey = new Map<string, LinkRecord>();
  const tagsByKey = new Map<string, TagRecord>();
  const linkTagsByKey = new Map<string, LinkTagRecord>();
  const relationsByKey = new Map<string, TagRelationRecord>();

  const addCollection = (id: Id, name: string) => {
    if (!collectionsById.has(id)) {
      collectionsById.set(id, {
        id,
        name: name.trim() || "Taby",
        updatedAt: importedAt,
        sort: sortCursor--,
      });
    }
    return collectionsById.get(id)!;
  };

  const addTag = (collectionId: Id, name: string, color: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;
    const id = tagIdForName(trimmedName);
    const key = `${collectionId}:${id}`;
    if (!tagsByKey.has(key)) {
      tagsByKey.set(key, {
        id,
        collectionId,
        name: trimmedName,
        color,
        sort: sortCursor--,
        updatedAt: importedAt,
      });
    }
    return tagsByKey.get(key) ?? null;
  };

  const addLinkTag = (collectionId: Id, linkId: Id, tagId: Id) => {
    const key = `${collectionId}:${linkId}:${tagId}`;
    if (!linkTagsByKey.has(key)) linkTagsByKey.set(key, { collectionId, linkId, tagId });
  };

  const addTagRelation = (collectionId: Id, sourceTagId: Id | null, targetTagId: Id | null) => {
    if (!sourceTagId || !targetTagId || sourceTagId === targetTagId) return;
    const key = `${collectionId}:${tagRelationPairKey(sourceTagId, targetTagId)}`;
    if (relationsByKey.has(key)) return;
    relationsByKey.set(key, {
      id: relationIdForTabyTags(collectionId, sourceTagId, targetTagId),
      collectionId,
      sourceTagId,
      targetTagId,
      name: "包含",
    });
  };

  for (const [workspaceIndex, workspaceValue] of (parsed as TabyWorkspace[]).entries()) {
    if (!isObject(workspaceValue)) continue;
    const workspaceTitle = textValue(workspaceValue.title);
    const workspaceKey = textValue(workspaceValue.id) || workspaceTitle || `workspace-${workspaceIndex}`;
    const collection = addCollection(collectionIdForTabyWorkspace(workspaceKey), workspaceTitle || "Taby");
    const collections = asArray<TabyCollection>(workspaceValue.collections);

    for (const collectionValue of collections) {
      if (!isObject(collectionValue)) continue;
      const collectionTitle = textValue(collectionValue.title);
      const collectionTag = addTag(collection.id, collectionTitle, colorForText(collectionTitle));
      const labelTags = asArray<TabyLabel>(collectionValue.labels)
        .filter(isObject)
        .map((label) => {
          const labelTitle = textValue(label.title);
          return addTag(collection.id, labelTitle, normalizedColor(label.color, labelTitle));
        })
        .filter((tag): tag is TagRecord => Boolean(tag));

      for (const labelTag of labelTags) addTagRelation(collection.id, collectionTag?.id ?? null, labelTag.id);

      const tagIds = [collectionTag?.id, ...labelTags.map((tag) => tag.id)].filter((tagId): tagId is Id =>
        Boolean(tagId),
      );

      for (const cardValue of asArray<TabyCard>(collectionValue.cards)) {
        if (!isObject(cardValue)) continue;
        const url = textValue(cardValue.url);
        if (!url) continue;
        const id = linkIdForUrl(url);
        const link: LinkRecord = {
          id,
          collectionId: collection.id,
          url,
          title: textValue(cardValue.title) || url,
          note: textValue(cardValue.description),
          sort: sortCursor--,
        };
        const linkKey = `${collection.id}:${id}`;
        if (!linksByKey.has(linkKey)) linksByKey.set(linkKey, link);
        for (const tagId of tagIds) addLinkTag(collection.id, id, tagId);
      }
    }
  }

  return {
    collections: [...collectionsById.values()],
    links: [...linksByKey.values()],
    tags: [...tagsByKey.values()],
    link_tags: [...linkTagsByKey.values()],
    tag_relations: [...relationsByKey.values()],
  };
}
