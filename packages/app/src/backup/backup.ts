import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import { createId, LINKTAG_SCHEMA_VERSION, LINKTAG_SOFTWARE_VERSION, METADATA_ID, nowIso } from "../db";
import type {
  BackupProvider,
  CollectionRecord,
  LinkRecord,
  LinkTagRecord,
  MetadataRecord,
  RuntimeInfo,
  TagRecord,
  TagRelationRecord,
} from "../types";

export const backupGistDescription = "LinkTag Backup";
export const backupGistTitleFilename = "LinkTag";
export const backupGistTitleContent = "LinkTag";
export const remoteBackupManifestFilename = "linktag-backup.json";
export const remoteBackupDataFilename = "linktag-data.json.gz.base64";

export type BackupData = {
  collections: CollectionRecord[];
  links: LinkRecord[];
  tags: TagRecord[];
  link_tags: LinkTagRecord[];
  tag_relations: TagRelationRecord[];
};

export type BackupSourceData = {
  collections: CollectionRecord[];
  links: LinkRecord[];
  tags: TagRecord[];
  linkTags: LinkTagRecord[];
  relations: TagRelationRecord[];
  metadata: MetadataRecord | null;
};

export type RemoteBackupMetadata = {
  version: string;
  parentVersion: string | null;
  deviceId: string;
  softwareVersion: string;
  runtimeInfo: RuntimeInfo;
};

export type BackupPayload = {
  app: "LinkTag";
  type: "json";
  schemaVersion: 2;
  exportedAt: string;
  metadata?: RemoteBackupMetadata;
  data: BackupData;
};

export type RemoteBackupDataDescriptor = {
  file: string;
  encoding: "gzip-base64";
  hash: string;
  originalBytes: number;
  compressedBytes: number;
};

export type RemoteBackupManifest = {
  app: "LinkTag";
  type: "gzip";
  schemaVersion: 2;
  exportedAt: string;
  metadata: RemoteBackupMetadata;
  data: RemoteBackupDataDescriptor;
};

export type RemoteBackupFiles = {
  manifest: RemoteBackupManifest;
  dataContent: string;
};

export type BackupGistResult = {
  id: string;
  url: string;
};

export type BackupConflict = {
  provider: BackupProvider;
  token: string;
  gist: string;
  remoteManifest: RemoteBackupManifest;
  remoteVersion: string;
  remoteParentVersion: string | null;
  localVersion: string;
  localBaseVersion: string | null;
  pendingSync: boolean;
  localSnapshot: BackupSourceData;
} | null;

export type BackupPreflightResult =
  | { type: "upload"; remoteVersion: string | null; gist: string }
  | { type: "pull"; remoteManifest: RemoteBackupManifest; gist: string }
  | { type: "unchanged"; remoteVersion: string | null; gist: string }
  | { type: "missing-gist"; gist: string; url: string }
  | { type: "conflict"; conflict: NonNullable<BackupConflict> };

export function stripLinkFavicon(link: LinkRecord & { favicon?: unknown }): LinkRecord {
  const { favicon: _favicon, ...nextLink } = link;
  return nextLink;
}

export function sanitizeBackupData(data: BackupData): BackupData {
  return {
    collections: data.collections.map((collection, index) => ({
      ...collection,
      sort: collection.sort ?? data.collections.length - index,
    })),
    links: data.links.map((link, index) => ({
      ...stripLinkFavicon(link),
      sort: link.sort ?? data.links.length - index,
    })),
    tags: data.tags.map((tag, index) => ({ ...tag, sort: tag.sort ?? data.tags.length - index })),
    link_tags: data.link_tags.map((binding) => ({
      collectionId: binding.collectionId,
      linkId: binding.linkId,
      tagId: binding.tagId,
    })),
    tag_relations: data.tag_relations.map((relation) => ({
      ...relation,
    })),
  };
}

export function createBackupPayload(data: BackupSourceData, metadata: RemoteBackupMetadata): BackupPayload {
  const backupData = sanitizeBackupData({
    collections: data.collections,
    links: data.links,
    tags: data.tags,
    link_tags: data.linkTags,
    tag_relations: data.relations,
  });
  return {
    app: "LinkTag",
    type: "json",
    schemaVersion: 2,
    exportedAt: nowIso(),
    metadata,
    data: backupData,
  };
}

