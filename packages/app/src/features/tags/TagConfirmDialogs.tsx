import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Badge,
  Button,
  cn,
} from "@linktag/ui";

import type { Id, TagRecord } from "../../types";
import { groupTagBadgeClassName, tagStyle } from "./TagBadges";
import type { DeleteTarget, RelationCleanupTarget } from "./useTagActions";

export function TagConfirmDialogs({
  deleteTarget,
  onDeleteTargetChange,
  onConfirmDelete,
  relationCleanupTarget,
  onRelationCleanupTargetChange,
  onConfirmRelationCleanup,
  tagsById,
}: {
  deleteTarget: DeleteTarget;
  onDeleteTargetChange: (target: DeleteTarget) => void;
  onConfirmDelete: () => void;
  relationCleanupTarget: RelationCleanupTarget;
  onRelationCleanupTargetChange: (target: RelationCleanupTarget) => void;
  onConfirmRelationCleanup: () => void;
  tagsById: Map<Id, TagRecord>;
}) {
  return (
    <>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && onDeleteTargetChange(null)}>
        <AlertDialogContent data-ui-name="删除确认弹窗">
          <AlertDialogTitle className="text-base font-semibold">确认删除</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            {deleteTarget?.type === "binding" && "删除后该链接将不再绑定此标签；如果没有其他标签，链接记录也会删除。"}
            {deleteTarget?.type === "relation" && "删除后该标签关系将从关系图中移除。"}
            {deleteTarget?.type === "tag" && "删除后该标签、绑定和相关关系都会移除。"}
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel asChild>
              <Button data-ui-name="删除确认取消按钮" variant="outline">
                取消
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button data-ui-name="删除确认删除按钮" variant="danger" onClick={onConfirmDelete}>
                删除
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(relationCleanupTarget)}
        onOpenChange={(open) => !open && onRelationCleanupTargetChange(null)}
      >
        <AlertDialogContent data-ui-name="标签关系清理确认弹窗">
          <AlertDialogTitle className="text-base font-semibold">删除标签关系</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            该链接解绑后，以下标签关系不再由其他链接共同使用。是否删除这些关系？
          </AlertDialogDescription>
          <div className="grid max-h-[min(42vh,320px)] gap-2 overflow-auto pr-1" data-ui-name="待清理标签关系列表">
            {relationCleanupTarget?.relations.map((relation) => {
              const deletedTag = tagsById.get(relationCleanupTarget.deletedTagId);
              const relatedTag = tagsById.get(
                relation.sourceTagId === relationCleanupTarget.deletedTagId
                  ? relation.targetTagId
                  : relation.sourceTagId,
              );
              if (!deletedTag || !relatedTag) return null;
              return (
                <div
                  key={relation.id}
                  className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-background px-2 py-2"
                  data-ui-name="待清理标签关系"
                >
                  <Badge
                    className={cn(groupTagBadgeClassName, "shrink-0")}
                    data-ui-name="被删除标签"
                    style={tagStyle(deletedTag.color)}
                  >
                    {deletedTag.name}
                  </Badge>
                  <span
                    className="min-w-0 flex-1 truncate text-center text-sm font-medium"
                    data-ui-name="待删除关系名称"
                  >
                    {relation.name}
                  </span>
                  <Badge
                    className={cn(groupTagBadgeClassName, "shrink-0")}
                    data-ui-name="关联标签"
                    style={tagStyle(relatedTag.color)}
                  >
                    {relatedTag.name}
                  </Badge>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel asChild>
              <Button data-ui-name="保留标签关系按钮" variant="outline">
                保留
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button data-ui-name="删除标签关系按钮" variant="danger" onClick={onConfirmRelationCleanup}>
                删除关系
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
