import { stripLinkFavicon, type BackupSourceData } from "../backup/backup";
import { db, getActiveCollectionId, METADATA_ID } from "../db";
import type { Id, LinkRecord, LinkTagRecord, MetadataRecord, TagRecord, TagRelationRecord } from "../types";

export type AppData = {
  links: LinkRecord[];
  tags: TagRecord[];
  linkTags: LinkTagRecord[];
  relations: TagRelationRecord[];
  metadata: MetadataRecord | null;
};

export type AppShellData = Pick<AppData, "tags" | "relations" | "metadata"> & {
  tagLinkCountsByTagId: Map<Id, number>;
};
export type AppLinkData = Pick<AppData, "links" | "linkTags">;

async function readTagsWithoutLiveQuerySubscription(collectionId = getActiveCollectionId()) {
  await db.open();
  const nativeDb = db.backendDB();
  return new Promise<TagRecord[]>((resolve, reject) => {
    const transaction = nativeDb.transaction("tags", "readonly");
    const request = transaction.objectStore("tags").index("collectionId").getAll(collectionId) as IDBRequest<
      TagRecord[]
    >;
    request.onsuccess = () => {
      resolve([...request.result].sort(compareTags));
    };
    request.onerror = () => {
      reject(request.error ?? new Error("读取标签失败。"));
    };
  });
}

function compareTags(left: TagRecord, right: TagRecord) {
  const sortDiff = (right.sort ?? 0) - (left.sort ?? 0);
  if (sortDiff !== 0) return sortDiff;
  return left.name.localeCompare(right.name);
}

function compareLinks(left: LinkRecord, right: LinkRecord) {
  const sortDiff = (right.sort ?? 0) - (left.sort ?? 0);
  if (sortDiff !== 0) return sortDiff;
  return left.title.localeCompare(right.title);
}

export async function readAppData(collectionId = getActiveCollectionId()): Promise<AppData> {
  const [shellData, linkData] = await Promise.all([readAppShellData(collectionId), readAppLinkData(collectionId)]);
  return {
    ...linkData,
    ...shellData,
  };
}

export async function readBackupData(): Promise<BackupSourceData> {
  const [collections, links, tags, linkTags, relations, metadata] = await Promise.all([
    db.collections.toArray(),
    db.links.toArray(),
    db.tags.toArray(),
    db.link_tags.toArray(),
    db.tag_relations.toArray(),
    db.metadata.get(METADATA_ID),
  ]);
  return {
    collections: [...collections].sort((left, right) => {
      const sortDiff = (right.sort ?? 0) - (left.sort ?? 0);
      if (sortDiff !== 0) return sortDiff;
      return left.name.localeCompare(right.name);
    }),
    links: links.map(stripLinkFavicon).sort(compareLinks),
    tags,
    linkTags,
    relations,
    metadata: metadata ?? null,
  };
}

export async function readAppShellData(collectionId = getActiveCollectionId()): Promise<AppShellData> {
  const [tags, relations, metadata, linkTags] = await Promise.all([
    readTagsWithoutLiveQuerySubscription(collectionId),
    db.tag_relations.where("collectionId").equals(collectionId).toArray(),
    db.metadata.get(METADATA_ID),
    db.link_tags.where("collectionId").equals(collectionId).toArray(),
  ]);
  return {
    tags,
    relations,
    metadata: metadata ?? null,
    tagLinkCountsByTagId: countLinksByTagId(tags, linkTags),
  };
}

export async function readAppLinkData(collectionId = getActiveCollectionId()): Promise<AppLinkData> {
  const [links, linkTags] = await Promise.all([
    db.links.where("collectionId").equals(collectionId).toArray(),
    db.link_tags.where("collectionId").equals(collectionId).toArray(),
  ]);
  return {
    links: links.map(stripLinkFavicon).sort(compareLinks),
    linkTags,
  };
}

export async function readLinkDataForLinkIds(
  linkIds: Id[],
  collectionId = getActiveCollectionId(),
): Promise<AppLinkData> {
  const uniqueLinkIds = [...new Set(linkIds)];
  if (uniqueLinkIds.length === 0) return { links: [], linkTags: [] };
  const [links, linkTags] = await Promise.all([
    db.links.bulkGet(uniqueLinkIds.map((linkId) => [collectionId, linkId] as [Id, Id])),
    db.link_tags
      .where("[collectionId+linkId]")
      .anyOf(uniqueLinkIds.map((linkId) => [collectionId, linkId] as [Id, Id]))
      .toArray(),
  ]);
  return {
    links: links
      .filter((link): link is LinkRecord => link !== undefined)
      .map(stripLinkFavicon)
      .sort(compareLinks),
    linkTags,
  };
}

export async function readLinkDataForTag(tagId: Id, collectionId = getActiveCollectionId()): Promise<AppLinkData> {
  const tagLinkRows = await db.link_tags.where("[collectionId+tagId]").equals([collectionId, tagId]).toArray();
  const linkIds = tagLinkRows.map((row) => row.linkId);
  return readLinkDataForLinkIds(linkIds, collectionId);
}

function countLinksByTagId(tags: TagRecord[], linkTags: LinkTagRecord[]) {
  const counts = new Map(tags.map((tag) => [tag.id, 0]));
  for (const row of linkTags) {
    counts.set(row.tagId, (counts.get(row.tagId) ?? 0) + 1);
  }
  return counts;
}