export function createBackupDataSignature(data: BackupSourceData) {
  return JSON.stringify(
    sanitizeBackupData({
      collections: data.collections,
      links: data.links,
      tags: data.tags,
      link_tags: data.linkTags,
      tag_relations: data.relations,
    }),
  );
}

export function createRemoteBackupMetadata(
  version: string,
  parentVersion: string | null,
  localMetadata: MetadataRecord | null,
  runtimeInfo: RuntimeInfo,
): RemoteBackupMetadata {
  return {
    version,
    parentVersion,
    deviceId: localMetadata?.deviceId ?? createId("device"),
    softwareVersion: LINKTAG_SOFTWARE_VERSION,
    runtimeInfo,
  };
}

export function createLocalSyncedMetadata(
  version: string,
  existing: MetadataRecord | null,
  runtimeInfo: RuntimeInfo,
  direction: "pull" | "upload",
  syncedAt = nowIso(),
): MetadataRecord {
  return {
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
}

export function createLocalImportMetadata(
  version: string,
  existing: MetadataRecord | null,
  runtimeInfo: RuntimeInfo,
): MetadataRecord {
  return {
    id: METADATA_ID,
    softwareVersion: LINKTAG_SOFTWARE_VERSION,
    schemaVersion: LINKTAG_SCHEMA_VERSION,
    deviceId: existing?.deviceId ?? createId("device"),
    baseVersion: existing?.baseVersion ?? null,
    localVersion: version,
    pendingSync: true,
    pendingSyncAt: version,
    lastLocalChangeAt: version,
    lastSyncAt: existing?.lastSyncAt ?? null,
    lastPullAt: existing?.lastPullAt ?? null,
    lastUploadAt: existing?.lastUploadAt ?? null,
    runtimeInfo,
  };
}

export function extractGistId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.at(-1) ?? trimmed;
  } catch {
    return trimmed;
  }
}

export function remoteGistHref(provider: BackupProvider, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    // Treat non-URL input as a Gist ID.
  }
  const gistId = extractGistId(trimmed);
  if (!gistId) return "";
  if (provider === "github") return `https://gist.github.com/${encodeURIComponent(gistId)}#file-linktag-backup-json`;
  return `https://gitee.com/api/v5/gists/${encodeURIComponent(gistId)}`;
}

function isRemoteBackupMetadata(value: unknown): value is RemoteBackupMetadata {
  if (!value || typeof value !== "object") return false;
  const metadata = value as Partial<RemoteBackupMetadata>;
  const runtimeInfo = metadata.runtimeInfo as Partial<RuntimeInfo> | undefined;
  return (
    typeof metadata.version === "string" &&
    (metadata.parentVersion === null || typeof metadata.parentVersion === "string") &&
    typeof metadata.deviceId === "string" &&
    typeof metadata.softwareVersion === "string" &&
    Boolean(runtimeInfo) &&
    (runtimeInfo?.appRuntime === "web" || runtimeInfo?.appRuntime === "extension") &&
    typeof runtimeInfo?.userAgent === "string" &&
    typeof runtimeInfo?.platform === "string" &&
    typeof runtimeInfo?.language === "string"
  );
}

function isBackupData(value: unknown): value is BackupData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<BackupData>;
  return (
    Array.isArray(data.collections) &&
    Array.isArray(data.links) &&
    Array.isArray(data.tags) &&
    Array.isArray(data.link_tags) &&
    Array.isArray(data.tag_relations)
  );
}

function isBackupPayload(value: unknown): value is BackupPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<BackupPayload>;
  return (
    payload.app === "LinkTag" &&
    payload.type === "json" &&
    payload.schemaVersion === 2 &&
    typeof payload.exportedAt === "string" &&
    (payload.metadata === undefined || isRemoteBackupMetadata(payload.metadata)) &&
    isBackupData(payload.data)
  );
}

