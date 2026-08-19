import { useCallback, useEffect, useRef, useState } from "react";

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, cn } from "@linktag/ui";

import { Favicon } from "../../components/Favicon";
import { isContextMenuLayerTarget, isDialogLayerTarget } from "../../core/layer-events";
import { getDomain } from "../../core/search";
import { LinkEditDialog, type LinkEditValues } from "./LinkEditDialog";
import { TabBindingPanel } from "../tags/TabBindingPanel";
import type { Id, LinkRecord, LinkView, TagRecord } from "../../types";

export function LinkCard({
  link,
  faviconSrc,
  view,
  tags = [],
  allTags = [],
  onCreateTag,
  onBindTag,
  onDeleteBinding,
  onBeforeBind,
  onUpdateLink,
  bindingPopoverId,
  activeBindingPopoverId,
  onOpenBindingPopover,
  onCloseBindingPopover,
  priorityTagId,
  unbindTagId,
  hideDomain = false,
  fluid = false,
  openEditOnClick = false,
}: {
  link: LinkRecord;
  faviconSrc?: string;
  view: LinkView;
  tags?: TagRecord[];
  allTags?: TagRecord[];
  onCreateTag?: (name: string, color: string) => Promise<TagRecord | null>;
  onBindTag?: (linkId: Id, tagId: Id) => Promise<void>;
  onDeleteBinding?: (linkId: Id, tagId: Id) => void;
  onBeforeBind?: () => Promise<void>;
  onUpdateLink?: (linkId: Id, values: LinkEditValues) => Promise<void>;
  bindingPopoverId?: string;
  activeBindingPopoverId?: string | null;
  onOpenBindingPopover?: (id: string) => void;
  onCloseBindingPopover?: (id: string) => void;
  priorityTagId?: Id;
  unbindTagId?: Id;
  hideDomain?: boolean;
  fluid?: boolean;
  openEditOnClick?: boolean;
}) {
  const compact = view === "compact";
  const list = view === "list";
  const canBind = Boolean(onCreateTag && onBindTag && onDeleteBinding);
  const popoverId = bindingPopoverId ?? `link:${link.id}`;
  const popoverOpen = activeBindingPopoverId === popoverId;
  const detailText = link.note?.trim() || getDomain(link.url);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelPosition, setPanelPosition] = useState({ left: 0, top: 0 });
  const [editingLink, setEditingLink] = useState<LinkRecord | null>(null);
  const updatePanelPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelWidth = Math.min(352, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - panelWidth - 12));
    const top = Math.min(rect.bottom + 8, Math.max(12, window.innerHeight - 220));
    setPanelPosition({ left, top });
  }, []);
  const openThisPopover = () => {
    updatePanelPosition();
    if (!popoverOpen) onOpenBindingPopover?.(popoverId);
  };
  const openEditDialog = useCallback(async () => {
    if (!onUpdateLink) return;
    if (onBeforeBind) await onBeforeBind();
    setEditingLink(link);
  }, [link, onBeforeBind, onUpdateLink]);
  useEffect(() => {
    if (!popoverOpen) return;
    updatePanelPosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (isDialogLayerTarget(target) || isContextMenuLayerTarget(target)) return;
      if (target instanceof Node && (triggerRef.current?.contains(target) || panelRef.current?.contains(target)))
        return;
      onCloseBindingPopover?.(popoverId);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key === "Escape") onCloseBindingPopover?.(popoverId);
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [onCloseBindingPopover, popoverId, popoverOpen, updatePanelPosition]);

  const content = (
    <>
      <Favicon src={faviconSrc} url={link.url} title={link.title} />
      <span className="min-w-0 flex-1">
        <span className="block overflow-hidden whitespace-nowrap font-medium leading-5">{link.title}</span>
        {!compact && !hideDomain ? (
          <span className="block overflow-hidden whitespace-nowrap text-xs text-muted-foreground">{detailText}</span>
        ) : null}
      </span>
    </>
  );
  const card = (
    <div
      data-ui-name="链接卡片"
      data-linktag-context-menu
      title={link.title}
      className={cn(
        "group flex min-w-0 items-center gap-2 rounded-md border border-border bg-background text-sm text-foreground shadow-sm outline-none transition-colors hover:border-ring focus-visible:ring-2 focus-visible:ring-ring",
        compact && (fluid ? "h-8 w-full px-2" : "h-8 w-44 px-2"),
        list && "h-9 w-full px-2",
        !compact && !list && (fluid ? "h-14 w-full px-3" : "h-14 w-52 px-3"),
      )}
    >
      {openEditOnClick && onUpdateLink ? (
        <button
          type="button"
          className="flex h-full min-w-0 flex-1 items-center gap-2 border-0 bg-transparent p-0 text-left text-foreground outline-none [font:inherit]"
          draggable={false}
          onClick={() => void openEditDialog()}
        >
          {content}
        </button>
      ) : (
        <a
          href={link.url}
          className="flex h-full min-w-0 flex-1 items-center gap-2 text-foreground outline-none"
          draggable={false}
        >
          {content}
        </a>
      )}
      {canBind ? (
        <>
          <span
            ref={triggerRef}
            data-ui-name="链接绑定数量按钮"
            role="button"
            tabIndex={0}
            title="绑定标签"
            className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-semibold hover:bg-accent"
            onFocus={openThisPopover}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openThisPopover();
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              openThisPopover();
            }}
          >
            {tags.length}
          </span>
          {popoverOpen ? (
            <div
              ref={panelRef}
              className="fixed z-50 w-[22rem] max-w-[calc(100vw-24px)] rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none"
              data-ui-name="链接绑定标签浮窗"
              style={{ left: panelPosition.left, top: panelPosition.top }}
            >
              <TabBindingPanel
                tab={{
                  id: link.id,
                  linkId: link.id,
                  windowId: "",
                  title: link.title,
                  url: link.url,
                }}
                tags={tags}
                allTags={allTags}
                onCreateTag={onCreateTag!}
                onBindTag={onBindTag!}
                onDeleteBinding={onDeleteBinding!}
                onBeforeBind={onBeforeBind}
                priorityTagId={priorityTagId}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );

  return (
    <>
      {onUpdateLink ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
          <ContextMenuContent data-ui-name="链接卡片菜单">
            <ContextMenuItem data-ui-name="编辑链接" onSelect={() => void openEditDialog()}>
              编辑
            </ContextMenuItem>
            {unbindTagId && onDeleteBinding ? (
              <ContextMenuItem
                className="text-destructive focus:text-destructive"
                data-ui-name="删除链接标签绑定"
                onSelect={() => onDeleteBinding(link.id, unbindTagId)}
              >
                删除
              </ContextMenuItem>
            ) : null}
          </ContextMenuContent>
        </ContextMenu>
      ) : (
        card
      )}
      {onUpdateLink ? (
        <LinkEditDialog
          link={editingLink}
          tags={tags}
          allTags={allTags}
          onCreateTag={onCreateTag}
          onBindTag={onBindTag}
          onDeleteBinding={onDeleteBinding}
          onBeforeBind={async (linkId, values) => {
            if (onUpdateLink) await onUpdateLink(linkId, values);
          }}
          priorityTagId={priorityTagId}
          onOpenChange={(open) => {
            if (!open) setEditingLink(null);
          }}
          onSave={async (linkId, values) => {
            if (onUpdateLink) await onUpdateLink(linkId, values);
            setEditingLink((current) => (current ? { ...current, ...values } : current));
          }}
        />
      ) : null}
    </>
  );
}
