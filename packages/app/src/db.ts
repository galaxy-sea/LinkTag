import Dexie, { type EntityTable, type Table } from "dexie";

import type {
  AppRuntime,
  CollectionRecord,
  Id,
  LinkRecord,
  LinkTagRecord,
  MetadataRecord,
  RuntimeInfo,
  TagRecord,
  TagRelationRecord,
} from "./types";

export const LINKTAG_SOFTWARE_VERSION = "0.1.0";
export const LINKTAG_SCHEMA_VERSION = 1;
export const DEFAULT_COLLECTION_ID = "collection_default";
export const DEFAULT_COLLECTION_NAME = "默认集合";
export const ACTIVE_COLLECTION_STORAGE_KEY = "linktag.activeCollectionId";
export const METADATA_ID = "main";

export class LinkTagDb extends Dexie {
  collections!: EntityTable<CollectionRecord, "id">;
  links!: Table<LinkRecord, [Id, Id]>;
  tags!: Table<TagRecord, [Id, Id]>;
  link_tags!: Table<LinkTagRecord, [Id, Id, Id]>;
  tag_relations!: Table<TagRelationRecord, [Id, Id]>;
  metadata!: EntityTable<MetadataRecord, "id">;

  constructor() {
    super("linktag");
    // Dexie stores() declares primary keys and indexes only. Non-indexed record fields are still persisted.
    this.version(1).stores({
      collections: "id, name, updatedAt, sort",
      links: "[collectionId+id], collectionId, id, [collectionId+url], [collectionId+sort], url, title, sort",
      tags: "[collectionId+id], collectionId, id, [collectionId+name], [collectionId+updatedAt], [collectionId+sort], name, color, updatedAt, sort",
      link_tags:
        "[collectionId+linkId+tagId], collectionId, [collectionId+linkId], [collectionId+tagId], linkId, tagId",
      tag_relations:
        "[collectionId+id], collectionId, id, [collectionId+sourceTagId], [collectionId+targetTagId], sourceTagId, targetTagId",
      metadata: "id, softwareVersion, schemaVersion, deviceId, baseVersion, localVersion, pendingSync",
    });
  }
}

export const db = new LinkTagDb();

export function nowIso() {
  return new Date().toISOString();
}

export function getActiveCollectionId() {
  if (typeof localStorage === "undefined") return DEFAULT_COLLECTION_ID;
  return localStorage.getItem(ACTIVE_COLLECTION_STORAGE_KEY) || DEFAULT_COLLECTION_ID;
}

export async function ensureCollection(collectionId = getActiveCollectionId()) {
  const existing = await db.collections.get(collectionId);
  if (existing) return existing;
  const now = nowIso();
  const collection: CollectionRecord = {
    id: collectionId,
    name: collectionId === DEFAULT_COLLECTION_ID ? DEFAULT_COLLECTION_NAME : collectionId,
    updatedAt: now,
    sort: Date.now(),
  };
  await db.collections.put(collection);
  return collection;
}

export async function createCollection(name: string) {
  const now = nowIso();
  const collection: CollectionRecord = {
    id: createId("collection"),
    name: name.trim() || "未命名集合",
    updatedAt: now,
    sort: Date.now(),
  };
  await db.collections.add(collection);
  return collection;
}

export async function readCollections() {
  const collections = await db.collections.toArray();
  return collections.sort((left, right) => {
    const sortDiff = (right.sort ?? 0) - (left.sort ?? 0);
    if (sortDiff !== 0) return sortDiff;
    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.name.localeCompare(right.name);
  });
}

export async function setActiveCollectionId(collectionId: Id) {
  await ensureCollection(collectionId);
  if (typeof localStorage !== "undefined") localStorage.setItem(ACTIVE_COLLECTION_STORAGE_KEY, collectionId);
}

export function createRuntimeInfo(appRuntime: AppRuntime): RuntimeInfo {
  return {
    appRuntime,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
  };
}

export async function ensureMetadata(runtimeInfo: RuntimeInfo) {
  const existing = await db.metadata.get(METADATA_ID);
  const next: MetadataRecord = {
    id: METADATA_ID,
    softwareVersion: LINKTAG_SOFTWARE_VERSION,
    schemaVersion: LINKTAG_SCHEMA_VERSION,
    deviceId: existing?.deviceId ?? createId("device"),
    baseVersion: existing?.baseVersion ?? null,
    localVersion: existing?.localVersion ?? "",
    pendingSync: existing?.pendingSync ?? false,
    pendingSyncAt: existing?.pendingSyncAt ?? null,
    lastLocalChangeAt: existing?.lastLocalChangeAt ?? null,
    lastSyncAt: existing?.lastSyncAt ?? null,
    lastPullAt: existing?.lastPullAt ?? null,
    lastUploadAt: existing?.lastUploadAt ?? null,
    runtimeInfo,
  };
  await db.metadata.put(next);
  return next;
}

