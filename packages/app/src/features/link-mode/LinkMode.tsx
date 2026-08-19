import { type DragEvent as ReactDragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { cn } from "@linktag/ui";

import { type AppLinkData, readLinkDataForTag } from "../../core/app-data";
import { getElementDragPlacement, setElementDragImage } from "../../core/drag";
import type { BadgeFilter } from "../../core/filters";
import { moveId } from "../../core/sort";
import { GroupLinkCount, GroupShell } from "./GroupShell";
import { LinkCard } from "./LinkCard";
import type { LinkEditValues } from "./LinkEditDialog";
import { groupLinkTagsByLinkId, linkGroupLayoutClassName } from "../../core/link-mode-utils";
import {
  parseSearchQuery,
  searchIsEmpty,
  searchMatchesLink,
  searchMatchesTag,
  type ParsedSearchQuery,
} from "../../core/search";
import { GroupRelationBadge, GroupTagBadge } from "../tags/TagBadges";
import type {
  BrowserTab,
  BrowserWindow,
  Id,
  LinkRecord,
  LinkTagRecord,
  LinkView,
  TagDisplayFormat,
  TagGroupSort,
  TagRecord,
  TagRelationRecord,
  WindowGroupLayout,
} from "../../types";
import { WindowGroups } from "./WindowGroups";

const emptyLinkData: AppLinkData = { links: [], linkTags: [] };
const groupRenderStep = 80;

function compareTagGroups(left: TagRecord, right: TagRecord, sort: TagGroupSort) {
  const updatedDiff = Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
  const weightDiff = (left.sort ?? 0) - (right.sort ?? 0);
  const nameDiff = left.name.localeCompare(right.name);

  if (sort === "updated-desc") return -updatedDiff || nameDiff;
  if (sort === "updated-asc") return updatedDiff || nameDiff;
  if (sort === "weight-desc") return -weightDiff || nameDiff;
  if (sort === "weight-asc") return weightDiff || nameDiff;
  if (sort === "name-desc") return -nameDiff;
  return nameDiff;
}

export function LinkMode({
  windows,
  collectionId,
  links,
  tags,
  relations,
  linkTags,
  tagLinkCountsByTagId,
  linkView,
  windowGroupLayout,
  tagGroupSort,
  onTagGroupSortChange,
  tagDisplayFormat,
  collapsedWindowGroups,
  collapsedTagIds,
  onToggleWindowGroup,
  onToggleTagGroup,
  badgeFilters,
  onBadgeFilterChange,
  filterWindowLinks,
  toolbarWindowGroupsOpen,
  onWindowGroupsPanelEnter,
  onWindowGroupsPanelLeave,
  query,
  onCreateTag,
  onBindTag,
  onDeleteBinding,
  onEditTag,
  onPersistRuntimeTabLink,
  onUpdateLink,
  onReorderTagGroups,
  onReorderLinks,
  onOpenLinks,
}: {
  windows: BrowserWindow[];
  collectionId: Id;
  links: LinkRecord[];
  tags: TagRecord[];
  relations: TagRelationRecord[];
  linkTags: LinkTagRecord[];
  tagLinkCountsByTagId: Map<Id, number>;
  linkView: LinkView;
  windowGroupLayout: WindowGroupLayout;
  tagGroupSort: TagGroupSort;
  onTagGroupSortChange: (sort: TagGroupSort) => void;
  tagDisplayFormat: TagDisplayFormat;
  collapsedWindowGroups: Record<string, boolean>;
  collapsedTagIds: Set<Id>;
  onToggleWindowGroup: (key: string) => void;
  onToggleTagGroup: (tagId: Id) => void;
  badgeFilters: BadgeFilter[];
  onBadgeFilterChange: (filter: BadgeFilter, additive?: boolean) => void;
  filterWindowLinks: boolean;
  toolbarWindowGroupsOpen: boolean;
  onWindowGroupsPanelEnter: () => void;
  onWindowGroupsPanelLeave: () => void;
  query: string;
  onCreateTag: (name: string, color: string) => Promise<TagRecord | null>;
  onBindTag: (linkId: Id, tagId: Id) => Promise<void>;
  onDeleteBinding: (linkId: Id, tagId: Id) => void;
  onEditTag: (tag: TagRecord) => void;
  onPersistRuntimeTabLink: (tab: BrowserTab) => Promise<void>;
  onUpdateLink: (linkId: Id, values: LinkEditValues) => Promise<void>;
  onReorderTagGroups: (orderedTags: TagRecord[]) => Promise<void>;
  onReorderLinks: (orderedLinks: LinkRecord[]) => Promise<void>;
  onOpenLinks?: (links: LinkRecord[], title: string) => void;
}) {
  const [activeBindingPopoverId, setActiveBindingPopoverId] = useState<string | null>(null);
  const [rightHoverOpen, setRightHoverOpen] = useState(false);
  const [draggedTagGroupId, setDraggedTagGroupId] = useState<Id | null>(null);
  const [previewTagGroupIds, setPreviewTagGroupIds] = useState<Id[] | null>(null);
  const tagsById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const linksById = useMemo(() => new Map(links.map((link) => [link.id, link])), [links]);
  const relationsById = useMemo(() => new Map(relations.map((relation) => [relation.id, relation])), [relations]);
  const linkTagsByLinkId = useMemo(() => groupLinkTagsByLinkId(linkTags), [linkTags]);
  const tagsByLinkId = useMemo(() => {
    const map = new Map<Id, TagRecord[]>();
    for (const [linkId, bindings] of linkTagsByLinkId) {
      const linkTags = bindings.map((binding) => tagsById.get(binding.tagId)).filter(Boolean) as TagRecord[];
      map.set(linkId, linkTags);
    }
    return map;
  }, [linkTagsByLinkId, tagsById]);
  const tagNamesByLinkId = useMemo(() => {
    const map = new Map<Id, string[]>();
    for (const [linkId, linkTags] of tagsByLinkId) {
      map.set(
        linkId,
        linkTags.map((tag) => tag.name),
      );
    }
    return map;
  }, [tagsByLinkId]);
  const linkTagIdsByLinkId = useMemo(() => {
    const map = new Map<Id, Set<Id>>();
    for (const [linkId, bindings] of linkTagsByLinkId) {
      map.set(linkId, new Set(bindings.map((binding) => binding.tagId)));
    }
    return map;
  }, [linkTagsByLinkId]);
  const relationsByTagId = useMemo(() => {
    const map = new Map<Id, TagRelationRecord[]>();
    for (const relation of relations) {
      const sourceRelations = map.get(relation.sourceTagId);
      if (sourceRelations) sourceRelations.push(relation);
      else map.set(relation.sourceTagId, [relation]);

      const targetRelations = map.get(relation.targetTagId);
      if (targetRelations) targetRelations.push(relation);
      else map.set(relation.targetTagId, [relation]);
    }
    return map;
  }, [relations]);
  const searchQuery = useMemo(() => parseSearchQuery(query), [query]);
  const selectedTagIdList = useMemo(
    () => badgeFilters.filter((filter) => filter.type === "tag").map((filter) => filter.tagId),
    [badgeFilters],
  );
  const selectedTagIds = useMemo(() => new Set(selectedTagIdList), [selectedTagIdList]);
  const activeRelations = useMemo(
    () =>
      badgeFilters
        .filter((filter) => filter.type === "relation")
        .map((filter) => relationsById.get(filter.relationId))
        .filter((relation): relation is TagRelationRecord => Boolean(relation)),
    [badgeFilters, relationsById],
  );
  const activeRelationIds = useMemo(() => new Set(activeRelations.map((relation) => relation.id)), [activeRelations]);
  const hasWindowGroups = windows.some((window) => window.tabs.length > 0);
  const canDragTagGroups = searchIsEmpty(searchQuery) && badgeFilters.length === 0;

  const linkHasAnySelectedTag = useCallback(
    (linkId: Id) => {
      if (selectedTagIdList.length === 0) return true;
      const tagIds = linkTagIdsByLinkId.get(linkId);
      if (!tagIds) return false;
      return selectedTagIdList.some((tagId) => tagIds.has(tagId));
    },
    [linkTagIdsByLinkId, selectedTagIdList],
  );

  const openBindingPopover = useCallback((id: string) => {
    setActiveBindingPopoverId(id);
  }, []);
  const closeBindingPopover = useCallback((id: string) => {
    setActiveBindingPopoverId((current) => (current === id ? null : current));
  }, []);

  const windowGroups = (side = false, edgeToEdge = false) => (
    <WindowGroups
      windows={windows}
      collectionId={collectionId}
      searchQuery={searchQuery}
      filterQuery={filterWindowLinks}
      linkMatchesBadgeFilter={(linkId) => !filterWindowLinks || linkHasAnySelectedTag(linkId)}
      linkView={linkView}
      collapsed={collapsedWindowGroups}
      onToggle={onToggleWindowGroup}
      allTags={tags}
      linksById={linksById}
      tagsByLinkId={tagsByLinkId}
      tagNamesByLinkId={tagNamesByLinkId}
      onCreateTag={onCreateTag}
      onBindTag={onBindTag}
      onDeleteBinding={onDeleteBinding}
      onPersistRuntimeTabLink={onPersistRuntimeTabLink}
      onUpdateLink={onUpdateLink}
      onReorderLinks={onReorderLinks}
      onOpenLinks={onOpenLinks}
      activeBindingPopoverId={activeBindingPopoverId}
      onOpenBindingPopover={openBindingPopover}
      onCloseBindingPopover={closeBindingPopover}
      side={side}
      edgeToEdge={edgeToEdge}
      showEmptyGroups={side}
    />
  );

  const tagsForGroups = useMemo(() => {
    const compare = (left: TagRecord, right: TagRecord) => compareTagGroups(left, right, tagGroupSort);
    if (badgeFilters.length === 0) return [...tags].sort(compare);
    const relatedTagIds = new Set<Id>();
    const orderedSelectedTagIds = badgeFilters.filter((filter) => filter.type === "tag").map((filter) => filter.tagId);

    orderedSelectedTagIds.forEach((tagId) => {
      relatedTagIds.add(tagId);
      (relationsByTagId.get(tagId) ?? []).forEach((relation) => {
        if (relation.sourceTagId === tagId) relatedTagIds.add(relation.targetTagId);
        if (relation.targetTagId === tagId) relatedTagIds.add(relation.sourceTagId);
      });
    });
    activeRelations.forEach((relation) => {
      relatedTagIds.add(relation.sourceTagId);
      relatedTagIds.add(relation.targetTagId);
    });

    return tags.filter((tag) => relatedTagIds.has(tag.id)).sort(compare);
  }, [activeRelations, badgeFilters, relationsByTagId, tagGroupSort, tags]);

  const tagGroupIds = useMemo(() => tagsForGroups.map((tag) => tag.id), [tagsForGroups]);
  const renderedTagsForGroups = useMemo(() => {
    if (!previewTagGroupIds) return tagsForGroups;
    return previewTagGroupIds.map((tagId) => tagsById.get(tagId)).filter((tag): tag is TagRecord => Boolean(tag));
  }, [previewTagGroupIds, tagsById, tagsForGroups]);

  useEffect(() => {
    if (!draggedTagGroupId) setPreviewTagGroupIds(null);
  }, [draggedTagGroupId, tagGroupIds]);

  const persistTagGroupOrder = useCallback(
    (orderedIds: Id[]) => {
      const orderedTags = orderedIds
        .map((tagId) => tagsById.get(tagId))
        .filter((tag): tag is TagRecord => Boolean(tag));
      onTagGroupSortChange("weight-desc");
      void onReorderTagGroups(orderedTags).catch((error: unknown) => {
        console.error("[LinkTag] 保存标签分组排序失败", error);
      });
    },
    [onReorderTagGroups, onTagGroupSortChange, tagsById],
  );

  const relationIntersectionGroups = activeRelations.map((relation) => (
    <RelationLinkGroup
      key={`relation:${relation.id}`}
      relation={relation}
      collectionId={collectionId}
      searchQuery={searchQuery}
      linkView={linkView}
      allTags={tags}
      tagsById={tagsById}
      selectedTagIds={selectedTagIds}
      onBadgeFilterChange={onBadgeFilterChange}
      onEditTag={onEditTag}
      onCreateTag={onCreateTag}
      onBindTag={onBindTag}
      onDeleteBinding={onDeleteBinding}
      onUpdateLink={onUpdateLink}
      onReorderLinks={onReorderLinks}
      activeBindingPopoverId={activeBindingPopoverId}
      onOpenBindingPopover={openBindingPopover}
      onCloseBindingPopover={closeBindingPopover}
      onOpenLinks={onOpenLinks}
    />
  ));

  const tagGroups = (
    <>
      {renderedTagsForGroups.map((tag) => (
        <TagLinkGroup
          key={tag.id}
          tag={tag}
          collectionId={collectionId}
          isCollapsed={searchIsEmpty(searchQuery) && badgeFilters.length === 0 && collapsedTagIds.has(tag.id)}
          forceLoad={!searchIsEmpty(searchQuery) || badgeFilters.length > 0}
          searchQuery={searchQuery}
          linkView={linkView}
          tagDisplayFormat={tagDisplayFormat}
          allTags={tags}
          tagsById={tagsById}
          relationsByTagId={relationsByTagId}
          selectedTagIds={selectedTagIds}
          selectedTagIdList={selectedTagIdList}
          activeRelationIds={activeRelationIds}
          totalLinkCount={tagLinkCountsByTagId.get(tag.id) ?? 0}
          onBadgeFilterChange={onBadgeFilterChange}
          onEditTag={onEditTag}
          onToggle={() => onToggleTagGroup(tag.id)}
          onCreateTag={onCreateTag}
          onBindTag={onBindTag}
          onDeleteBinding={onDeleteBinding}
          onUpdateLink={onUpdateLink}
          onReorderLinks={onReorderLinks}
          activeBindingPopoverId={activeBindingPopoverId}
          onOpenBindingPopover={openBindingPopover}
          onCloseBindingPopover={closeBindingPopover}
          onOpenLinks={onOpenLinks}
          dragEnabled={canDragTagGroups}
          dragging={draggedTagGroupId === tag.id}
          onDragStart={(event) => {
            setDraggedTagGroupId(tag.id);
            setPreviewTagGroupIds(tagGroupIds);
            setElementDragImage(event);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", tag.id);
          }}
          onDragEnd={() => setDraggedTagGroupId(null)}
          onDragOver={(event) => {
            if (!draggedTagGroupId || draggedTagGroupId === tag.id) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            const placement = getElementDragPlacement(event);
            setPreviewTagGroupIds((current) => {
              const sourceIds = current ?? tagGroupIds;
              const orderedIds = moveId(sourceIds, draggedTagGroupId, tag.id, placement);
              return orderedIds.every((id, index) => id === sourceIds[index]) ? current : orderedIds;
            });
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (!draggedTagGroupId) return;
            persistTagGroupOrder(previewTagGroupIds ?? tagGroupIds);
            setDraggedTagGroupId(null);
            setPreviewTagGroupIds(null);
          }}
        />
      ))}
    </>
  );

  const topHoverOpen = hasWindowGroups && windowGroupLayout === "top-hover" && toolbarWindowGroupsOpen;
  const showTopInline = hasWindowGroups && windowGroupLayout === "top";
  const showRightInline = windowGroupLayout === "right";
  const showRightHover = windowGroupLayout === "right-hover";

  return (
    <div className="relative h-full overflow-hidden" data-ui-name="链接模式页面">
      {topHoverOpen ? (
        <div
          className="absolute inset-x-0 top-0 z-40 max-h-[55vh] overflow-auto border-b border-border bg-background/95 py-4 shadow-panel backdrop-blur"
          data-ui-name="顶部收纳窗口分组浮层"
          onPointerEnter={onWindowGroupsPanelEnter}
          onPointerLeave={onWindowGroupsPanelLeave}
        >
          <div className="grid gap-4" data-ui-name="顶部收纳窗口分组列表">
            {windowGroups(false, true)}
          </div>
        </div>
      ) : null}

      <div className="flex h-full min-w-0" data-ui-name="链接模式布局区">
        <div className="linktag-scrollbar min-w-0 flex-1 overflow-auto py-4" data-ui-name="链接主分组滚动区">
          <div className="grid gap-4" data-ui-name="链接分组列表">
            {showTopInline ? windowGroups(false, true) : null}
            {relationIntersectionGroups}
            {tagGroups}
          </div>
        </div>
        {showRightInline ? (
          <aside
            className="linktag-scrollbar h-full w-56 shrink-0 overflow-auto border-l border-border bg-workspace-surface py-4"
            data-ui-name="右侧窗口分组栏"
          >
            <div className="grid gap-3" data-ui-name="右侧窗口分组列表">
              {windowGroups(true, true)}
            </div>
          </aside>
        ) : null}
      </div>

      {showRightHover ? (
        <aside
          className={cn(
            "linktag-scrollbar absolute inset-y-0 right-0 z-30 overflow-auto border-l border-border bg-workspace-surface shadow-panel transition-[width]",
            rightHoverOpen ? "w-56 py-4" : "w-3",
          )}
          data-ui-name="右侧收纳窗口分组栏"
          onPointerEnter={() => setRightHoverOpen(true)}
          onPointerLeave={() => setRightHoverOpen(false)}
        >
          {rightHoverOpen ? (
            <div className="grid gap-3" data-ui-name="右侧收纳窗口分组列表">
              {windowGroups(true, true)}
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}

function TagLinkGroup({
  tag,
  collectionId,
  isCollapsed,
  forceLoad,
  searchQuery,
  linkView,
  tagDisplayFormat,
  allTags,
  tagsById,
  relationsByTagId,
  selectedTagIds,
  selectedTagIdList,
  activeRelationIds,
  totalLinkCount,
  onBadgeFilterChange,
  onEditTag,
  onToggle,
  onCreateTag,
  onBindTag,
  onDeleteBinding,
  onUpdateLink,
  onReorderLinks,
  activeBindingPopoverId,
  onOpenBindingPopover,
  onCloseBindingPopover,
  onOpenLinks,
  dragEnabled,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  tag: TagRecord;
  collectionId: Id;
  isCollapsed: boolean;
  forceLoad: boolean;
  searchQuery: ParsedSearchQuery;
  linkView: LinkView;
  tagDisplayFormat: TagDisplayFormat;
  allTags: TagRecord[];
  tagsById: Map<Id, TagRecord>;
  relationsByTagId: Map<Id, TagRelationRecord[]>;
  selectedTagIds: Set<Id>;
  selectedTagIdList: Id[];
  activeRelationIds: Set<Id>;
  totalLinkCount: number | null;
  onBadgeFilterChange: (filter: BadgeFilter, additive?: boolean) => void;
  onEditTag: (tag: TagRecord) => void;
  onToggle: () => void;
  onCreateTag: (name: string, color: string) => Promise<TagRecord | null>;
  onBindTag: (linkId: Id, tagId: Id) => Promise<void>;
  onDeleteBinding: (linkId: Id, tagId: Id) => void;
  onUpdateLink: (linkId: Id, values: LinkEditValues) => Promise<void>;
  onReorderLinks: (orderedLinks: LinkRecord[]) => Promise<void>;
  activeBindingPopoverId: string | null;
  onOpenBindingPopover: (id: string) => void;
  onCloseBindingPopover: (id: string) => void;
  onOpenLinks?: (links: LinkRecord[], title: string) => void;
  dragEnabled: boolean;
  dragging: boolean;
  onDragStart: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
}) {
  const [viewportRef, nearViewport] = useNearViewport<HTMLDivElement>(!forceLoad && !isCollapsed);
  const shouldLoad = forceLoad || (!isCollapsed && nearViewport);
  const liveLinkData = useLiveQuery<AppLinkData | null>(
    () => (shouldLoad ? readLinkDataForTag(tag.id, collectionId) : Promise.resolve(null)),
    [collectionId, tag.id, shouldLoad],
  );
  const linkData = liveLinkData ?? emptyLinkData;
  const { tagsByLinkId, tagNamesByLinkId, tagIdsByLinkId } = useMemo(
    () => buildLinkLookups(linkData, tagsById),
    [linkData, tagsById],
  );
  const [visibleCount, setVisibleCount] = useState(groupRenderStep);

  useEffect(() => {
    setVisibleCount(groupRenderStep);
  }, [tag.id, searchQuery, selectedTagIdList, activeRelationIds]);

  const visibleLinks = useMemo(
    () =>
      linkData.links.filter(
        (link) =>
          searchMatchesLink(link, searchQuery, tagNamesByLinkId.get(link.id) ?? []) &&
          linkHasAnySelectedTag(link.id, tagIdsByLinkId, selectedTagIdList),
      ),
    [linkData.links, searchQuery, selectedTagIdList, tagIdsByLinkId, tagNamesByLinkId],
  );

  const related = useMemo(
    () =>
      (relationsByTagId.get(tag.id) ?? [])
        .map((relation) => {
          const relatedTag = tagsById.get(
            relation.sourceTagId === tag.id ? relation.targetTagId : relation.sourceTagId,
          );
          return relatedTag ? { relation, tag: relatedTag } : null;
        })
        .filter((item): item is { relation: TagRelationRecord; tag: TagRecord } => Boolean(item)),
    [relationsByTagId, tag.id, tagsById],
  );

  if (forceLoad && liveLinkData && visibleLinks.length === 0 && !searchMatchesTag(tag, searchQuery)) return null;

  const renderedLinks = visibleLinks.slice(0, visibleCount);
  const hasMore = visibleCount < visibleLinks.length;
  const canUseTotalLinkCount =
    searchIsEmpty(searchQuery) && selectedTagIdList.length === 0 && activeRelationIds.size === 0;
  const count = liveLinkData ? visibleLinks.length : canUseTotalLinkCount ? totalLinkCount : null;

  return (
    <div
      ref={viewportRef}
      className={cn(dragEnabled && "cursor-grab", dragging && "opacity-50")}
      draggable={dragEnabled}
      onDragStart={dragEnabled ? onDragStart : undefined}
      onDragEnd={dragEnabled ? onDragEnd : undefined}
      onDragOver={dragEnabled ? onDragOver : undefined}
      onDrop={dragEnabled ? onDrop : undefined}
    >
      <GroupShell
        title={tag.name}
        titleNode={
          <GroupTagBadge
            tag={tag}
            active={selectedTagIds.has(tag.id)}
            onClick={() => onBadgeFilterChange({ type: "tag", tagId: tag.id })}
            onEdit={onEditTag}
          />
        }
        collapsed={isCollapsed}
        onToggle={onToggle}
        titleMeta={
          <GroupLinkCount
            count={count}
            title={tag.name}
            onOpen={onOpenLinks && liveLinkData ? () => onOpenLinks(visibleLinks, tag.name) : undefined}
          />
        }
        meta={
          <div className="block w-full min-w-0 whitespace-normal break-all text-left leading-7 [overflow-wrap:anywhere]">
            {related.map((item) => (
              <GroupRelationBadge
                key={item.relation.id}
                relation={item.relation}
                tag={item.tag}
                format={tagDisplayFormat}
                activeTag={selectedTagIds.has(item.tag.id)}
                activeRelation={activeRelationIds.has(item.relation.id)}
                onTagClick={(tagId) => onBadgeFilterChange({ type: "tag", tagId })}
                onRelationClick={(relationId) => onBadgeFilterChange({ type: "relation", relationId })}
                onTagEdit={onEditTag}
              />
            ))}
          </div>
        }
      >
        {!liveLinkData ? (
          <LinkGroupLoadingSkeleton linkView={linkView} count={canUseTotalLinkCount ? totalLinkCount : null} />
        ) : (
          <LinkGroupCards
            links={renderedLinks}
            linkView={linkView}
            tagsByLinkId={tagsByLinkId}
            allTags={allTags}
            onCreateTag={onCreateTag}
            onBindTag={onBindTag}
            onDeleteBinding={onDeleteBinding}
            onUpdateLink={onUpdateLink}
            onReorderLinks={onReorderLinks}
            activeBindingPopoverId={activeBindingPopoverId}
            onOpenBindingPopover={onOpenBindingPopover}
            onCloseBindingPopover={onCloseBindingPopover}
            bindingPrefix={`tag:${tag.id}`}
            priorityTagId={tag.id}
            unbindTagId={tag.id}
          />
        )}
        {hasMore ? (
          <div
            role="button"
            tabIndex={0}
            className="mt-3 inline-flex rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
            onClick={() => setVisibleCount((current) => current + groupRenderStep)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              setVisibleCount((current) => current + groupRenderStep);
            }}
          >
            更多 {Math.min(groupRenderStep, visibleLinks.length - visibleCount)}
          </div>
        ) : null}
      </GroupShell>
    </div>
  );
}

function RelationLinkGroup({
  relation,
  collectionId,
  searchQuery,
  linkView,
  allTags,
  tagsById,
  selectedTagIds,
  onBadgeFilterChange,
  onEditTag,
  onCreateTag,
  onBindTag,
  onDeleteBinding,
  onUpdateLink,
  onReorderLinks,
  activeBindingPopoverId,
  onOpenBindingPopover,
  onCloseBindingPopover,
  onOpenLinks,
}: {
  relation: TagRelationRecord;
  collectionId: Id;
  searchQuery: ParsedSearchQuery;
  linkView: LinkView;
  allTags: TagRecord[];
  tagsById: Map<Id, TagRecord>;
  selectedTagIds: Set<Id>;
  onBadgeFilterChange: (filter: BadgeFilter, additive?: boolean) => void;
  onEditTag: (tag: TagRecord) => void;
  onCreateTag: (name: string, color: string) => Promise<TagRecord | null>;
  onBindTag: (linkId: Id, tagId: Id) => Promise<void>;
  onDeleteBinding: (linkId: Id, tagId: Id) => void;
  onUpdateLink: (linkId: Id, values: LinkEditValues) => Promise<void>;
  onReorderLinks: (orderedLinks: LinkRecord[]) => Promise<void>;
  activeBindingPopoverId: string | null;
  onOpenBindingPopover: (id: string) => void;
  onCloseBindingPopover: (id: string) => void;
  onOpenLinks?: (links: LinkRecord[], title: string) => void;
}) {
  const liveLinkData = useLiveQuery<AppLinkData>(
    () => readLinkDataForTag(relation.sourceTagId, collectionId),
    [collectionId, relation.sourceTagId],
  );
  const linkData = liveLinkData ?? emptyLinkData;
  const { tagsByLinkId, tagNamesByLinkId, tagIdsByLinkId } = useMemo(
    () => buildLinkLookups(linkData, tagsById),
    [linkData, tagsById],
  );
  const [visibleCount, setVisibleCount] = useState(groupRenderStep);

  useEffect(() => {
    setVisibleCount(groupRenderStep);
  }, [relation.id, searchQuery]);

  const relationLinks = useMemo(
    () =>
      linkData.links.filter(
        (link) =>
          searchMatchesLink(link, searchQuery, tagNamesByLinkId.get(link.id) ?? [], [relation.name]) &&
          linkMatchesRelation(link.id, relation, tagIdsByLinkId),
      ),
    [linkData.links, relation, searchQuery, tagIdsByLinkId, tagNamesByLinkId],
  );
  const renderedLinks = relationLinks.slice(0, visibleCount);
  const hasMore = visibleCount < relationLinks.length;

  return (
    <GroupShell
      title={relation.name || "关系交集"}
      titleNode={
        tagsById.get(relation.sourceTagId) ? (
          <GroupRelationBadge
            relation={relation}
            tag={tagsById.get(relation.sourceTagId)!}
            format="relation"
            activeRelation
            onRelationClick={(relationId) => onBadgeFilterChange({ type: "relation", relationId })}
            onTagEdit={onEditTag}
          />
        ) : undefined
      }
      collapsed={false}
      onToggle={() => undefined}
      titleMeta={
        <GroupLinkCount
          count={liveLinkData ? relationLinks.length : null}
          title={relation.name || relation.id}
          onOpen={
            onOpenLinks && liveLinkData ? () => onOpenLinks(relationLinks, relation.name || "关系交集") : undefined
          }
        />
      }
      meta={
        <div className="block w-full min-w-0 whitespace-normal break-all text-left leading-7 [overflow-wrap:anywhere]">
          {[relation.sourceTagId, relation.targetTagId]
            .map((tagId) => tagsById.get(tagId))
            .filter((tag): tag is TagRecord => Boolean(tag))
            .map((tag) => (
              <GroupTagBadge
                key={tag.id}
                tag={tag}
                active={selectedTagIds.has(tag.id)}
                onClick={() => onBadgeFilterChange({ type: "tag", tagId: tag.id })}
                onEdit={onEditTag}
              />
            ))}
        </div>
      }
    >
      {!liveLinkData ? (
        <LinkGroupLoadingSkeleton linkView={linkView} count={null} />
      ) : (
        <LinkGroupCards
          links={renderedLinks}
          linkView={linkView}
          tagsByLinkId={tagsByLinkId}
          allTags={allTags}
          onCreateTag={onCreateTag}
          onBindTag={onBindTag}
          onDeleteBinding={onDeleteBinding}
          onUpdateLink={onUpdateLink}
          onReorderLinks={onReorderLinks}
          activeBindingPopoverId={activeBindingPopoverId}
          onOpenBindingPopover={onOpenBindingPopover}
          onCloseBindingPopover={onCloseBindingPopover}
          bindingPrefix={`relation:${relation.id}`}
          priorityTagId={relation.sourceTagId}
        />
      )}
      {hasMore ? (
        <div
          role="button"
          tabIndex={0}
          className="mt-3 inline-flex rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          onClick={() => setVisibleCount((current) => current + groupRenderStep)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            setVisibleCount((current) => current + groupRenderStep);
          }}
        >
          更多 {Math.min(groupRenderStep, relationLinks.length - visibleCount)}
        </div>
      ) : null}
    </GroupShell>
  );
}

function LinkGroupLoadingSkeleton({ linkView, count }: { linkView: LinkView; count: number | null }) {
  const placeholderCount = count === null ? 6 : Math.min(count, groupRenderStep);
  if (placeholderCount === 0) {
    return (
      <div className="px-1 text-sm text-muted-foreground" data-ui-name="链接分组空占位">
        没有链接
      </div>
    );
  }
  const compact = linkView === "compact";
  const list = linkView === "list";

  return (
    <div className={linkGroupLayoutClassName(linkView)} data-ui-name="链接分组加载占位">
      {Array.from({ length: placeholderCount }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "flex min-w-0 animate-pulse items-center gap-2 rounded-md border border-border bg-background px-3 shadow-sm",
            compact && "h-8",
            list && "h-9",
            !compact && !list && "h-14",
          )}
        >
          <span className="h-4 w-4 shrink-0 rounded bg-muted" />
          <span className="min-w-0 flex-1">
            <span className="block h-3 w-3/4 rounded bg-muted" />
            {!compact ? <span className="mt-2 block h-2.5 w-1/2 rounded bg-muted" /> : null}
          </span>
          <span className="h-5 w-6 shrink-0 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

function LinkGroupCards({
  links,
  linkView,
  tagsByLinkId,
  allTags,
  onCreateTag,
  onBindTag,
  onDeleteBinding,
  onUpdateLink,
  onReorderLinks,
  activeBindingPopoverId,
  onOpenBindingPopover,
  onCloseBindingPopover,
  bindingPrefix,
  priorityTagId,
  unbindTagId,
}: {
  links: LinkRecord[];
  linkView: LinkView;
  tagsByLinkId: Map<Id, TagRecord[]>;
  allTags: TagRecord[];
  onCreateTag: (name: string, color: string) => Promise<TagRecord | null>;
  onBindTag: (linkId: Id, tagId: Id) => Promise<void>;
  onDeleteBinding: (linkId: Id, tagId: Id) => void;
  onUpdateLink: (linkId: Id, values: LinkEditValues) => Promise<void>;
  onReorderLinks: (orderedLinks: LinkRecord[]) => Promise<void>;
  activeBindingPopoverId: string | null;
  onOpenBindingPopover: (id: string) => void;
  onCloseBindingPopover: (id: string) => void;
  bindingPrefix: string;
  priorityTagId?: Id;
  unbindTagId?: Id;
}) {
  const [draggedLinkId, setDraggedLinkId] = useState<Id | null>(null);
  const [previewLinkIds, setPreviewLinkIds] = useState<Id[] | null>(null);
  const linkIds = useMemo(() => links.map((link) => link.id), [links]);
  const linksById = useMemo(() => new Map(links.map((link) => [link.id, link])), [links]);
  const visibleLinks = useMemo(() => {
    if (!previewLinkIds) return links;
    return previewLinkIds.map((linkId) => linksById.get(linkId)).filter((link): link is LinkRecord => Boolean(link));
  }, [links, linksById, previewLinkIds]);

  useEffect(() => {
    if (!draggedLinkId) setPreviewLinkIds(null);
  }, [draggedLinkId, linkIds]);

  const persistLinkOrder = (orderedIds: Id[]) => {
    const linksById = new Map(links.map((link) => [link.id, link]));
    const orderedLinks = orderedIds
      .map((linkId) => linksById.get(linkId))
      .filter((link): link is LinkRecord => Boolean(link));
    void onReorderLinks(orderedLinks).catch((error: unknown) => {
      console.error("[LinkTag] 保存链接排序失败", error);
    });
  };

  return (
    <div className={linkGroupLayoutClassName(linkView)}>
      {visibleLinks.map((link) => (
        <div
          key={link.id}
          className={cn("min-w-0 cursor-grab", draggedLinkId === link.id && "opacity-50")}
          draggable
          onDragStart={(event) => {
            event.stopPropagation();
            setDraggedLinkId(link.id);
            setPreviewLinkIds(linkIds);
            setElementDragImage(event);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", link.id);
          }}
          onDragEnd={(event) => {
            event.stopPropagation();
            setDraggedLinkId(null);
          }}
          onDragOver={(event) => {
            if (!draggedLinkId || draggedLinkId === link.id) return;
            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            const placement = getElementDragPlacement(event);
            setPreviewLinkIds((current) => {
              const sourceIds = current ?? linkIds;
              const orderedIds = moveId(sourceIds, draggedLinkId, link.id, placement);
              return orderedIds.every((id, index) => id === sourceIds[index]) ? current : orderedIds;
            });
          }}
          onDrop={(event) => {
            event.stopPropagation();
            event.preventDefault();
            if (!draggedLinkId) return;
            persistLinkOrder(previewLinkIds ?? linkIds);
            setDraggedLinkId(null);
            setPreviewLinkIds(null);
          }}
        >
          <LinkCard
            view={linkView}
            link={link}
            tags={tagsByLinkId.get(link.id) ?? []}
            allTags={allTags}
            onCreateTag={onCreateTag}
            onBindTag={onBindTag}
            onDeleteBinding={onDeleteBinding}
            onUpdateLink={onUpdateLink}
            bindingPopoverId={`${bindingPrefix}:${link.id}`}
            activeBindingPopoverId={activeBindingPopoverId}
            onOpenBindingPopover={onOpenBindingPopover}
            onCloseBindingPopover={onCloseBindingPopover}
            priorityTagId={priorityTagId}
            unbindTagId={unbindTagId}
            fluid
          />
        </div>
      ))}
    </div>
  );
}

function buildLinkLookups(linkData: AppLinkData, tagsById: Map<Id, TagRecord>) {
  const linkTagsByLinkId = groupLinkTagsByLinkId(linkData.linkTags);
  const tagsByLinkId = new Map<Id, TagRecord[]>();
  const tagNamesByLinkId = new Map<Id, string[]>();
  const tagIdsByLinkId = new Map<Id, Set<Id>>();

  for (const [linkId, bindings] of linkTagsByLinkId) {
    const linkTags = bindings.map((binding) => tagsById.get(binding.tagId)).filter(Boolean) as TagRecord[];
    tagsByLinkId.set(linkId, linkTags);
    tagNamesByLinkId.set(
      linkId,
      linkTags.map((tag) => tag.name),
    );
    tagIdsByLinkId.set(linkId, new Set(bindings.map((binding) => binding.tagId)));
  }

  return { tagsByLinkId, tagNamesByLinkId, tagIdsByLinkId };
}

function linkHasAnySelectedTag(linkId: Id, tagIdsByLinkId: Map<Id, Set<Id>>, selectedTagIds: Id[]) {
  if (selectedTagIds.length === 0) return true;
  const tagIds = tagIdsByLinkId.get(linkId);
  if (!tagIds) return false;
  return selectedTagIds.some((tagId) => tagIds.has(tagId));
}

function linkMatchesRelation(linkId: Id, relation: TagRelationRecord, tagIdsByLinkId: Map<Id, Set<Id>>) {
  const tagIds = tagIdsByLinkId.get(linkId);
  return Boolean(tagIds?.has(relation.sourceTagId) && tagIds.has(relation.targetTagId));
}

function useNearViewport<T extends Element>(enabled: boolean) {
  const ref = useRef<T | null>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNearViewport(true);
        observer.disconnect();
      },
      { root: null, rootMargin: "900px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (enabled) return;
    setNearViewport(false);
  }, [enabled]);

  return [ref, nearViewport] as const;
}