function isRemoteBackupManifest(value: unknown): value is RemoteBackupManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<RemoteBackupManifest>;
  const data = manifest.data as Partial<RemoteBackupDataDescriptor> | undefined;
  return (
    manifest.app === "LinkTag" &&
    manifest.type === "gzip" &&
    manifest.schemaVersion === 2 &&
    typeof manifest.exportedAt === "string" &&
    isRemoteBackupMetadata(manifest.metadata) &&
    Boolean(data) &&
    typeof data?.file === "string" &&
    data.encoding === "gzip-base64" &&
    typeof data.hash === "string" &&
    typeof data.originalBytes === "number" &&
    typeof data.compressedBytes === "number"
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToUint8Array(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function sha256Hex(data: ArrayBuffer | Uint8Array) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return bytesToHex(sha256(bytes));
}

export async function createRemoteBackupFiles(payload: BackupPayload): Promise<RemoteBackupFiles> {
  if (typeof CompressionStream === "undefined") throw new Error("当前浏览器不支持远程导出压缩。");
  const raw = JSON.stringify(payload.data);
  const rawBytes = new TextEncoder().encode(raw);
  const compressedBuffer = await new Response(
    new Blob([rawBytes], { type: "application/json" }).stream().pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();
  const dataContent = arrayBufferToBase64(compressedBuffer);
  const metadata = payload.metadata;
  if (!metadata) throw new Error("远程同步缺少元数据。");
  const manifest: RemoteBackupManifest = {
    app: "LinkTag",
    type: "gzip",
    schemaVersion: 2,
    exportedAt: payload.exportedAt,
    metadata,
    data: {
      file: remoteBackupDataFilename,
      encoding: "gzip-base64",
      hash: `sha256:${await sha256Hex(compressedBuffer)}`,
      originalBytes: rawBytes.byteLength,
      compressedBytes: compressedBuffer.byteLength,
    },
  };
  return { manifest, dataContent };
}

export function parseRemoteBackupManifestContent(content: string) {
  const manifest = JSON.parse(content) as unknown;
  if (!isRemoteBackupManifest(manifest)) throw new Error("远程同步元数据格式不正确。");
  return manifest;
}

async function parseRemoteBackupDataContent(manifest: RemoteBackupManifest, content: string) {
  if (typeof DecompressionStream === "undefined") throw new Error("当前浏览器不支持远程同步解压。");
  if (manifest.data.encoding !== "gzip-base64") throw new Error("远程同步数据编码不支持。");
  const compressedBytes = base64ToUint8Array(content.trim());
  const hash = `sha256:${await sha256Hex(compressedBytes)}`;
  if (hash !== manifest.data.hash) throw new Error("远程同步数据校验失败。");
  const raw = await new Response(
    new Blob([compressedBytes], { type: "application/gzip" }).stream().pipeThrough(new DecompressionStream("gzip")),
  ).text();
  const data = JSON.parse(raw) as unknown;
  if (!isBackupData(data)) throw new Error("远程同步文件格式不正确。");
  const backupData = sanitizeBackupData(data);
  return {
    app: "LinkTag",
    type: "json",
    schemaVersion: manifest.schemaVersion,
    exportedAt: manifest.exportedAt,
    metadata: manifest.metadata,
    data: backupData,
  } satisfies BackupPayload;
}

export function parseBackupJsonContent(content: string) {
  const payload = JSON.parse(content) as unknown;
  if (!isBackupPayload(payload)) throw new Error("导入文件格式不正确。");
  return {
    ...payload,
    data: sanitizeBackupData(payload.data),
  };
}

export function exportFilename(exportedAt: string) {
  return `linktag-export-${exportedAt.replace(/[:.]/g, "-")}.json`;
}

export function downloadJsonFile(filename: string, content: string) {
  downloadTextFile(filename, content, "application/json;charset=utf-8");
}

export function downloadTextFile(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export class RemoteGistMissingError extends Error {
  public readonly url: string;

  constructor(
    public readonly provider: BackupProvider,
    public readonly gistId: string,
  ) {
    super("现有 Gist ID 无法使用。");
    this.name = "RemoteGistMissingError";
    this.url = remoteGistHref(provider, gistId);
  }
}

export function isRemoteGistMissingError(error: unknown): error is RemoteGistMissingError {
  return error instanceof RemoteGistMissingError;
}

export class RemoteTokenInvalidError extends Error {
  constructor(
    public readonly provider: BackupProvider,
    public readonly status: number,
    message: string,
  ) {
    super(message || "远程同步 Token 无法使用。");
    this.name = "RemoteTokenInvalidError";
  }
}

export function isRemoteTokenInvalidError(error: unknown): error is RemoteTokenInvalidError {
  return error instanceof RemoteTokenInvalidError;
}

async function responseErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: string; error?: string; error_description?: string };
    return body.message || body.error_description || body.error || response.statusText;
  } catch {
    const text = await response.text().catch(() => "");
    return text || response.statusText;
  }
}

