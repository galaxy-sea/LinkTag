import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@linktag/ui";

import { GroupPlainTagBadge } from "../tags/TagBadges";

function isInteractiveTitleTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("[data-linktag-context-menu]"));
}

export function GroupShell({
  title,
  titleNode,
  titleMeta,
  collapsed,
  onToggle,
  children,
  accentColor,
  titleBadgeActive = false,
  onTitleBadgeClick,
  meta,
  variant = "tag",
  edgeToEdge = false,
}: {
  title: string;
  titleNode?: ReactNode;
  titleMeta?: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
  accentColor?: string;
  titleBadgeActive?: boolean;
  onTitleBadgeClick?: () => void;
  meta?: ReactNode;
  variant?: "window" | "tag";
  edgeToEdge?: boolean;
}) {
  const toggleIcon = collapsed ? (
    <ChevronRight className="h-4 w-4 shrink-0" />
  ) : (
    <ChevronDown className="h-4 w-4 shrink-0" />
  );

  return (
    <section
      className={cn(
        "border-border",
        variant === "window"
          ? cn("border-0 bg-window-group-surface", edgeToEdge ? "rounded-none" : "rounded-md")
          : "rounded-none border-0 bg-card-surface",
      )}
      data-ui-name="分组"
    >
      <div
        className="grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)] items-center px-3 text-left"
        data-ui-name="分组标题"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={(event) => {
          if (isInteractiveTitleTarget(event.target)) return;
          onToggle();
        }}
        onKeyDown={(event) => {
          if (isInteractiveTitleTarget(event.target)) return;
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onToggle();
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          {toggleIcon}
          {titleNode ? (
            <span data-ui-name="分组名称">{titleNode}</span>
          ) : accentColor ? (
            <GroupPlainTagBadge
              name={title}
              color={accentColor}
              active={titleBadgeActive}
              onClick={onTitleBadgeClick}
            />
          ) : (
            <span className="min-w-0 max-w-52 truncate text-sm font-semibold" data-ui-name="分组名称">
              {title}
            </span>
          )}
          {titleMeta}
        </span>
        {meta ? (
          <span
            className="ml-3 block min-w-0 border-l border-border/80 pl-3 text-left [text-align-last:left]"
            data-ui-name="分组关联标签区"
          >
            {meta}
          </span>
        ) : (
          <span />
        )}
      </div>
      {!collapsed ? <div className="px-3 py-3">{children}</div> : null}
    </section>
  );
}

export function GroupLinkCount({ count, title, onOpen }: { count: number | null; title: string; onOpen?: () => void }) {
  const clickable = Boolean(onOpen && count !== null && count > 0);
  return (
    <span
      className={cn(
        "mr-1 inline-flex h-5 items-center rounded-full bg-secondary px-2 align-middle text-xs font-semibold leading-5 text-secondary-foreground",
        clickable && "cursor-pointer outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
      )}
      data-ui-name="分组当前数量"
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      title={clickable ? "打开分组链接" : undefined}
      onClick={
        clickable
          ? (event) => {
              event.stopPropagation();
              onOpen?.();
            }
          : undefined
      }
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              onOpen?.();
            }
          : undefined
      }
    >
      {count ?? "..."}
    </span>
  );
}
