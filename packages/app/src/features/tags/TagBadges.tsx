import { type CSSProperties, type ReactElement } from "react";

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, cn } from "@linktag/ui";

import { colorChoices } from "../../core/colors";
import type { Id, TagDisplayFormat, TagRecord, TagRelationRecord } from "../../types";

export const groupTagBadgeClassName = "whitespace-nowrap";
export const flowTagBadgeClassName = "linktag-flow-tag mr-1 inline whitespace-normal break-all align-middle";
export const bindableTagButtonClassName =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-transparent px-2 py-0.5 text-xs font-medium leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function readableTextColor(color: string) {
  const normalized = color.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#111827" : "#ffffff";
}

export function randomColor() {
  return colorChoices[Math.floor(Math.random() * colorChoices.length)];
}

export function tagStyle(color: string) {
  return {
    backgroundColor: color,
    borderColor: color,
    color: readableTextColor(color),
  };
}

export function darkenHexColor(color: string, ratio = 0.22) {
  const normalized = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return color;
  const darken = (channel: string) => Math.max(0, Math.round(Number.parseInt(channel, 16) * (1 - ratio)));
  const r = darken(normalized.slice(0, 2)).toString(16).padStart(2, "0");
  const g = darken(normalized.slice(2, 4)).toString(16).padStart(2, "0");
  const b = darken(normalized.slice(4, 6)).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

export function GroupPlainTagBadge({
  name,
  color,
  active = false,
  onClick,
  onEdit,
  onDelete,
}: {
  name: string;
  color: string;
  active?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const hasMenu = Boolean(onEdit || onDelete);
  const badge = (
    <span
      className={cn(
        "linktag-flow-tag mr-1 inline whitespace-normal break-all rounded-full px-2 py-0.5 align-middle text-xs font-medium leading-5 [overflow-wrap:anywhere]",
        (onClick || hasMenu) && "cursor-pointer outline-none hover:ring-1 hover:ring-ring",
        active && "ring-2 ring-ring",
      )}
      data-ui-name="分组关联标签"
      data-linktag-context-menu={hasMenu ? true : undefined}
      onContextMenu={(event) => {
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={
        onClick
          ? (event) => {
              event.stopPropagation();
              onClick();
            }
          : undefined
      }
      style={tagStyle(color)}
    >
      <span className="inline whitespace-normal break-all [overflow-wrap:anywhere]" data-ui-name="分组关联标签名称">
        {name}
      </span>
    </span>
  );
  if (!hasMenu) return badge;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{badge}</ContextMenuTrigger>
      <ContextMenuContent
        data-ui-name="标签右键菜单"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.stopPropagation()}
      >
        {onEdit ? (
          <ContextMenuItem
            data-ui-name="编辑标签名称"
            onSelect={(event) => {
              event.stopPropagation();
              onEdit();
            }}
          >
            编辑
          </ContextMenuItem>
        ) : null}
        {onDelete ? (
          <ContextMenuItem
            data-ui-name="删除标签"
            className="text-destructive focus:text-destructive"
            onSelect={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            删除
          </ContextMenuItem>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function GroupTagBadge({
  tag,
  active,
  onClick,
  onEdit,
  onDelete,
}: {
  tag: TagRecord;
  active?: boolean;
  onClick?: () => void;
  onEdit?: (tag: TagRecord) => void;
  onDelete?: (tagId: Id) => void;
}) {
  return (
    <GroupPlainTagBadge
      name={tag.name}
      color={tag.color}
      active={active}
      onClick={onClick}
      onEdit={onEdit ? () => onEdit(tag) : undefined}
      onDelete={onDelete ? () => onDelete(tag.id) : undefined}
    />
  );
}

export function GroupRelationBadge({
  relation,
  tag,
  format,
  activeTag = false,
  activeRelation = false,
  muted = false,
  onTagClick,
  onRelationClick,
  onTagEdit,
  onRelationDelete,
  onHoverChange,
}: {
  relation: TagRelationRecord;
  tag: TagRecord;
  format: TagDisplayFormat;
  activeTag?: boolean;
  activeRelation?: boolean;
  muted?: boolean;
  onTagClick?: (tagId: Id) => void;
  onRelationClick?: (relationId: Id) => void;
  onTagEdit?: (tag: TagRecord) => void;
  onRelationDelete?: (relationId: Id) => void;
  onHoverChange?: (hovered: boolean) => void;
}) {
  const relationName = relation.name || "关联";
  const relationColor = darkenHexColor(tag.color);
  const hasMenu = Boolean(onTagEdit || onRelationDelete);

  const wrapMenu = (badge: ReactElement) => {
    if (!hasMenu) return badge;
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{badge}</ContextMenuTrigger>
        <ContextMenuContent
          data-ui-name="分组关联标签右键菜单"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.stopPropagation()}
        >
          {onTagEdit ? (
            <ContextMenuItem
              data-ui-name="编辑标签名称"
              onSelect={(event) => {
                event.stopPropagation();
                onTagEdit(tag);
              }}
            >
              编辑
            </ContextMenuItem>
          ) : null}
          {onRelationDelete ? (
            <ContextMenuItem
              data-ui-name="解除标签关系"
              className="text-destructive focus:text-destructive"
              onSelect={(event) => {
                event.stopPropagation();
                onRelationDelete(relation.id);
              }}
            >
              解除关系
            </ContextMenuItem>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  if (format === "tag") {
    const badge = (
      <span
        className={cn(
          "linktag-flow-tag mr-1 inline whitespace-normal break-all rounded-full px-2 py-0.5 align-middle text-xs font-medium leading-5 transition-[filter,opacity,box-shadow] [overflow-wrap:anywhere]",
          (onTagClick || hasMenu) && "cursor-pointer outline-none hover:ring-1 hover:ring-ring",
          (activeTag || activeRelation) && "ring-2 ring-ring",
          muted && "opacity-40 grayscale",
        )}
        data-ui-name="分组关联标签"
        data-linktag-context-menu={hasMenu ? true : undefined}
        onContextMenu={(event) => {
          event.stopPropagation();
        }}
        onPointerEnter={() => onHoverChange?.(true)}
        onPointerLeave={() => onHoverChange?.(false)}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={
          onTagClick
            ? (event) => {
                event.stopPropagation();
                onTagClick(tag.id);
              }
            : undefined
        }
        style={tagStyle(tag.color)}
      >
        <span className="inline whitespace-normal break-all [overflow-wrap:anywhere]" data-ui-name="分组关联标签名称">
          {tag.name}
        </span>
      </span>
    );
    return wrapMenu(badge);
  }

  const tagLabel = (
    <span
      className={cn("inline whitespace-normal break-all [overflow-wrap:anywhere]", onTagClick && "cursor-pointer")}
      data-ui-name="分组关联标签名称"
      onClick={
        onTagClick
          ? (event) => {
              event.stopPropagation();
              onTagClick(tag.id);
            }
          : undefined
      }
    >
      {tag.name}
    </span>
  );
  const relationLabel = (
    <span
      className={cn(
        "inline whitespace-normal break-all font-semibold [overflow-wrap:anywhere]",
        format !== "relation" && "linktag-relation-name",
        onRelationClick && "cursor-pointer",
      )}
      data-ui-name="分组标签关系名称"
      onClick={
        onRelationClick
          ? (event) => {
              event.stopPropagation();
              onRelationClick(relation.id);
            }
          : undefined
      }
      style={format !== "relation" ? ({ "--linktag-relation-color": relationColor } as CSSProperties) : undefined}
    >
      {relationName}
    </span>
  );

  const badge = (
    <span
      className={cn(
        "linktag-flow-tag mr-1 inline whitespace-normal break-all px-2 py-0.5 align-middle text-xs font-medium leading-5 transition-[filter,opacity,box-shadow] [overflow-wrap:anywhere]",
        (activeTag || activeRelation) && "ring-2 ring-ring",
        muted && "opacity-40 grayscale",
        format === "relation" && "linktag-flow-tag-arrow-both",
        format === "tag-relation" && "linktag-flow-tag-arrow-end",
        format === "relation-tag" && "linktag-flow-tag-arrow-start",
      )}
      data-ui-name="分组关联标签"
      data-linktag-context-menu={hasMenu ? true : undefined}
      onContextMenu={(event) => {
        event.stopPropagation();
      }}
      onPointerEnter={() => onHoverChange?.(true)}
      onPointerLeave={() => onHoverChange?.(false)}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      style={{ ...tagStyle(tag.color), "--linktag-tag-color": tag.color } as CSSProperties}
    >
      {format === "relation" ? relationLabel : null}
      {format === "tag-relation" ? (
        <>
          {tagLabel}
          <span aria-hidden="true"> </span>
          {relationLabel}
        </>
      ) : null}
      {format === "relation-tag" ? (
        <>
          {relationLabel}
          <span aria-hidden="true"> </span>
          {tagLabel}
        </>
      ) : null}
    </span>
  );
  return wrapMenu(badge);
}