async function throwRemoteResponseError(provider: BackupProvider, response: Response): Promise<never> {
  const message = await responseErrorMessage(response);
  if (response.status === 401 || response.status === 403) {
    throw new RemoteTokenInvalidError(provider, response.status, message);
  }
  throw new Error(message);
}

function normalizeGistResult(
  result: { id?: string; html_url?: string; url?: string } | Array<{ id?: string; html_url?: string; url?: string }>,
): BackupGistResult {
  const gist = Array.isArray(result) ? result[0] : result;
  return { id: gist?.id || extractGistId(gist?.html_url || gist?.url || ""), url: gist?.html_url || gist?.url || "" };
}

type RemoteGistListItem = {
  id?: string;
  html_url?: string;
  url?: string;
  description?: string;
  files?: Record<string, unknown>;
};

const gistListPageSize = 100;
const maxGistListPages = 100;

function backupGistListUrl(provider: BackupProvider, token: string, page: number) {
  if (provider === "github") return `https://api.github.com/gists?per_page=${gistListPageSize}&page=${page}`;
  return `https://gitee.com/api/v5/gists?access_token=${encodeURIComponent(token)}&per_page=${gistListPageSize}&page=${page}`;
}

function gistListHeaders(provider: BackupProvider, token: string): Record<string, string> {
  if (provider === "github") {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    };
  }
  return { Accept: "application/json" };
}

function parseNextLinkUrl(linkHeader: string | null) {
  if (!linkHeader) return "";
  for (const item of linkHeader.split(",")) {
    const [urlPart, ...params] = item.trim().split(";");
    if (!params.some((param) => param.trim() === 'rel="next"')) continue;
    const matched = urlPart.trim().match(/^<(.+)>$/);
    return matched?.[1] ?? "";
  }
  return "";
}

function readNextPage(response: Response, currentPage: number, currentCount: number) {
  const nextPage = response.headers.get("x-next-page");
  if (nextPage) {
    const parsed = Number(nextPage);
    if (Number.isInteger(parsed) && parsed > currentPage) return parsed;
  }

  const totalPages = response.headers.get("x-total-pages");
  if (totalPages) {
    const parsed = Number(totalPages);
    if (Number.isInteger(parsed) && currentPage < parsed) return currentPage + 1;
  }

  return currentCount >= gistListPageSize ? currentPage + 1 : null;
}

async function fetchBackupGistList(provider: BackupProvider, token: string) {
  const gists: RemoteGistListItem[] = [];
  let page = 1;
  let nextUrl = backupGistListUrl(provider, token, page);

  while (nextUrl && page <= maxGistListPages) {
    const response = await fetch(nextUrl, { headers: gistListHeaders(provider, token) });
    if (!response.ok) await throwRemoteResponseError(provider, response);
    const result = (await response.json()) as RemoteGistListItem[] | { gists?: RemoteGistListItem[] };
    const pageGists = Array.isArray(result) ? result : (result.gists ?? []);
    gists.push(...pageGists);

    const nextLinkUrl = parseNextLinkUrl(response.headers.get("link"));
    const nextPage = readNextPage(response, page, pageGists.length);
    if (nextLinkUrl) {
      nextUrl = nextLinkUrl;
      page += 1;
    } else if (nextPage) {
      page = nextPage;
      nextUrl = backupGistListUrl(provider, token, page);
    } else {
      nextUrl = "";
    }
  }

  return gists;
}

