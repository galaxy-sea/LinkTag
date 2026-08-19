import { type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useState } from "react";

import { Dialog, DialogContent, DialogTitle, Input, Label, Textarea } from "@linktag/ui";

import { TabBindingPanel } from "../tags/TabBindingPanel";
import type { Id, LinkRecord, TagRecord } from "../../types";

export type LinkEditValues = {
  title: string;
  url: string;
  note: string;
};

export function LinkEditDialog({
  link,
  titleText = "编辑链接",
  contentClassName,
  overlayClassName,
  headerContent,
  autoSave = true,
  tags = [],
  allTags = [],
  onCreateTag,
  onBindTag,
  onDeleteBinding,
  onBeforeBind,
  priorityTagId,
  onOpenChange,
  onSave,
}: {
  link: LinkRecord | null;
  titleText?: string;
  contentClassName?: string;
  overlayClassName?: string;
  headerContent?: ReactNode;
  autoSave?: boolean;
  tags?: TagRecord[];
  allTags?: TagRecord[];
  onCreateTag?: (name: string, color: string) => Promise<TagRecord | null>;
  onBindTag?: (linkId: Id, tagId: Id) => Promise<void>;
  onDeleteBinding?: (linkId: Id, tagId: Id) => void;
  onBeforeBind?: (linkId: Id, values: LinkEditValues) => Promise<void>;
  priorityTagId?: Id;
  onOpenChange: (open: boolean) => void;
  onSave: (linkId: Id, values: LinkEditValues) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!link) return;
    setTitle(link.title);
    setUrl(link.url);
    setNote(link.note ?? "");
  }, [link]);

  const currentValues = () => ({
    title: title.trim() || link?.title || "",
    url: url.trim() || link?.url || "",
    note,
  });
  const persist = () => {
    if (!autoSave || !link) return;
    const values = currentValues();
    if (!values.title.trim() || !values.url.trim()) return;
    if (values.title === link.title && values.url === link.url && values.note === (link.note ?? "")) return;
    void onSave(link.id, values);
  };

  return (
    <Dialog open={Boolean(link)} onOpenChange={onOpenChange}>
      <DialogContent className={contentClassName} overlayClassName={overlayClassName} data-ui-name="编辑链接弹窗">
        <DialogTitle className="text-base font-semibold">{titleText}</DialogTitle>
        {headerContent}
        <div className="grid gap-2">
          <Label htmlFor="link-title">标题</Label>
          <Input
            data-ui-name="编辑链接标题输入框"
            id="link-title"
            value={title}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)}
            onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              event.preventDefault();
              persist();
            }}
            onBlur={persist}
            autoFocus
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="link-url">URL</Label>
          <Input
            data-ui-name="编辑链接URL输入框"
            id="link-url"
            value={url}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setUrl(event.target.value)}
            onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              event.preventDefault();
              persist();
            }}
            onBlur={persist}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="link-note">备注</Label>
          <Textarea
            data-ui-name="编辑链接备注输入框"
            id="link-note"
            value={note}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value)}
            onBlur={persist}
          />
        </div>
        {link && onCreateTag && onBindTag && onDeleteBinding ? (
          <div className="grid gap-2" data-ui-name="编辑链接标签区域">
            <Label>标签</Label>
            <div
              className="rounded-md border border-border bg-popover p-3 shadow-panel"
              data-ui-name="编辑链接绑定标签浮窗内容"
            >
              <TabBindingPanel
                tab={{
                  id: link.id,
                  linkId: link.id,
                  windowId: "",
                  title: title.trim() || link.title,
                  url: url.trim() || link.url,
                }}
                tags={tags}
                allTags={allTags}
                onCreateTag={onCreateTag}
                onBindTag={onBindTag}
                onDeleteBinding={onDeleteBinding}
                onBeforeBind={onBeforeBind ? () => onBeforeBind(link.id, currentValues()) : undefined}
                priorityTagId={priorityTagId}
              />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