export async function markLocalDataChanged(runtimeInfo: RuntimeInfo, version = nowIso()) {
  const existing = await db.metadata.get(METADATA_ID);
  const next: MetadataRecord = {
    id: METADATA_ID,
    softwareVersion: LINKTAG_SOFTWARE_VERSION,
    schemaVersion: LINKTAG_SCHEMA_VERSION,
    deviceId: existing?.deviceId ?? createId("device"),
    baseVersion: existing?.baseVersion ?? null,
    localVersion: version,
    pendingSync: true,
    pendingSyncAt: existing?.pendingSync ? (existing.pendingSyncAt ?? version) : version,
    lastLocalChangeAt: version,
    lastSyncAt: existing?.lastSyncAt ?? null,
    lastPullAt: existing?.lastPullAt ?? null,
    lastUploadAt: existing?.lastUploadAt ?? null,
    runtimeInfo,
  };
  await db.metadata.put(next);
  return next;
}

export async function markRemoteSyncCompleted(
  version: string,
  runtimeInfo: RuntimeInfo,
  direction: "pull" | "upload",
  syncedAt = nowIso(),
) {
  const existing = await db.metadata.get(METADATA_ID);
  const next: MetadataRecord = {
    id: METADATA_ID,
    softwareVersion: LINKTAG_SOFTWARE_VERSION,
    schemaVersion: LINKTAG_SCHEMA_VERSION,
    deviceId: existing?.deviceId ?? createId("device"),
    baseVersion: version,
    localVersion: version,
    pendingSync: false,
    pendingSyncAt: null,
    lastLocalChangeAt: existing?.lastLocalChangeAt ?? null,
    lastSyncAt: syncedAt,
    lastPullAt: direction === "pull" ? syncedAt : (existing?.lastPullAt ?? null),
    lastUploadAt: direction === "upload" ? syncedAt : (existing?.lastUploadAt ?? null),
    runtimeInfo,
  };
  await db.metadata.put(next);
  return next;
}

export async function markRemoteUploadCompleted(version: string, runtimeInfo: RuntimeInfo, syncedAt = nowIso()) {
  const existing = await db.metadata.get(METADATA_ID);
  const localVersion = existing?.localVersion ?? "";
  const hasNewerLocalChanges = Boolean(localVersion && localVersion !== version);
  const next: MetadataRecord = {
    id: METADATA_ID,
    softwareVersion: LINKTAG_SOFTWARE_VERSION,
    schemaVersion: LINKTAG_SCHEMA_VERSION,
    deviceId: existing?.deviceId ?? createId("device"),
    baseVersion: version,
    localVersion: hasNewerLocalChanges ? localVersion : version,
    pendingSync: hasNewerLocalChanges,
    pendingSyncAt: hasNewerLocalChanges ? (existing?.pendingSyncAt ?? existing?.lastLocalChangeAt ?? syncedAt) : null,
    lastLocalChangeAt: existing?.lastLocalChangeAt ?? null,
    lastSyncAt: syncedAt,
    lastPullAt: existing?.lastPullAt ?? null,
    lastUploadAt: syncedAt,
    runtimeInfo,
  };
  await db.metadata.put(next);
  return next;
}

export async function markRemoteUnchanged(runtimeInfo: RuntimeInfo, syncedAt = nowIso()) {
  const existing = await db.metadata.get(METADATA_ID);
  const next: MetadataRecord = {
    id: METADATA_ID,
    softwareVersion: LINKTAG_SOFTWARE_VERSION,
    schemaVersion: LINKTAG_SCHEMA_VERSION,
    deviceId: existing?.deviceId ?? createId("device"),
    baseVersion: existing?.baseVersion ?? null,
    localVersion: existing?.localVersion ?? "",
    pendingSync: existing?.pendingSync ?? false,
    pendingSyncAt: existing?.pendingSyncAt ?? null,
    lastLocalChangeAt: existing?.lastLocalChangeAt ?? null,
    lastSyncAt: syncedAt,
    lastPullAt: existing?.lastPullAt ?? null,
    lastUploadAt: existing?.lastUploadAt ?? null,
    runtimeInfo,
  };
  await db.metadata.put(next);
  return next;
}

export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}