async function findExistingBackupGist(provider: BackupProvider, token: string) {
  const gists = await fetchBackupGistList(provider, token);
  const matched =
    gists.find((gist) => Boolean(gist.files?.[remoteBackupManifestFilename])) ??
    gists.find((gist) => Boolean(gist.files?.[backupGistTitleFilename])) ??
    gists.find((gist) => gist.description === backupGistDescription);
  return matched ? normalizeGistResult(matched) : null;
}

async function resolveBackupGist(provider: BackupProvider, token: string, gistInput: string) {
  const gistId = extractGistId(gistInput);
  if (gistId) return { id: gistId, url: remoteGistHref(provider, gistId) };
  return findExistingBackupGist(provider, token);
}

export async function resolveBackupGistId(provider: BackupProvider, token: string, gistInput: string) {
  return (await resolveBackupGist(provider, token, gistInput))?.id ?? "";
}

function gistFilesBody(files: Record<string, string>) {
  const filesWithTitle = {
    [backupGistTitleFilename]: backupGistTitleContent,
    ...files,
  };
  return Object.fromEntries(Object.entries(filesWithTitle).map(([filename, content]) => [filename, { content }]));
}

async function createBackupGist(
  provider: BackupProvider,
  token: string,
  files: Record<string, string>,
): Promise<BackupGistResult> {
  if (provider === "github") {
    const response = await fetch("https://api.github.com/gists", {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: backupGistDescription,
        public: false,
        files: gistFilesBody(files),
      }),
    });
    if (!response.ok) await throwRemoteResponseError(provider, response);
    return normalizeGistResult((await response.json()) as { id?: string; html_url?: string; url?: string });
  }

  const response = await fetch("https://gitee.com/api/v5/gists", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      access_token: token,
      description: backupGistDescription,
      public: false,
      files: gistFilesBody(files),
    }),
  });
  if (!response.ok) await throwRemoteResponseError(provider, response);
  return normalizeGistResult(
    (await response.json()) as
      { id?: string; html_url?: string; url?: string } | Array<{ id?: string; html_url?: string; url?: string }>,
  );
}

export async function updateBackupGist(
  provider: BackupProvider,
  token: string,
  gistInput: string,
  files: Record<string, string>,
): Promise<BackupGistResult> {
  const resolvedGist = await resolveBackupGist(provider, token, gistInput);
  const gistId = resolvedGist?.id ?? "";
  if (!gistId) return createBackupGist(provider, token, files);

  if (provider === "github") {
    const response = await fetch(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, {
      method: "PATCH",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: backupGistDescription,
        files: gistFilesBody(files),
      }),
    });
    if (response.status === 404) throw new RemoteGistMissingError(provider, gistId);
    if (!response.ok) await throwRemoteResponseError(provider, response);
    return normalizeGistResult((await response.json()) as { id?: string; html_url?: string; url?: string });
  }

  const response = await fetch(`https://gitee.com/api/v5/gists/${encodeURIComponent(gistId)}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      access_token: token,
      description: backupGistDescription,
      files: gistFilesBody(files),
    }),
  });
  if (response.status === 404) throw new RemoteGistMissingError(provider, gistId);
  if (!response.ok) await throwRemoteResponseError(provider, response);
  return normalizeGistResult(
    (await response.json()) as
      { id?: string; html_url?: string; url?: string } | Array<{ id?: string; html_url?: string; url?: string }>,
  );
}

async function readGistFileContent(file: { content?: string; raw_url?: string }) {
  if (typeof file.content === "string") return file.content;
  if (!file.raw_url) throw new Error("远程同步文件没有可读取内容。");
  const response = await fetch(file.raw_url);
  if (!response.ok) throw new Error(await responseErrorMessage(response));
  return response.text();
}

async function fetchBackupGistFiles(provider: BackupProvider, token: string, gistInput: string) {
  const resolvedGist = await resolveBackupGist(provider, token, gistInput);
  const gistId = resolvedGist?.id ?? "";
  if (!gistId) throw new Error("没有找到 LinkTag 远程备份。");

  const response =
    provider === "github"
      ? await fetch(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
          },
        })
      : await fetch(
          `https://gitee.com/api/v5/gists/${encodeURIComponent(gistId)}?access_token=${encodeURIComponent(token)}`,
          {
            headers: { Accept: "application/json" },
          },
        );
  if (response.status === 404) throw new RemoteGistMissingError(provider, gistId);
  if (!response.ok) await throwRemoteResponseError(provider, response);
  const gist = (await response.json()) as { files?: Record<string, { content?: string; raw_url?: string }> };
  return gist.files ?? {};
}

