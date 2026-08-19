export type Id = string;

export interface CollectionRecord {
  id: Id;
  name: string;
  updatedAt: string;
  sort?: number;
}

export interface LinkRecord {
  id: Id;
  collectionId: Id;
  url: string;
  title: string;
  note?: string;
  sort?: number;
}

export interface TagRecord {
  id: Id;
  collectionId: Id;
  name: string;
  color: string;
  updatedAt: string;
  sort?: number;
  collapsed?: boolean;
}

export interface LinkTagRecord {
  collectionId: Id;
  linkId: Id;
  tagId: Id;
}

export interface TagRelationRecord {
  id: Id;
  collectionId: Id;
  sourceTagId: Id;
  targetTagId: Id;
  name: string;
}

export type AppRuntime = "web" | "extension";

export interface RuntimeInfo {
  appRuntime: AppRuntime;
  userAgent: string;
  platform: string;
  language: string;
}

export interface MetadataRecord {
  id: "main";
  softwareVersion: string;
  schemaVersion: number;
  deviceId: string;
  baseVersion: string | null;
  localVersion: string;
  pendingSync: boolean;
  pendingSyncAt: string | null;
  lastLocalChangeAt: string | null;
  lastSyncAt: string | null;
  lastPullAt: string | null;
  lastUploadAt: string | null;
  runtimeInfo: RuntimeInfo;
}

export interface BrowserTab {
  id: Id;
  windowId: Id;
  linkId: Id;
  url: string;
  title: string;
  favicon?: string;
}

export interface BrowserWindow {
  id: Id;
  name: string;
  tabs: BrowserTab[];
}

export interface GraphWindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MainMode = "links" | "graph";
export type LinkView = "card" | "compact" | "list" | "grid";
export type WindowGroupLayout = "top" | "top-hover" | "right" | "right-hover";
export type TagGroupSort = "updated-desc" | "updated-asc" | "weight-desc" | "weight-asc" | "name-asc" | "name-desc";
export type GroupOpenMode = "tab-group" | "tabs";
export type TagDisplayFormat = "tag" | "relation" | "tag-relation" | "relation-tag";
export type ElkLayout = "horizontal" | "vertical" | "force" | "stress";
export type EdgeLineType = "curve" | "orthogonal" | "straight" | "none";
export type BackupProvider = "github" | "gitee";
