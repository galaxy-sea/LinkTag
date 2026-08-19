import { RefreshCw } from "lucide-react";
import { type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";

import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Label,
  cn,
} from "@linktag/ui";

import { tagRelationPairKey, type PendingRelationEndpoint } from "./relation-utils";
import { groupTagBadgeClassName, tagStyle } from "./TagBadges";
import type { TagRecord } from "../../types";

export function RelationDialog({
  open,
  title,
  description,
  endpoints,
  initialName,
  onOpenChange,
  onSave,
  onSaveMany,
  onReverseEndpoint,
  onReverseAllEndpoints,
}: {
  open: boolean;
  title: string;
  description?: string;
  endpoints?: PendingRelationEndpoint[];
  initialName: string;
  onOpenChange: (open: boolean) => void;
  onSave?: (name: string) => void | Promise<void>;
  onSaveMany?: (names: string[]) => void | Promise<void>;
  onReverseEndpoint?: (index: number) => void;
  onReverseAllEndpoints?: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [names, setNames] = useState<string[]>([]);
  const firstBatchInputRef = useRef<HTMLInputElement | null>(null);
  const endpointRows = (endpoints ?? []).filter(
    (endpoint): endpoint is PendingRelationEndpoint & { source: TagRecord; target: TagRecord } =>
      Boolean(endpoint.source && endpoint.target),
  );
  const isBatch = endpointRows.length > 0;
  useEffect(() => setName(initialName), [initialName, open]);
  useEffect(() => {
    if (open && isBatch) setNames(endpointRows.map(() => ""));
  }, [endpointRows.length, isBatch, open]);
  useEffect(() => {
    if (!open || !isBatch) return;
    const focusInput = () => {
      firstBatchInputRef.current?.focus({ preventScroll: true });
      firstBatchInputRef.current?.select();
    };
    const frame = window.requestAnimationFrame(focusInput);
    const timer = window.setTimeout(focusInput, 60);
    const lateTimer = window.setTimeout(focusInput, 180);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.clearTimeout(lateTimer);
    };
  }, [endpointRows.length, isBatch, open]);
  const saveSingle = () => {
    if (onSave) void onSave(name);
  };
  const saveBatch = () => {
    if (onSaveMany) void onSaveMany(names);
  };
  const input = (
    <Input
      data-ui-name="关系名称输入框"
      id="relation-name"
      value={name}
      onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
      onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
        event.preventDefault();
        saveSingle();
      }}
      autoFocus
      placeholder="关系名称"
    />
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-ui-name="关系弹窗">
        <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        {description ? (
          <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>
        ) : null}
        {isBatch ? (
          <div className="grid max-h-[min(52vh,420px)] gap-2 overflow-auto pr-1" data-ui-name="新增标签关系列表">
            <div
              className="grid grid-cols-[minmax(0,auto)_2rem_minmax(9rem,1fr)_auto_minmax(0,auto)] items-center gap-2 px-1 text-xs font-medium text-muted-foreground"
              data-ui-name="新增标签关系表头"
            >
              <span data-ui-name="源标签列标题">源标签</span>
              <Button
                data-ui-name="反转全部标签关系方向"
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 justify-self-center px-1.5 text-xs"
                onClick={() => onReverseAllEndpoints?.()}
                aria-label="反转全部关系方向"
                title="反转全部关系方向"
              >
                <span>方向</span>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <span data-ui-name="关系名称列标题">关系名称</span>
              <span aria-hidden="true" />
              <span data-ui-name="目标标签列标题">目标标签</span>
            </div>
            {endpointRows.map((endpoint, index) => (
              <div
                key={tagRelationPairKey(endpoint.sourceTagId, endpoint.targetTagId)}
                className="grid min-w-0 grid-cols-[minmax(0,auto)_2rem_minmax(9rem,1fr)_auto_minmax(0,auto)] items-center gap-2"
                data-ui-name="新增标签关系输入行"
              >
                <Badge
                  className={cn(groupTagBadgeClassName, "shrink-0")}
                  data-ui-name="源标签"
                  style={tagStyle(endpoint.source.color)}
                >
                  {endpoint.source.name}
                </Badge>
                <Button
                  data-ui-name="反转标签关系方向"
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onReverseEndpoint?.(index)}
                  aria-label="反转关系方向"
                  title="反转关系方向"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`relation-name-${index}`} className="sr-only">
                    关系名称
                  </Label>
                  <Input
                    ref={index === 0 ? firstBatchInputRef : undefined}
                    data-ui-name="关系名称输入框"
                    id={`relation-name-${index}`}
                    value={names[index] ?? ""}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setNames((current) =>
                        current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)),
                      )
                    }
                    onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                      if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                      event.preventDefault();
                      saveBatch();
                    }}
                    autoFocus={index === 0}
                    placeholder="关系名称"
                  />
                </div>
                <span className="shrink-0 text-muted-foreground">-</span>
                <Badge
                  className={cn(groupTagBadgeClassName, "shrink-0")}
                  data-ui-name="目标标签"
                  style={tagStyle(endpoint.target.color)}
                >
                  {endpoint.target.name}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="relation-name">关系名称</Label>
            {input}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button data-ui-name="关系弹窗关闭按钮" variant="outline">
              {isBatch ? "跳过" : "取消"}
            </Button>
          </DialogClose>
          <Button data-ui-name="关系弹窗保存按钮" onClick={isBatch ? saveBatch : saveSingle}>
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