export async function fetchRemoteBackupManifest(provider: BackupProvider, token: string, gistInput: string) {
  const files = await fetchBackupGistFiles(provider, token, gistInput);
  const manifestFile = files[remoteBackupManifestFilename];
  if (!manifestFile) throw new Error("没有找到远程同步元数据文件。");
  const content = await readGistFileContent(manifestFile);
  return parseRemoteBackupManifestContent(content);
}

export async function fetchRemoteBackupFiles(
  provider: BackupProvider,
  token: string,
  gistInput: string,
  manifest?: RemoteBackupManifest,
) {
  const files = await fetchBackupGistFiles(provider, token, gistInput);
  const manifestFile = files[remoteBackupManifestFilename];
  if (!manifest && !manifestFile) throw new Error("没有找到远程同步元数据文件。");
  const nextManifest = manifest ?? parseRemoteBackupManifestContent(await readGistFileContent(manifestFile!));
  const dataFile = files[nextManifest.data.file];
  if (!dataFile) throw new Error("没有找到远程同步数据文件。");
  const content = await readGistFileContent(dataFile);
  return { manifest: nextManifest, dataContent: content } satisfies RemoteBackupFiles;
}

export async function fetchRemoteBackupPayloadWithFiles(
  provider: BackupProvider,
  token: string,
  gistInput: string,
  manifest?: RemoteBackupManifest,
) {
  const remoteFiles = await fetchRemoteBackupFiles(provider, token, gistInput, manifest);
  return {
    payload: await parseRemoteBackupDataContent(remoteFiles.manifest, remoteFiles.dataContent),
    files: remoteFiles,
  };
}

export async function fetchRemoteBackupPayload(
  provider: BackupProvider,
  token: string,
  gistInput: string,
  manifest?: RemoteBackupManifest,
) {
  return (await fetchRemoteBackupPayloadWithFiles(provider, token, gistInput, manifest)).payload;
}

export function remoteVersionOf(value: BackupPayload | RemoteBackupManifest) {
  return value.type === "json" ? (value.metadata?.version ?? "") : value.metadata.version;
}

export function remoteParentVersionOf(value: BackupPayload | RemoteBackupManifest) {
  return value.type === "json" ? (value.metadata?.parentVersion ?? null) : value.metadata.parentVersion;
}

export function localVersion(metadata: MetadataRecord | null | undefined) {
  return metadata?.localVersion ?? "";
}

export function localBaseVersion(metadata: MetadataRecord | null | undefined) {
  return metadata?.baseVersion ?? null;
}

export function hasLocalUnsyncedChanges(metadata: MetadataRecord | null | undefined, data?: BackupSourceData) {
  if (!metadata) return Boolean(data && appDataHasContent(data));
  if (!metadata.baseVersion && !metadata.localVersion && data && appDataHasContent(data)) return true;
  return metadata.pendingSync || metadata.localVersion !== (metadata.baseVersion ?? "");
}

function appDataHasContent(data: BackupSourceData) {
  return Boolean(
    data.collections.length || data.links.length || data.tags.length || data.linkTags.length || data.relations.length,
  );
}

