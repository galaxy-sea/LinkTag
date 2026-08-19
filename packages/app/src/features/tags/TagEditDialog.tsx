import { type ChangeEvent, useEffect, useState } from "react";

import { Button, Dialog, DialogClose, DialogContent, DialogTitle, Input, Label } from "@linktag/ui";

import { ColorPicker } from "../../components/ColorPicker";
import { randomColor } from "./TagBadges";
import type { Id, TagRecord } from "../../types";

export function TagEditDialog({
  tag,
  onOpenChange,
  onSave,
}: {
  tag: TagRecord | null;
  onOpenChange: (open: boolean) => void;
  onSave: (tagId: Id, name: string, color: string, sort: number) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(randomColor);
  const [sort, setSort] = useState("0");
  useEffect(() => {
    if (tag) {
      setName(tag.name);
      setColor(tag.color);
      setSort(String(tag.sort ?? 0));
    }
  }, [tag]);
  return (
    <Dialog open={Boolean(tag)} onOpenChange={onOpenChange}>
      <DialogContent data-ui-name="编辑标签弹窗">
        <DialogTitle className="text-base font-semibold">编辑标签</DialogTitle>
        <div className="grid gap-2">
          <Label htmlFor="tag-name">名称</Label>
          <Input
            data-ui-name="编辑标签名称输入框"
            id="tag-name"
            value={name}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
            autoFocus
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tag-sort">排序</Label>
          <Input
            data-ui-name="编辑标签排序输入框"
            id="tag-sort"
            type="number"
            value={sort}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSort(event.target.value)}
          />
        </div>
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button data-ui-name="编辑标签取消按钮" variant="outline">
              取消
            </Button>
          </DialogClose>
          <Button
            data-ui-name="编辑标签保存按钮"
            disabled={!name.trim()}
            onClick={() => tag && void onSave(tag.id, name, color, Number.parseFloat(sort) || 0)}
          >
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
