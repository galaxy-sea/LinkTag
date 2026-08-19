import { useLiveQuery } from "dexie-react-hooks";
import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  cn,
} from "@linktag/ui";

import {
  createCollection,
  db,
  DEFAULT_COLLECTION_ID,
  DEFAULT_COLLECTION_NAME,
  nowIso,
  readCollections,
  setActiveCollectionId,
} from "../../db";
import { getElementDragPlacement, setElementDragImage } from "../../core/drag";
import { moveId, sortValuesForOrder } from "../../core/sort";
import type { CollectionRecord, Id } from "../../types";

const fallbackCollection: CollectionRecord = {
  id: DEFAULT_COLLECTION_ID,
  name: DEFAULT_COLLECTION_NAME,
  updatedAt: "",
};

function collectionInitial(name: string) {
  return Array.from(name.trim()).at(0)?.toUpperCase() ?? "?";
}

export function CollectionDrawer({
  activeCollectionId,
  onActiveCollectionChange,
  onCollectionChange,
  renderSettingsControl,
}: {
  activeCollectionId: Id;
  onActiveCollectionChange: (collectionId: Id) => void;
  onCollectionChange?: () => void | Promise<void>;
  renderSettingsControl?: (expanded: boolean, releaseTransientOpen: () => void) => ReactNode;
}) {
  const liveCollections = useLiveQuery(readCollections, []);
  const collections = useMemo(() => {
    const rows = liveCollections ?? [];
    if (rows.some((collection) => collection.id === activeCollectionId)) return rows;
    if (activeCollectionId === DEFAULT_COLLECTION_ID) return [fallbackCollection, ...rows];
    return [{ id: activeCollectionId, name: activeCollectionId, updatedAt: "" }, ...rows];
  }, [activeCollectionId, liveCollections]);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteCollection, setDeleteCollection] = useState<CollectionRecord | null>(null);
  const [mutatingCollection, setMutatingCollection] = useState(false);
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(false);
  const [draggedCollectionId, setDraggedCollectionId] = useState<Id | null>(null);
  const [previewCollectionIds, setPreviewCollectionIds] = useState<Id[] | null>(null);
  const collectionIds = useMemo(() => collections.map((collection) => collection.id), [collections]);
  const collectionsById = useMemo(
    () => new Map(collections.map((collection) => [collection.id, collection])),
    [collections],
  );
  const visibleCollections = useMemo(() => {
    if (!previewCollectionIds) return collections;
    return previewCollectionIds
      .map((collectionId) => collectionsById.get(collectionId))
      .filter((collection): collection is CollectionRecord => Boolean(collection));
  }, [collections, collectionsById, previewCollectionIds]);
  const expanded = pinnedOpen || hoverOpen || collectionMenuOpen || Boolean(draggedCollectionId);
  const canDeleteCollection = collections.length > 1;

  useEffect(() => {
    if (!draggedCollectionId) setPreviewCollectionIds(null);
  }, [draggedCollectionId, collectionIds]);

  const releaseTransientOpen = () => {
    setHoverOpen(false);
    setCollectionMenuOpen(false);
  };

  const selectCollection = (collectionId: Id) => {
    onActiveCollectionChange(collectionId);
    void setActiveCollectionId(collectionId).catch((error: unknown) => {
      console.error("[LinkTag] 保存当前集合失败", error);
    });
  };

  const requestEditCollection = (collection: CollectionRecord) => {
    setEditingCollection(collection);
    setEditName(collection.name);
  };

  const persistCollectionOrder = async (orderedIds: Id[]) => {
    const sortValues = sortValuesForOrder(orderedIds);
    await db.collections.bulkPut(
      collections.map((collection) => ({
        ...collection,
        sort: sortValues.get(collection.id) ?? collection.sort,
      })),
    );
    await onCollectionChange?.();
  };

  const saveCollection = async () => {
    const trimmed = name.trim();
    if (saving || !trimmed) return;
    setSaving(true);
    try {
      const collection = await createCollection(trimmed);
      await onCollectionChange?.();
      setName("");
      setCreating(false);
      selectCollection(collection.id);
    } finally {
      setSaving(false);
    }
  };

  const saveCollectionEdit = async () => {
    const trimmed = editName.trim();
    if (!editingCollection || mutatingCollection || !trimmed) return;
    setMutatingCollection(true);
    try {
      await db.collections.update(editingCollection.id, { name: trimmed, updatedAt: nowIso() });
      await onCollectionChange?.();
      setEditingCollection(null);
      setEditName("");
    } finally {
      setMutatingCollection(false);
    }
  };

  const confirmDeleteCollection = async () => {
    if (!deleteCollection || mutatingCollection || !canDeleteCollection) return;
    setMutatingCollection(true);
    try {
      const collectionId = deleteCollection.id;
      const nextCollection = collections.find((collection) => collection.id !== collectionId);
      await db.transaction("rw", db.collections, db.links, db.tags, db.link_tags, db.tag_relations, async () => {
        await db.link_tags.where("collectionId").equals(collectionId).delete();
        await db.tag_relations.where("collectionId").equals(collectionId).delete();
        await db.links.where("collectionId").equals(collectionId).delete();
        await db.tags.where("collectionId").equals(collectionId).delete();
        await db.collections.delete(collectionId);
      });
      if (collectionId === activeCollectionId && nextCollection) await selectCollection(nextCollection.id);
      await onCollectionChange?.();
      setDeleteCollection(null);
    } finally {
      setMutatingCollection(false);
    }
  };

  const handleCreateKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveCollection();
    }
    if (event.key === "Escape" && !event.nativeEvent.isComposing) {
      setName("");
      setCreating(false);
    }
  };

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveCollectionEdit();
    }
    if (event.key === "Escape" && !event.nativeEvent.isComposing) {
      setEditingCollection(null);
      setEditName("");
    }
  };

  return (
    <>
      <aside
        className={cn(
          "absolute inset-y-0 left-0 z-40 overflow-hidden border-r transition-[width]",
          expanded
            ? "w-56 border-border bg-workspace-surface shadow-panel"
            : "w-12 border-border bg-workspace-surface shadow-none",
        )}
        data-ui-name="集合抽屉"
        onPointerEnter={() => setHoverOpen(true)}
        onPointerLeave={() => setHoverOpen(false)}
      >
        <div className="flex h-full min-w-0 flex-col py-3" data-ui-name="集合抽屉内容">
          <div className="flex h-9 shrink-0 items-center gap-2 px-2" data-ui-name="集合抽屉标题栏">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground">
              <Button
                className="h-8 w-8 shrink-0"
                data-ui-name="集合抽屉固定按钮"
                size="icon"
                variant={pinnedOpen ? "default" : "ghost"}
                title={pinnedOpen ? "收起" : "展开"}
                aria-label={pinnedOpen ? "收起集合抽屉" : "展开集合抽屉"}
                onClick={() => setPinnedOpen((current) => !current)}
              >
                {pinnedOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </Button>
            </div>
            {expanded ? (
              <>
                <div className="min-w-0 flex-1 truncate text-sm font-semibold" data-ui-name="集合抽屉标题">
                  Collection
                </div>
                <Button
                  className="h-8 w-8 shrink-0"
                  data-ui-name="集合新建按钮"
                  size="icon"
                  variant="ghost"
                  title="新建"
                  aria-label="新建集合"
                  onClick={() => setCreating(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </>
            ) : null}
          </div>

          {expanded && creating ? (
            <div className="mt-2 grid gap-2 px-2" data-ui-name="集合新建区域">
              <Input
                className="h-8"
                data-ui-name="集合名称输入框"
                value={name}
                autoFocus
                placeholder="名称"
                onChange={(event) => setName(event.target.value)}
                onKeyDown={handleCreateKeyDown}
              />
              <Button
                className="h-8 justify-center"
                data-ui-name="集合保存按钮"
                size="sm"
                disabled={saving || !name.trim()}
                onClick={() => void saveCollection()}
              >
                保存
              </Button>
            </div>
          ) : null}

          <div className="linktag-scrollbar mt-2 min-h-0 flex-1 overflow-auto px-2" data-ui-name="集合列表滚动区">
            <div className="grid gap-1" data-ui-name="集合列表">
              {visibleCollections.map((collection) => {
                const active = collection.id === activeCollectionId;
                const collectionButton = (
                  <Button
                    className={cn(
                      "h-9 min-w-0 justify-start px-2",
                      expanded ? "w-full" : "w-8 justify-center",
                      active ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-transparent",
                      draggedCollectionId === collection.id && "opacity-50",
                    )}
                    data-ui-name="集合选项"
                    data-linktag-context-menu
                    draggable
                    size="sm"
                    variant={active ? "default" : "ghost"}
                    title={collection.name}
                    aria-label={collection.name}
                    onClick={() => selectCollection(collection.id)}
                    onDragStart={(event) => {
                      setDraggedCollectionId(collection.id);
                      setPreviewCollectionIds(collectionIds);
                      setElementDragImage(event);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", collection.id);
                    }}
                    onDragEnd={() => setDraggedCollectionId(null)}
                    onDragOver={(event) => {
                      if (!draggedCollectionId || draggedCollectionId === collection.id) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      const placement = getElementDragPlacement(event);
                      setPreviewCollectionIds((current) => {
                        const sourceIds = current ?? collectionIds;
                        const orderedIds = moveId(sourceIds, draggedCollectionId, collection.id, placement);
                        return orderedIds.every((id, index) => id === sourceIds[index]) ? current : orderedIds;
                      });
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (!draggedCollectionId) return;
                      void persistCollectionOrder(previewCollectionIds ?? collectionIds);
                      setDraggedCollectionId(null);
                      setPreviewCollectionIds(null);
                    }}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                        active ? "bg-primary-foreground/20" : "bg-secondary text-secondary-foreground",
                      )}
                      aria-hidden="true"
                    >
                      {collectionInitial(collection.name)}
                    </span>
                    {expanded ? <span className="min-w-0 truncate">{collection.name}</span> : null}
                  </Button>
                );
                return (
                  <ContextMenu key={collection.id} onOpenChange={setCollectionMenuOpen}>
                    <ContextMenuTrigger asChild>{collectionButton}</ContextMenuTrigger>
                    <ContextMenuContent
                      data-ui-name="集合右键菜单"
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onContextMenu={(event) => event.stopPropagation()}
                    >
                      <ContextMenuItem
                        data-ui-name="编辑集合"
                        onSelect={() => {
                          releaseTransientOpen();
                          requestEditCollection(collection);
                        }}
                      >
                        编辑
                      </ContextMenuItem>
                      <ContextMenuItem
                        className="text-destructive"
                        data-ui-name="删除集合"
                        disabled={!canDeleteCollection}
                        onSelect={() => {
                          releaseTransientOpen();
                          setDeleteCollection(collection);
                        }}
                      >
                        删除
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </div>
          </div>
          {renderSettingsControl ? (
            <div className="mt-2 flex h-9 shrink-0 items-center px-2" data-ui-name="集合抽屉底部操作区">
              {renderSettingsControl(expanded, releaseTransientOpen)}
            </div>
          ) : null}
        </div>
      </aside>

      <Dialog
        open={Boolean(editingCollection)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCollection(null);
            setEditName("");
          }
        }}
      >
        <DialogContent data-ui-name="编辑集合弹窗">
          <DialogTitle className="text-base font-semibold">编辑 Collection</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">修改 Collection 名称。</DialogDescription>
          <Input
            data-ui-name="编辑集合名称输入框"
            value={editName}
            autoFocus
            onChange={(event) => setEditName(event.target.value)}
            onKeyDown={handleEditKeyDown}
          />
          <div className="flex justify-end gap-2">
            <Button
              data-ui-name="编辑集合取消按钮"
              variant="outline"
              onClick={() => {
                setEditingCollection(null);
                setEditName("");
              }}
            >
              取消
            </Button>
            <Button
              data-ui-name="编辑集合保存按钮"
              disabled={mutatingCollection || !editName.trim()}
              onClick={() => void saveCollectionEdit()}
            >
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteCollection)} onOpenChange={(open) => !open && setDeleteCollection(null)}>
        <AlertDialogContent data-ui-name="删除集合确认弹窗">
          <AlertDialogTitle className="text-base font-semibold">确认删除</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            删除后该 Collection 下的链接、标签、绑定和标签关系都会移除。
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel asChild>
              <Button data-ui-name="删除集合取消按钮" variant="outline">
                取消
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                data-ui-name="删除集合确认按钮"
                variant="danger"
                disabled={mutatingCollection || !canDeleteCollection}
                onClick={() => void confirmDeleteCollection()}
              >
                删除
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