export function syncSnapshotDebug(snapshot: BackupSourceData, remote?: BackupPayload | RemoteBackupManifest) {
  const baseVersion = localBaseVersion(snapshot.metadata);
  const currentLocalVersion = localVersion(snapshot.metadata);
  const remoteVersion = remote ? remoteVersionOf(remote) : "";
  const remoteFileDetail =
    remote?.type === "gzip"
      ? {
          远程数据文件: remote.data.file,
          远程数据编码: remote.data.encoding,
          远程原始字节: remote.data.originalBytes,
          远程压缩字节: remote.data.compressedBytes,
        }
      : {};
  return {
    本地版本: currentLocalVersion || null,
    本地基线版本: baseVersion,
    本地是否变化: hasLocalUnsyncedChanges(snapshot.metadata, snapshot),
    是否待同步: snapshot.metadata?.pendingSync ?? false,
    待同步开始时间: snapshot.metadata?.pendingSyncAt ?? null,
    远程版本: remoteVersion || null,
    远程父版本: remote ? remoteParentVersionOf(remote) : null,
    远程是否变化: remote ? remoteVersion !== (baseVersion ?? "") : null,
    ...remoteFileDetail,
    集合数量: snapshot.collections.length,
    链接数量: snapshot.links.length,
    标签数量: snapshot.tags.length,
    绑定数量: snapshot.linkTags.length,
    关系数量: snapshot.relations.length,
  };
}

export function debugSyncLog(action: string, detail: Record<string, unknown>) {
  console.debug(`[LinkTag][同步] ${action}`, { 日志级别: "verbose", 动作: action, ...detail });
}

export async function checkRemoteBackup(
  snapshot: BackupSourceData,
  provider: BackupProvider,
  token: string,
  gist: string,
): Promise<BackupPreflightResult> {
  const resolvedGist = gist
    ? { id: extractGistId(gist), url: remoteGistHref(provider, gist) }
    : await resolveBackupGist(provider, token, gist);
  const resolvedGistInput = resolvedGist?.id || gist;
  if (!resolvedGistInput) {
    debugSyncLog("同步预检查：未配置远程位置", {
      远程类型: provider,
      是否配置Gist: false,
      ...syncSnapshotDebug(snapshot),
      判断结果: "上传本地",
    });
    return { type: "upload", remoteVersion: null, gist: "" };
  }
  let remoteManifest: RemoteBackupManifest;
  try {
    remoteManifest = await fetchRemoteBackupManifest(provider, token, resolvedGistInput);
  } catch (error) {
    if (isRemoteGistMissingError(error)) {
      debugSyncLog("同步预检查：现有 Gist 不可用", {
        远程类型: provider,
        Gist: resolvedGistInput,
        ...syncSnapshotDebug(snapshot),
        判断结果: "等待用户确认创建新 Gist",
      });
      return { type: "missing-gist", gist: resolvedGistInput, url: remoteGistHref(provider, resolvedGistInput) };
    }
    throw error;
  }
  const remoteVersion = remoteVersionOf(remoteManifest);
  const remoteParentVersion = remoteParentVersionOf(remoteManifest);
  const currentLocalVersion = localVersion(snapshot.metadata);
  const baseVersion = localBaseVersion(snapshot.metadata);
  const localChanged = hasLocalUnsyncedChanges(snapshot.metadata, snapshot);
  const remoteChanged = remoteVersion !== (baseVersion ?? "");
  const debugDetail = {
    远程类型: provider,
    Gist: resolvedGistInput,
    ...syncSnapshotDebug(snapshot, remoteManifest),
  };
  if (!localChanged && !remoteChanged) {
    debugSyncLog("同步预检查", { ...debugDetail, 判断结果: "无需处理" });
    return { type: "unchanged", remoteVersion, gist: resolvedGistInput };
  }
  if (!localChanged && remoteChanged) {
    debugSyncLog("同步预检查", { ...debugDetail, 判断结果: "拉取远程" });
    return { type: "pull", remoteManifest, gist: resolvedGistInput };
  }
  if (localChanged && !remoteChanged) {
    debugSyncLog("同步预检查", { ...debugDetail, 判断结果: "上传本地" });
    return { type: "upload", remoteVersion, gist: resolvedGistInput };
  }
  debugSyncLog("同步预检查", { ...debugDetail, 判断结果: "同步冲突" });
  return {
    type: "conflict",
    conflict: {
      provider,
      token,
      gist: resolvedGistInput,
      remoteManifest,
      remoteVersion,
      remoteParentVersion,
      localVersion: currentLocalVersion,
      localBaseVersion: baseVersion,
      pendingSync: snapshot.metadata?.pendingSync ?? localChanged,
      localSnapshot: snapshot,
    },
  };
}
