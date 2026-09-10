import { type DragEvent as ReactDragEvent, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@linktag/ui";

import {
  type DragPoint,
  getDragPoint,
  getDragPointTarget,
  getElementDragPlacement,
  setElementDragImage,
} from "../../core/drag";
import { linkGroupLayoutClassName } from "../../core/link-mode-utils";
import { searchIsEmpty, searchMatchesTab, type ParsedSearchQuery } from "../../core/search";
import { moveId, sameIds } from "../../core/sort";
import { GroupLinkCount, GroupShell } from "./GroupShell";
import { LinkCard } from "./LinkCard";
import type { LinkEditValues } from "./LinkEditDialog";
import type { BrowserTab, BrowserWindow, Id, LinkRecord, LinkView, TagRecord } from "../../types";

export function WindowGroups({
  windows,
  collectionId,
  searchQuery,
  filterQuery,
  linkMatchesBadgeFilter,
  linkView,
  collapsed,
  onToggle,
  allTags,
  linksById,
  tagsByLinkId,
  tagNamesByLinkId,
  onCreateTag,
  onBindTag,
  onDeleteBinding,
  onPersistRuntimeTabLink,
  onUpdateLink,
  onReorderLinks,
  onOpenLinks,
  activeBindingPopoverId,
  onOpenBindingPopover,
  onCloseBindingPopover,
  side = false,
  edgeToEdge = false,
  showEmptyGroups = false,
}: {
  windows: BrowserWindow[];
  collectionId: Id;
  searchQuery: ParsedSearchQuery;
  filterQuery: boolean;
  linkMatchesBadgeFilter: (linkId: Id) => boolean;
  linkView: LinkView;
  collapsed: Record<string, boolean>;
  onToggle: (key: string) => void;
  allTags: TagRecord[];
  linksById: Map<Id, LinkRecord>;
  tagsByLinkId: Map<Id, TagRecord[]>;
  tagNamesByLinkId: Map<Id, string[]>;
  onCreateTag: (name: string, color: string) => Promise<TagRecord | null>;
  onBindTag: (linkId: Id, tagId: Id) => Promise<void>;
  onDeleteBinding: (linkId: Id, tagId: Id) => void;
  onPersistRuntimeTabLink: (tab: BrowserTab) => Promise<void>;
  onUpdateLink: (linkId: Id, values: LinkEditValues) => Promise<void>;
  onReorderLinks: (orderedLinks: LinkRecord[], tagId?: Id) => Promise<void>;
  onOpenLinks?: (links: LinkRecord[], title: string) => void;
  activeBindingPopoverId: string | null;
  onOpenBindingPopover: (id: string) => void;
  onCloseBindingPopover: (id: string) => void;
  side?: boolean;
  edgeToEdge?: boolean;
  showEmptyGroups?: boolean;
}) {
  const canReorderWindowLinks = false;
  const [linkDragState, setLinkDragState] = useState<{ groupKey: string; linkId: Id; orderedIds: Id[] } | null>(null);
  const [optimisticLinkOrders, setOptimisticLinkOrders] = useState<Record<string, Id[]>>({});
  const linkDragPointRef = useRef<DragPoint | null>(null);
  const currentWindowLinkOrders = useMemo(
    () =>
      windows.map((window) => {
        const groupKey = `window:${window.id}`;
        const visibleLinks = window.tabs
          .map((tab, index) => ({ link: tabToLinkRecord(tab, linksById, collectionId), index }))
          .sort((left, right) => left.index - right.index);
        return { groupKey, orderedIds: visibleLinks.map((item) => item.link.id) };
      }),
    [collectionId, linksById, windows],
  );

  useEffect(() => {
    setOptimisticLinkOrders((current) => {
      let changed = false;
      const next = { ...current };
      for (const { groupKey, orderedIds } of currentWindowLinkOrders) {
        if (next[groupKey] && sameIds(next[groupKey], orderedIds)) {
          delete next[groupKey];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [currentWindowLinkOrders]);

  useEffect(() => {
    setOptimisticLinkOrders({});
  }, [collectionId]);

  const persistLinkOrder = (groupKey: string, links: LinkRecord[], orderedIds: Id[]) => {
    const linksById = new Map(links.map((link) => [link.id, link]));
    const orderedLinks = orderedIds
      .map((linkId) => linksById.get(linkId))
      .filter((link): link is LinkRecord => Boolean(link));
    setOptimisticLinkOrders((current) => ({ ...current, [groupKey]: orderedLinks.map((link) => link.id) }));
    void onReorderLinks(orderedLinks).catch((error: unknown) => {
      console.error("[LinkTag] 保存窗口链接排序失败", error);
    });
  };

  return (
    <>
      {windows.map((window) => {
        if (window.tabs.length === 0 && !showEmptyGroups) return null;
        const visibleTabs = window.tabs.filter((tab) => {
          const persistedLink = linksById.get(tab.linkId);
          const searchableTab = {
            ...tab,
            title: persistedLink?.title ?? tab.title,
            url: persistedLink?.url ?? tab.url,
          };
          return (
            (!filterQuery || searchMatchesTab(searchableTab, searchQuery, tagNamesByLinkId.get(tab.linkId) ?? [])) &&
            linkMatchesBadgeFilter(tab.linkId)
          );
        });
        if (filterQuery && !searchIsEmpty(searchQuery) && visibleTabs.length === 0 && !showEmptyGroups) return null;
        const groupKey = `window:${window.id}`;
        const visibleLinks = visibleTabs
          .map((tab, index) => ({ tab, link: tabToLinkRecord(tab, linksById, collectionId), index }))
          .sort((left, right) => left.index - right.index);
        const groupLinks = visibleLinks.map((item) => item.link);
        const visibleLinksByLinkId = new Map(visibleLinks.map((item) => [item.link.id, item]));
        const optimisticLinkIds = optimisticLinkOrders[groupKey] ?? null;
        const effectiveLinkIds = optimisticLinkIds
          ? [
              ...optimisticLinkIds.filter((linkId) => visibleLinksByLinkId.has(linkId)),
              ...groupLinks.map((link) => link.id).filter((linkId) => !optimisticLinkIds.includes(linkId)),
            ]
          : groupLinks.map((link) => link.id);
        const renderedLinks =
          linkDragState?.groupKey === groupKey
            ? linkDragState.orderedIds
                .map((linkId) => visibleLinksByLinkId.get(linkId))
                .filter((item): item is (typeof visibleLinks)[number] => Boolean(item))
            : effectiveLinkIds
                .map((linkId) => visibleLinksByLinkId.get(linkId))
                .filter((item): item is (typeof visibleLinks)[number] => Boolean(item));
        const isCollapsed =
          visibleTabs.length > 0 && (!filterQuery || searchIsEmpty(searchQuery)) && collapsed[groupKey];
        return (
          <GroupShell
            key={window.id}
            title={window.name}
            variant="window"
            edgeToEdge={edgeToEdge}
            collapsed={isCollapsed}
            onToggle={() => onToggle(groupKey)}
            titleMeta={
              <GroupLinkCount
                count={groupLinks.length}
                title={window.name}
                onOpen={onOpenLinks ? () => onOpenLinks(groupLinks, window.name) : undefined}
              />
            }
          >
            <div
              className={cn(side ? "grid gap-2 pb-1" : linkGroupLayoutClassName(linkView, "pb-1"))}
              data-ui-name="窗口链接列表"
            >
              {visibleTabs.length === 0 ? (
                <div className="px-1 text-xs text-muted-foreground" data-ui-name="窗口空链接提示">
                  没有链接
                </div>
              ) : null}
              {renderedLinks.map(({ tab, link: cardLink }) => {
                const handleDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
                  linkDragPointRef.current = getDragPoint(event);
                  if (!linkDragState || linkDragState.groupKey !== groupKey || linkDragState.linkId === cardLink.id)
                    return;
                  event.stopPropagation();
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  const placement = getElementDragPlacement(event);
                  setLinkDragState((current) => {
                    if (!current || current.groupKey !== groupKey) return current;
                    const orderedIds = moveId(current.orderedIds, current.linkId, cardLink.id, placement);
                    return orderedIds.every((id, index) => id === current.orderedIds[index])
                      ? current
                      : { ...current, orderedIds };
                  });
                };
                return (
                  <div
                    key={tab.id}
                    className={cn(
                      "min-w-0",
                      canReorderWindowLinks && "cursor-grab",
                      linkDragState?.linkId === cardLink.id && "opacity-50",
                    )}
                    data-linktag-window-link-group={groupKey}
                    data-linktag-window-link-sort-id={cardLink.id}
                    draggable={canReorderWindowLinks}
                    onDragStart={
                      canReorderWindowLinks
                        ? (event) => {
                            event.stopPropagation();
                            linkDragPointRef.current = getDragPoint(event);
                            setLinkDragState({
                              groupKey,
                              linkId: cardLink.id,
                              orderedIds: effectiveLinkIds,
                            });
                            setElementDragImage(event);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", cardLink.id);
                          }
                        : undefined
                    }
                    onDrag={
                      canReorderWindowLinks
                        ? (event) => {
                            event.stopPropagation();
                            linkDragPointRef.current = getDragPoint(event) ?? linkDragPointRef.current;
                          }
                        : undefined
                    }
                    onDragEnd={
                      canReorderWindowLinks
                        ? (event) => {
                            event.stopPropagation();
                            const point = getDragPoint(event) ?? linkDragPointRef.current;
                            const target = getDragPointTarget(point, "[data-linktag-window-link-sort-id]");
                            const targetId = target?.dataset.linktagWindowLinkSortId;
                            const targetGroupKey = target?.dataset.linktagWindowLinkGroup;
                            const sourceIds = linkDragState?.orderedIds ?? effectiveLinkIds;
                            const resolvedIds =
                              linkDragState &&
                              target &&
                              targetId &&
                              targetGroupKey === groupKey &&
                              targetId !== linkDragState.linkId
                                ? moveId(
                                    sourceIds,
                                    linkDragState.linkId,
                                    targetId,
                                    getElementDragPlacement({
                                      currentTarget: target,
                                      clientX: point!.clientX,
                                      clientY: point!.clientY,
                                    }),
                                  )
                                : linkDragState?.orderedIds;
                            const orderedIds =
                              linkDragState?.groupKey === groupKey &&
                              resolvedIds &&
                              !sameIds(resolvedIds, effectiveLinkIds)
                                ? resolvedIds
                                : null;
                            linkDragPointRef.current = null;
                            setLinkDragState(null);
                            if (orderedIds) persistLinkOrder(groupKey, groupLinks, orderedIds);
                          }
                        : undefined
                    }
                    onDragOver={canReorderWindowLinks ? handleDragOver : undefined}
                    onDrop={
                      canReorderWindowLinks
                        ? (event) => {
                            event.stopPropagation();
                            event.preventDefault();
                          }
                        : undefined
                    }
                  >
                    <LinkCard
                      view={side ? "list" : linkView === "grid" ? "card" : linkView}
                      link={cardLink}
                      faviconSrc={cardLink.url === tab.url ? tab.favicon : undefined}
                      tags={tagsByLinkId.get(tab.linkId) ?? []}
                      allTags={allTags}
                      onCreateTag={onCreateTag}
                      onBindTag={onBindTag}
                      onDeleteBinding={onDeleteBinding}
                      onUpdateLink={onUpdateLink}
                      onBeforeBind={() =>
                        onPersistRuntimeTabLink({
                          ...tab,
                          title: cardLink.title,
                          url: cardLink.url,
                        })
                      }
                      bindingPopoverId={`window:${window.id}:${tab.id}`}
                      activeBindingPopoverId={activeBindingPopoverId}
                      onOpenBindingPopover={onOpenBindingPopover}
                      onCloseBindingPopover={onCloseBindingPopover}
                      hideDomain={side}
                      fluid={!side}
                      openEditOnClick
                    />
                  </div>
                );
              })}
            </div>
          </GroupShell>
        );
      })}
    </>
  );
}

function tabToLinkRecord(tab: BrowserTab, linksById: Map<Id, LinkRecord>, collectionId: Id): LinkRecord {
  const persistedLink = linksById.get(tab.linkId);
  return {
    id: tab.linkId,
    collectionId: persistedLink?.collectionId ?? collectionId,
    title: persistedLink?.title ?? tab.title,
    url: persistedLink?.url ?? tab.url,
    note: persistedLink?.note,
  };
}
