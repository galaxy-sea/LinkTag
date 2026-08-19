import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@linktag/ui";
import { useLiveQuery } from "dexie-react-hooks";

import type { BrowserBookmarkImportData } from "../../backup/bookmark-import";
import type { BackupConflict, BackupPayload } from "../../backup/backup";
import { readCollections } from "../../db";
import type { BackupProvider, Id } from "../../types";
import type { BackupStatus, ImportMode, InvalidTokenConfirm, MissingGistConfirm } from "./useBackupController";

export function BackupConfirmDialogs({
  restoreConfirmOpen,
  onRestoreConfirmOpenChange,
  onRestore,
  importPayload,
  onImportPayloadClear,
  onImportJson,
  importBookmarkData,
  importBookmarkSourceName,
  importBookmarkCollectionId,
  onImportBookmarkCollectionChange,
  onImportBookmarkDataClear,
  onImportBrowserBookmarks,
  backupConflict,
  missingGistConfirm,
  onMissingGistConfirmChange,
  onCreateReplacementGist,
  invalidTokenConfirm,
  onInvalidTokenConfirmChange,
  onChangeRemoteToken,
  backupStatus,
  onUseRemoteBackup,
  onUseLocalBackup,
}: {
  restoreConfirmOpen: boolean;
  onRestoreConfirmOpenChange: (open: boolean) => void;
  onRestore: () => void;
  importPayload: BackupPayload | null;
  onImportPayloadClear: () => void;
  onImportJson: (mode: ImportMode) => void;
  importBookmarkData: BrowserBookmarkImportData | null;
  importBookmarkSourceName: string;
  importBookmarkCollectionId: Id | null;
  onImportBookmarkCollectionChange: (collectionId: Id | null) => void;
  onImportBookmarkDataClear: () => void;
  onImportBrowserBookmarks: (mode: ImportMode) => void;
  backupConflict: BackupConflict;
  missingGistConfirm: MissingGistConfirm | null;
  onMissingGistConfirmChange: (target: MissingGistConfirm | null) => void;
  onCreateReplacementGist: () => void;
  invalidTokenConfirm: InvalidTokenConfirm | null;
  onInvalidTokenConfirmChange: (target: InvalidTokenConfirm | null) => void;
  onChangeRemoteToken: (provider: BackupProvider) => void;
  backupStatus: BackupStatus;
  onUseRemoteBackup: () => void;
  onUseLocalBackup: () => void;
}) {
  const collections = useLiveQuery(readCollections, []) ?? [];
  const canImportBookmarks = Boolean(importBookmarkCollectionId);

  return (
    <>
      <AlertDialog open={restoreConfirmOpen} onOpenChange={onRestoreConfirmOpenChange}>
        <AlertDialogContent data-ui-name="远程拉取确认弹窗">
          <AlertDialogTitle className="text-base font-semibold">确认拉取远程</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            拉取远程会用远程快照覆盖本地 Collection、链接、标签、绑定和标签关系。
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel asChild>
              <Button data-ui-name="远程拉取取消按钮" variant="outline">
                取消
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                data-ui-name="确认远程拉取按钮"
                variant="danger"
                onClick={() => {
                  onRestoreConfirmOpenChange(false);
                  onRestore();
                }}
              >
                拉取远程
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(importPayload)} onOpenChange={(open) => !open && onImportPayloadClear()}>
        <AlertDialogContent data-ui-name="导入JSON确认弹窗">
          <AlertDialogTitle className="text-base font-semibold">确认导入</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            可以追加到当前数据，也可以用 JSON 文件内容覆盖本地 Collection、链接、标签、绑定和标签关系。
          </AlertDialogDescription>
          {importPayload ? (
            <div
              className="grid gap-2 rounded-md border border-border bg-background p-3 text-xs"
              data-ui-name="导入JSON详情"
            >
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <span className="text-muted-foreground">导出时间</span>
                <span className="min-w-0 break-all font-medium">{importPayload.exportedAt}</span>
              </div>
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <span className="text-muted-foreground">数据数量</span>
                <span className="min-w-0">
                  Collection {importPayload.data.collections.length}，链接 {importPayload.data.links.length}，标签{" "}
                  {importPayload.data.tags.length}，绑定 {importPayload.data.link_tags.length}，关系{" "}
                  {importPayload.data.tag_relations.length}
                </span>
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <AlertDialogCancel asChild>
              <Button data-ui-name="导入JSON取消按钮" variant="outline">
                取消
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button data-ui-name="追加导入JSON按钮" variant="outline" onClick={() => onImportJson("append")}>
                追加导入
              </Button>
            </AlertDialogAction>
            <AlertDialogAction asChild>
              <Button data-ui-name="覆盖导入JSON按钮" variant="danger" onClick={() => onImportJson("replace")}>
                覆盖导入
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(importBookmarkData)} onOpenChange={(open) => !open && onImportBookmarkDataClear()}>
        <AlertDialogContent data-ui-name="导入浏览器书签确认弹窗">
          <AlertDialogTitle className="text-base font-semibold">确认导入</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            可以追加到当前数据，也可以用{importBookmarkSourceName}覆盖本地链接、标签、绑定和标签关系。
          </AlertDialogDescription>
          {importBookmarkData ? (
            <div
              className="grid gap-2 rounded-md border border-border bg-background p-3 text-xs"
              data-ui-name="导入浏览器书签详情"
            >
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2">
                <span className="text-muted-foreground">Collection</span>
                <Select
                  value={importBookmarkCollectionId ?? ""}
                  onValueChange={(value) => onImportBookmarkCollectionChange(value)}
                >
                  <SelectTrigger className="h-8 min-w-0" data-ui-name="书签导入集合选择器">
                    <SelectValue placeholder="选择 Collection" />
                  </SelectTrigger>
                  <SelectContent data-ui-name="书签导入集合选择列表">
                    {collections.map((collection) => (
                      <SelectItem key={collection.id} value={collection.id}>
                        {collection.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <span className="text-muted-foreground">数据数量</span>
                <span className="min-w-0">
                  链接 {importBookmarkData.links.length}，标签 {importBookmarkData.tags.length}，绑定{" "}
                  {importBookmarkData.link_tags.length}，关系 {importBookmarkData.tag_relations.length}
                </span>
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <AlertDialogCancel asChild>
              <Button data-ui-name="导入浏览器书签取消按钮" variant="outline">
                取消
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                data-ui-name="追加导入浏览器书签按钮"
                variant="outline"
                disabled={!canImportBookmarks}
                onClick={() => onImportBrowserBookmarks("append")}
              >
                追加导入
              </Button>
            </AlertDialogAction>
            <AlertDialogAction asChild>
              <Button
                data-ui-name="覆盖导入浏览器书签按钮"
                variant="danger"
                disabled={!canImportBookmarks}
                onClick={() => onImportBrowserBookmarks("replace")}
              >
                覆盖导入
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(backupConflict)}>
        <AlertDialogContent data-ui-name="远程同步版本冲突弹窗">
          <AlertDialogTitle className="text-base font-semibold">远程同步冲突</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            本地和远程都发生了变化，自动同步已停止。请选择使用远程数据，或用本地数据覆盖远程。
          </AlertDialogDescription>
          {backupConflict ? (
            <div
              className="grid gap-2 rounded-md border border-border bg-background p-3 text-xs"
              data-ui-name="远程同步版本冲突详情"
            >
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <span className="text-muted-foreground">远程版本</span>
                <span className="min-w-0 break-all font-medium">{backupConflict.remoteVersion || "无版本号"}</span>
              </div>
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <span className="text-muted-foreground">远程父版</span>
                <span className="min-w-0 break-all">{backupConflict.remoteParentVersion || "无版本号"}</span>
              </div>
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <span className="text-muted-foreground">本地版本</span>
                <span className="min-w-0 break-all font-medium">{backupConflict.localVersion || "无版本号"}</span>
              </div>
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <span className="text-muted-foreground">本地基线</span>
                <span className="min-w-0 break-all">{backupConflict.localBaseVersion || "无版本号"}</span>
              </div>
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <span className="text-muted-foreground">待同步</span>
                <span className="min-w-0 break-all">{backupConflict.pendingSync ? "是" : "否"}</span>
              </div>
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <span className="text-muted-foreground">远程环境</span>
                <span className="min-w-0 break-all">
                  {`${backupConflict.remoteManifest.metadata.runtimeInfo.appRuntime} / ${backupConflict.remoteManifest.metadata.runtimeInfo.platform}`}
                </span>
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <AlertDialogAction asChild>
              <Button
                data-ui-name="使用远程数据按钮"
                variant="outline"
                disabled={backupStatus.type === "running"}
                onClick={onUseRemoteBackup}
              >
                使用远程
              </Button>
            </AlertDialogAction>
            <AlertDialogAction asChild>
              <Button
                data-ui-name="使用本地数据按钮"
                disabled={backupStatus.type === "running"}
                onClick={onUseLocalBackup}
              >
                使用本地
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(missingGistConfirm)}
        onOpenChange={(open) => !open && onMissingGistConfirmChange(null)}
      >
        <AlertDialogContent data-ui-name="远程Gist失效确认弹窗">
          <AlertDialogTitle className="text-base font-semibold">Gist 无法使用</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            当前保存的 Gist ID 无法访问，可能已被删除。是否用本地数据创建新的 Gist？
          </AlertDialogDescription>
          {missingGistConfirm ? (
            <div
              className="grid gap-2 rounded-md border border-border bg-background p-3 text-xs"
              data-ui-name="远程Gist失效详情"
            >
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <span className="text-muted-foreground">远程类型</span>
                <span className="min-w-0 break-all font-medium">{missingGistConfirm.provider}</span>
              </div>
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <span className="text-muted-foreground">Gist ID</span>
                <span className="min-w-0 break-all font-medium">{missingGistConfirm.gist}</span>
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            {missingGistConfirm?.url ? (
              <Button
                data-ui-name="打开失效Gist按钮"
                variant="outline"
                onClick={() => window.open(missingGistConfirm.url, "_blank", "noopener,noreferrer")}
              >
                打开 Gist
              </Button>
            ) : null}
            <AlertDialogCancel asChild>
              <Button data-ui-name="取消创建新Gist按钮" variant="outline">
                取消
              </Button>
            </AlertDialogCancel>
            <Button
              data-ui-name="创建新Gist按钮"
              disabled={backupStatus.type === "running"}
              onClick={onCreateReplacementGist}
            >
              创建新 Gist
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(invalidTokenConfirm)}
        onOpenChange={(open) => !open && onInvalidTokenConfirmChange(null)}
      >
        <AlertDialogContent data-ui-name="远程Token失效确认弹窗">
          <AlertDialogTitle className="text-base font-semibold">Token 无法使用</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            当前保存的 Token 无法访问远程备份。是否现在更换 Token？
          </AlertDialogDescription>
          {invalidTokenConfirm ? (
            <div
              className="grid gap-2 rounded-md border border-border bg-background p-3 text-xs"
              data-ui-name="远程Token失效详情"
            >
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <span className="text-muted-foreground">远程类型</span>
                <span className="min-w-0 break-all font-medium">{invalidTokenConfirm.provider}</span>
              </div>
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <span className="text-muted-foreground">状态码</span>
                <span className="min-w-0 break-all font-medium">{invalidTokenConfirm.status}</span>
              </div>
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <span className="text-muted-foreground">错误信息</span>
                <span className="min-w-0 break-all">{invalidTokenConfirm.message}</span>
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <AlertDialogCancel asChild>
              <Button data-ui-name="取消更换Token按钮" variant="outline">
                取消
              </Button>
            </AlertDialogCancel>
            <Button
              data-ui-name="更换Token按钮"
              disabled={backupStatus.type === "running"}
              onClick={() => {
                if (invalidTokenConfirm) onChangeRemoteToken(invalidTokenConfirm.provider);
              }}
            >
              更换 Token
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
