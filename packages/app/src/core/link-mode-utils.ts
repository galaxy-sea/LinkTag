import { cn } from "@linktag/ui";

import type { BrowserWindow, Id, LinkRecord, LinkTagRecord, LinkView } from "../types";

export function hydrateWindow(window: BrowserWindow, linksById: Map<Id, LinkRecord>): BrowserWindow {
  return {
    ...window,
    tabs: window.tabs.map((tab) => {
      const link = linksById.get(tab.linkId);
      return link
        ? {
            ...tab,
            title: link.title,
            url: link.url,
          }
        : tab;
    }),
  };
}

export function groupLinkTagsByLinkId(linkTags: LinkTagRecord[]) {
  const map = new Map<Id, LinkTagRecord[]>();
  for (const row of linkTags) {
    const rows = map.get(row.linkId);
    if (rows) rows.push(row);
    else map.set(row.linkId, [row]);
  }
  return map;
}

export function groupLinkTagsByTagId(linkTags: LinkTagRecord[]) {
  const map = new Map<Id, LinkTagRecord[]>();
  for (const row of linkTags) {
    const rows = map.get(row.tagId);
    if (rows) rows.push(row);
    else map.set(row.tagId, [row]);
  }
  return map;
}

export function linkGroupLayoutClassName(linkView: LinkView, className?: string) {
  return cn(
    "grid gap-2",
    linkView === "list" && "grid-cols-1",
    linkView === "compact" && "grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]",
    linkView === "grid" && "grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))]",
    linkView === "card" &&
      "grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] md:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]",
    className,
  );
}
