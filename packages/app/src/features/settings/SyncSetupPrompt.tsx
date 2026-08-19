import { useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Button,
} from "@linktag/ui";

export function SyncSetupPrompt({
  open,
  onOpenChange,
  onConfigure,
  onDismissPermanently,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigure: () => void;
  onDismissPermanently: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  const cancel = () => {
    if (dismissed) onDismissPermanently();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-ui-name="同步配置提示弹窗">
        <AlertDialogTitle className="text-base font-semibold">数据仅保存在本地</AlertDialogTitle>
        <AlertDialogDescription className="text-sm text-muted-foreground">
          当前没有同步配置。数据只会保存在这个浏览器本地，浏览器数据被清理或设备丢失后就无法恢复。配置同步后，可以跨电脑或浏览器使用。
        </AlertDialogDescription>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground" data-ui-name="同步配置不再提示设置">
            <input
              checked={dismissed}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
              data-ui-name="同步配置不再提示勾选框"
              type="checkbox"
              onChange={(event) => setDismissed(event.target.checked)}
            />
            不再提示
          </label>
          <div className="flex items-center gap-2">
            <AlertDialogCancel asChild>
              <Button data-ui-name="同步配置提示取消按钮" variant="outline" onClick={cancel}>
                取消
              </Button>
            </AlertDialogCancel>
            <Button
              data-ui-name="同步配置去配置按钮"
              onClick={() => {
                onOpenChange(false);
                onConfigure();
              }}
            >
              去配置
            </Button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
