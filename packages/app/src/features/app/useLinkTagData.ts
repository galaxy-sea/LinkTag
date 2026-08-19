import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";

import {
  type AppData,
  type AppLinkData,
  type AppShellData,
  readAppShellData,
  readLinkDataForLinkIds,
} from "../../core/app-data";
import { hydrateWindow } from "../../core/link-mode-utils";
import type { BrowserWindow, Id } from "../../types";

const emptyData: AppData = { links: [], tags: [], linkTags: [], relations: [], metadata: null };
const emptyTagLinkCountsByTagId = new Map<Id, number>();
const emptyShellData: AppShellData = {
  tags: [],
  relations: [],
  metadata: null,
  tagLinkCountsByTagId: emptyTagLinkCountsByTagId,
};
const emptyLinkData: AppLinkData = { links: [], linkTags: [] };

export function useLinkTagData(browserWindows: BrowserWindow[] | undefined, collectionId: Id | undefined) {
  const windowLinkIds = useMemo(() => collectWindowLinkIds(browserWindows), [browserWindows]);
  const windowLinkIdsSignature = useMemo(() => windowLinkIds.join("\u001f"), [windowLinkIds]);
  const liveShellData = useLiveQuery<AppShellData>(() => readAppShellData(collectionId), [collectionId]);
  const liveLinkData = useLiveQuery<AppLinkData>(
    () => readLinkDataForLinkIds(windowLinkIds, collectionId),
    [collectionId, windowLinkIdsSignature],
  );
  const shellData = liveShellData ?? emptyShellData;
  const linkData = liveLinkData ?? emptyLinkData;
  const data = useMemo<AppData>(
    () => ({
      ...linkData,
      ...shellData,
    }),
    [linkData, shellData],
  );
  const liveData = liveShellData ? data : undefined;
  const linksById = useMemo(() => new Map(data.links.map((link) => [link.id, link])), [data.links]);
  const tagsById = useMemo(() => new Map(data.tags.map((tag) => [tag.id, tag])), [data.tags]);
  const windows = useMemo(() => {
    const sourceWindows = browserWindows ?? [];
    return sourceWindows.map((win) => hydrateWindow(win, linksById));
  }, [browserWindows, linksById]);

  return {
    liveData,
    data,
    tagLinkCountsByTagId: shellData.tagLinkCountsByTagId,
    tagsById,
    windows,
  };
}

function collectWindowLinkIds(browserWindows: BrowserWindow[] | undefined): Id[] {
  const ids = new Set<Id>();
  for (const window of browserWindows ?? []) {
    for (const tab of window.tabs) ids.add(tab.linkId);
  }
  return [...ids].sort();
}
