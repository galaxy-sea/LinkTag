import {
  Badge,
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  Input,
  cn,
} from "@linktag/ui";
import { type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";

import { ColorPicker } from "../../components/ColorPicker";
import { bindableTagButtonClassName, groupTagBadgeClassName, randomColor, tagStyle } from "./TagBadges";
import type { BrowserTab, Id, TagRecord } from "../../types";

function includesQuery(values: Array<string | undefined>, query: string) {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(q));
}

export function TabBindingPanel({
  tab,
  tags,
  allTags,
  onCreateTag,
  onBindTag,
  onDeleteBinding,
  onBeforeBind,
  priorityTagId,
}: {
  tab: BrowserTab;
  tags: TagRecord[];
  allTags: TagRecord[];
  onCreateTag: (name: string, color: string) => Promise<TagRecord | null>;
  onBindTag: (linkId: Id, tagId: Id) => Promise<void>;
  onDeleteBinding: (linkId: Id, tagId: Id) => void;
  onBeforeBind?: () => Promise<void>;
  priorityTagId?: Id;
}) {
  const boundIds = new Set(tags.map((tag) => tag.id));
  const sortedTags = priorityTagId
    ? [...tags].sort((first, second) => Number(second.id === priorityTagId) - Number(first.id === priorityTagId))
    : tags;
  return (
    <div className="grid gap-3" data-ui-name="链接绑定标签面板">
      <div className="flex flex-wrap gap-1.5" data-ui-name="已绑定标签列表">
        {sortedTags.length ? (
          sortedTags.map((tag) => (
            <ContextMenu key={tag.id}>
              <ContextMenuTrigger asChild>
                <Badge
                  className={cn(groupTagBadgeClassName, "cursor-default")}
                  data-ui-name="已绑定标签"
                  data-linktag-context-menu
                  style={tagStyle(tag.color)}
                >
                  {tag.name}
                </Badge>
              </ContextMenuTrigger>
              <ContextMenuContent data-ui-name="已绑定标签菜单">
                <ContextMenuItem
                  data-ui-name="删除绑定标签"
                  className="text-destructive"
                  onSelect={() => onDeleteBinding(tab.linkId, tag.id)}
                >
                  删除
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">未绑定标签</span>
        )}
      </div>
      <BindTagForm
        allTags={allTags.filter((tag) => !boundIds.has(tag.id))}
        onBind={async (tagId) => {
          await onBeforeBind?.();
          await onBindTag(tab.linkId, tagId);
        }}
        onCreate={async (name, color) => {
          const tag = await onCreateTag(name, color);
          if (tag) {
            await onBeforeBind?.();
            await onBindTag(tab.linkId, tag.id);
          }
        }}
      />
    </div>
  );
}

function BindTagForm({
  allTags,
  onBind,
  onCreate,
}: {
  allTags: TagRecord[];
  onBind: (tagId: Id) => Promise<void>;
  onCreate: (name: string, color: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(randomColor);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composingRef = useRef(false);
  const matches = allTags.filter((tag) => includesQuery([tag.name], name));
  const exact = allTags.find((tag) => tag.name.toLowerCase() === name.trim().toLowerCase());

  const focusInput = () => {
    inputRef.current?.focus({ preventScroll: true });
    inputRef.current?.select();
  };

  const refocusInput = () => {
    window.requestAnimationFrame(focusInput);
    window.setTimeout(focusInput, 60);
    window.setTimeout(focusInput, 180);
  };

  const finishSubmit = () => {
    setName("");
    setColor(randomColor());
    refocusInput();
  };

  const bindExistingTag = async (tagId: Id) => {
    await onBind(tagId);
    finishSubmit();
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (exact) void bindExistingTag(exact.id);
    else {
      void onCreate(trimmed, color).then(finishSubmit);
    }
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(focusInput);
    const timer = window.setTimeout(focusInput, 60);
    const lateTimer = window.setTimeout(focusInput, 180);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.clearTimeout(lateTimer);
    };
  }, []);

  return (
    <div className="grid gap-2" data-ui-name="搜索或增加标签表单">
      <Input
        data-ui-name="搜索或增加标签输入框"
        ref={inputRef}
        value={name}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
        onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            return;
          }
          if (event.nativeEvent.isComposing || composingRef.current) {
            return;
          }
          if (event.key !== "Enter") return;
          event.preventDefault();
          submit();
        }}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        autoFocus
        placeholder="搜索或增加标签"
      />
      <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1" data-ui-name="可绑定标签列表">
        {matches.map((tag) => (
          <span
            key={tag.id}
            data-ui-name="可绑定标签"
            role="button"
            tabIndex={0}
            className={bindableTagButtonClassName}
            style={tagStyle(tag.color)}
            onClick={() => void bindExistingTag(tag.id)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              void bindExistingTag(tag.id);
            }}
          >
            <span>{tag.name}</span>
          </span>
        ))}
      </div>
      {name.trim() && !exact ? (
        <div className="flex items-center gap-2">
          <ColorPicker value={color} onChange={setColor} compact />
          <Button data-ui-name="新建并绑定按钮" size="sm" onClick={submit}>
            新建并绑定
          </Button>
        </div>
      ) : null}
    </div>
  );
}
