import { type DragEvent as ReactDragEvent, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@linktag/ui";

import {
  type DragPoint,
  getDragPoint,
  getDragPointTarget,
  getElementDragPlacement,
  setElementDragImage,
  writeWindowTabDragPayload,
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
  onWindowTabDragStart,
  onWindowTabDragEnd,
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
  onWindowTabDragStart?: (payload: { tab: BrowserTab; link: LinkRecord }) => void;
  onWindowTabDragEnd?: () => void;
  side?: boolean;
  edgeToEdge?: boolean;
  showEmptyGroups?: boolean;
}) {
  const canReorderWindowLinks = false;
  const [linkDragState, setLinkDragState] = useState<{
    groupKey: string;
    instanceId: string;
    orderedIds: string[];
  } | null>(null);
  const [draggedWindowLinkInstanceId, setDraggedWindowLinkInstanceId] = useState<string | null>(null);
  const [optimisticLinkOrders, setOptimisticLinkOrders] = useState<Record<string, string[]>>({});
  const linkDragPointRef = useRef<DragPoint | null>(null);
  const currentWindowLinkOrders = useMemo(
    () =>
      windows.map((window) => {
        const groupKey = `window:${window.id}`;
        const visibleLinks = window.tabs
          .map((tab, index) => {
            const link = tabToLinkRecord(tab, linksById, collectionId);
            return { link, instanceId: getWindowLinkInstanceId(groupKey, tab, link, index), index };
          })
          .sort((left, right) => left.index - right.index);
        return { groupKey, orderedIds: visibleLinks.map((item) => item.instanceId) };
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

  const persistLinkOrder = (
    groupKey: string,
    links: Array<{ instanceId: string; link: LinkRecord }>,
    orderedIds: string[],
  ) => {
    const linksByInstanceId = new Map(links.map((item) => [item.instanceId, item.link]));
    const orderedLinks = orderedIds
      .map((instanceId) => linksByInstanceId.get(instanceId))
      .filter((link): link is LinkRecord => Boolean(link));
    setOptimisticLinkOrders((current) => ({ ...current, [groupKey]: orderedIds }));
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
          .map((tab, index) => {
            const link = tabToLinkRecord(tab, linksById, collectionId);
            return { tab, link, instanceId: getWindowLinkInstanceId(groupKey, tab, link, index), index };
          })
          .sort((left, right) => left.index - right.index);
        const groupLinks = visibleLinks.map((item) => item.link);
        const visibleLinksByInstanceId = new Map(visibleLinks.map((item) => [item.instanceId, item]));
        const optimisticLinkIds = optimisticLinkOrders[groupKey] ?? null;
        const effectiveLinkIds = optimisticLinkIds
          ? [
              ...optimisticLinkIds.filter((instanceId) => visibleLinksByInstanceId.has(instanceId)),
              ...visibleLinks.map((item) => item.instanceId).filter((instanceId) => !optimisticLinkIds.includes(instanceId)),
            ]
          : visibleLinks.map((item) => item.instanceId);
        const renderedLinks =
          linkDragState?.groupKey === groupKey
            ? linkDragState.orderedIds
                .map((instanceId) => visibleLinksByInstanceId.get(instanceId))
                .filter((item): item is (typeof visibleLinks)[number] => Boolean(item))
            : effectiveLinkIds
                .map((instanceId) => visibleLinksByInstanceId.get(instanceId))
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
              {renderedLinks.map(({ tab, link: cardLink, instanceId }) => {
                const handleDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
                  linkDragPointRef.current = getDragPoint(event);
                  if (!linkDragState || linkDragState.groupKey !== groupKey || linkDragState.instanceId === instanceId)
                    return;
                  event.stopPropagation();
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  const placement = getElementDragPlacement(event);
                  setLinkDragState((current) => {
                    if (!current || current.groupKey !== groupKey) return current;
                    const orderedIds = moveId(current.orderedIds, current.instanceId, instanceId, placement);
                    return orderedIds.every((id, index) => id === current.orderedIds[index])
                      ? current
                      : { ...current, orderedIds };
                  });
                };
                return (
                  <div
                    key={instanceId}
                    className={cn(
                      "min-w-0",
                      "cursor-grab",
                      (linkDragState?.instanceId === instanceId || draggedWindowLinkInstanceId === instanceId) &&
                        "opacity-50",
                    )}
                    data-linktag-window-link-group={groupKey}
                    data-linktag-window-link-sort-id={instanceId}
                    draggable
                    onDragStart={(event) => {
                      event.stopPropagation();
                      setDraggedWindowLinkInstanceId(instanceId);
                      setElementDragImage(event);
                      event.dataTransfer.effectAllowed = "copy";
                      const payload = {
                        tab: {
                          ...tab,
                          title: cardLink.title,
                          url: cardLink.url,
                        },
                        link: cardLink,
                      };
                      onWindowTabDragStart?.(payload);
                      writeWindowTabDragPayload(event.dataTransfer, payload);
                      if (canReorderWindowLinks) {
                        linkDragPointRef.current = getDragPoint(event);
                        setLinkDragState({
                          groupKey,
                          instanceId,
                          orderedIds: effectiveLinkIds,
                        });
                      }
                    }}
                    onDrag={
                      canReorderWindowLinks
                        ? (event) => {
                            event.stopPropagation();
                            linkDragPointRef.current = getDragPoint(event) ?? linkDragPointRef.current;
                          }
                        : undefined
                    }
                    onDragEnd={(event) => {
                      event.stopPropagation();
                      setDraggedWindowLinkInstanceId(null);
                      onWindowTabDragEnd?.();
                      if (canReorderWindowLinks) {
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
                          targetId !== linkDragState.instanceId
                            ? moveId(
                                sourceIds,
                                linkDragState.instanceId,
                                targetId,
                                getElementDragPlacement({
                                  currentTarget: target,
                                  clientX: point!.clientX,
                                  clientY: point!.clientY,
                                }),
                              )
                            : linkDragState?.orderedIds;
                        const orderedIds =
                          linkDragState?.groupKey === groupKey && resolvedIds && !sameIds(resolvedIds, effectiveLinkIds)
                            ? resolvedIds
                            : null;
                        linkDragPointRef.current = null;
                        setLinkDragState(null);
                        if (orderedIds) persistLinkOrder(groupKey, visibleLinks, orderedIds);
                      }
                    }}
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
                      bindingPopoverId={`window:${instanceId}`}
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

function getWindowLinkInstanceId(groupKey: string, tab: BrowserTab, link: LinkRecord, index: number) {
  return `${groupKey}:link:${index}:${tab.id}:${link.id}`;
}
