import { CirclePlus } from "lucide-react";
import { type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, useState } from "react";

import { Button, Input, Popover, PopoverContent, PopoverTrigger } from "@linktag/ui";

import { ColorPicker } from "../../components/ColorPicker";
import { randomColor } from "./TagBadges";
import type { TagRecord } from "../../types";

export function TagComposer({ onCreate }: { onCreate: (name: string, color: string) => Promise<TagRecord | null> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(randomColor);
  const submit = () => {
    if (!name.trim()) return;
    void onCreate(name, color).then(() => {
      setName("");
      setColor(randomColor());
      setOpen(false);
    });
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button data-ui-name="新增标签按钮" variant="outline" size="sm">
          <CirclePlus className="h-4 w-4" />
          标签
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" data-ui-name="新增标签浮层">
        <div className="grid gap-3" data-ui-name="新增标签表单">
          <Input
            data-ui-name="新增标签输入框"
            value={name}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
            onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              event.preventDefault();
              submit();
            }}
            autoFocus
            placeholder="搜索或增加标签"
          />
          <ColorPicker value={color} onChange={setColor} />
          <Button data-ui-name="新建标签提交按钮" disabled={!name.trim()} onClick={submit}>
            新建标签
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
