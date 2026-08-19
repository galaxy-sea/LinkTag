import "@linktag/app/styles.css";

import {
  createRuntimeInfo,
  DEFAULT_COLLECTION_ID,
  DEFAULT_COLLECTION_NAME,
  ensureCollection,
  getActiveCollectionId,
  LinkEditDialog,
  readAppShellData,
  readCollections,
  readLinkDataForLinkIds,
  RelationDialog,
  TagConfirmDialogs,
  useTagActions,
  type AppData,
  type CollectionRecord,
  type Id,
  type LinkEditValues,
  type LinkRecord,
  type TagRecord,
} from "@linktag/app";
import { Button, cn, Label } from "@linktag/ui";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, ChevronDown } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";

import { getCurrentTab, linkIdForUrl } from "../../src/browser-data";

type CurrentPage = {
  url: string;
  title: string;
};

const popupIntentKey = "linktagPopupIntent";
const fallbackCollection: CollectionRecord = {
  id: DEFAULT_COLLECTION_ID,
  name: DEFAULT_COLLECTION_NAME,
  updatedAt: "",
};
const emptyAppData: AppData = {
  links: [],
  tags: [],
  linkTags: [],
  relations: [],
  metadata: null,
};

function Popup() {
  const [page, setPage] = useState<CurrentPage | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState(() => getActiveCollectionId());
  const runtimeInfo = useMemo(() => createRuntimeInfo("extension"), []);
  const currentLinkId = page?.url ? linkIdForUrl(page.url) : null;

  const shellData = useLiveQuery(
    () => (collectOpen ? readAppShellData(selectedCollectionId) : Promise.resolve(null)),
    [collectOpen, selectedCollectionId],
  );
  const linkData = useLiveQuery(
    () =>
      collectOpen && currentLinkId
        ? readLinkDataForLinkIds([currentLinkId], selectedCollectionId)
        : Promise.resolve(null),
    [collectOpen, currentLinkId, selectedCollectionId],
  );
  const data: AppData = useMemo(
    () => ({
      links: linkData?.links ?? emptyAppData.links,
      tags: shellData?.tags ?? emptyAppData.tags,
      linkTags: linkData?.linkTags ?? emptyAppData.linkTags,
      relations: shellData?.relations ?? emptyAppData.relations,
      metadata: shellData?.metadata ?? null,
    }),
    [linkData, shellData],
  );
  const liveCollections = useLiveQuery(readCollections, []);
  const collections = useMemo(() => {
    const rows = liveCollections ?? [];
    if (rows.some((collection) => collection.id === selectedCollectionId)) return rows;
    if (selectedCollectionId === DEFAULT_COLLECTION_ID) return [fallbackCollection, ...rows];
    return [{ id: selectedCollectionId, name: selectedCollectionId, updatedAt: "" }, ...rows];
  }, [liveCollections, selectedCollectionId]);
  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId);
  const collectionId = selectedCollectionId;
  const existingLink = currentLinkId ? data.links.find((link) => link.id === currentLinkId) : undefined;
  const boundTags = useMemo(() => {
    if (!currentLinkId) return [];
    const boundIds = new Set(
      data.linkTags.filter((binding) => binding.linkId === currentLinkId).map((binding) => binding.tagId),
    );
    return data.tags.filter((tag) => boundIds.has(tag.id));
  }, [currentLinkId, data.linkTags, data.tags]);
  const tagsById = useMemo(() => new Map(data.tags.map((tag) => [tag.id, tag])), [data.tags]);
  const popupLink = useMemo<LinkRecord | null>(
    () =>
      page && currentLinkId
        ? {
            id: currentLinkId,
            collectionId: existingLink?.collectionId ?? collectionId,
            url: existingLink?.url ?? page.url,
            title: existingLink?.title ?? (page.title || page.url),
            note: existingLink?.note ?? "",
            sort: existingLink?.sort ?? Date.now(),
          }
        : null,
    [collectionId, currentLinkId, existingLink, page],
  );

  const {
    pendingRelations,
    setPendingRelations,
    pendingRelationEndpoints,
    addTag,
    bindTagToLink,
    updateLink,
    requestDeleteBinding,
    deleteTarget,
    setDeleteTarget,
    relationCleanupTarget,
    setRelationCleanupTarget,
    createRelations,
    reversePendingRelation,
    reversePendingRelations,
    confirmDelete,
    confirmRelationCleanup,
  } = useTagActions({ data: collectOpen ? data : emptyAppData, runtimeInfo, collectionId });

  useEffect(() => {
    void ensureCollection(selectedCollectionId);
  }, [selectedCollectionId]);

  useEffect(() => {
    if (!collectOpen) setCollectionMenuOpen(false);
  }, [collectOpen]);

  useEffect(() => {
    let disposed = false;
    void browser.storage.local.get(popupIntentKey).then((items) => {
      if (disposed) return;
      if (items[popupIntentKey] === "collect") setCollectOpen(true);
      void browser.storage.local.remove(popupIntentKey);
    });
    void getCurrentTab().then((tab) => {
      if (disposed) return;
      const nextPage = {
        url: tab.url ?? "",
        title: tab.title || tab.url || "",
      };
      setPage(nextPage);
    });
    return () => {
      disposed = true;
    };
  }, []);

  const savePopupLink = async (linkId: Id, values: LinkEditValues) => {
    await updateLink(linkId, values);
  };

  const confirmPopupDelete = async () => {
    await confirmDelete();
  };

  const openPluginPage = async () => {
    const runtime = browser.runtime as typeof browser.runtime & { getURL(path: string): string };
    await browser.tabs.create({ url: runtime.getURL("/newtab.html") });
    window.close();
  };

  return (
    <div
      className={cn(
        "overflow-hidden bg-background p-4 text-foreground",
        collectOpen ? "h-[600px] w-[520px]" : "h-[152px] w-[320px]",
      )}
      data-ui-name="插件Popup"
    >
      <div className="mb-3 flex items-center justify-between gap-3" data-ui-name="Popup顶部区域">
        <div className="min-w-0" data-ui-name="Popup当前页面信息">
          <div className="truncate text-sm font-semibold" data-ui-name="Popup标题">
            LinkTag
          </div>
        </div>
      </div>

      {!collectOpen ? (
        <div className="grid gap-2" data-ui-name="Popup操作列表">
          <Button
            className="h-11 justify-start text-sm"
            data-ui-name="Popup收藏网页按钮"
            type="button"
            variant="outline"
            onClick={() => setCollectOpen(true)}
          >
            收藏网页
          </Button>
          <Button
            className="h-11 justify-start text-sm"
            data-ui-name="Popup打开插件页按钮"
            type="button"
            variant="outline"
            onClick={() => void openPluginPage()}
          >
            打开插件页
          </Button>
        </div>
      ) : null}

      <LinkEditDialog
        link={collectOpen ? popupLink : null}
        titleText={existingLink ? "编辑链接" : "新增链接"}
        autoSave={Boolean(existingLink)}
        headerContent={
          <div className="grid gap-2" data-ui-name="Popup收藏集合选择区">
            <Label>Collection</Label>
            <div className="relative" data-ui-name="Popup收藏集合选择器">
              <Button
                className="h-9 w-full min-w-0 justify-between border border-input bg-background px-3 text-sm font-normal"
                data-ui-name="Popup收藏集合选择按钮"
                variant="ghost"
                onClick={() => setCollectionMenuOpen((open) => !open)}
                aria-expanded={collectionMenuOpen}
              >
                <span className="min-w-0 truncate">{selectedCollection?.name ?? selectedCollectionId}</span>
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 opacity-60 transition-transform", collectionMenuOpen && "rotate-180")}
                />
              </Button>
              {collectionMenuOpen ? (
                <div
                  className="absolute left-0 right-0 top-full z-[70] mt-1 max-h-56 overflow-auto rounded-md border border-border bg-popover p-1 text-sm shadow-lg"
                  data-ui-name="Popup收藏集合选择列表"
                >
                  {collections.map((collection) => {
                    const selected = collection.id === selectedCollectionId;
                    return (
                      <Button
                        key={collection.id}
                        className={cn(
                          "h-8 w-full min-w-0 justify-start px-2 text-sm font-normal",
                          selected && "bg-accent text-accent-foreground",
                        )}
                        data-ui-name="Popup收藏集合选择项"
                        variant="ghost"
                        onClick={() => {
                          setSelectedCollectionId(collection.id);
                          setCollectionMenuOpen(false);
                        }}
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                          {selected ? <Check className="h-4 w-4" /> : null}
                        </span>
                        <span className="min-w-0 truncate">{collection.name}</span>
                      </Button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        }
        contentClassName="!left-0 !top-0 h-screen max-h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto rounded-none border-0 shadow-none"
        overlayClassName="!bg-transparent"
        tags={boundTags}
        allTags={data.tags}
        onCreateTag={addTag}
        onBindTag={bindTagToLink}
        onDeleteBinding={requestDeleteBinding}
        onBeforeBind={savePopupLink}
        onOpenChange={(open) => {
          setCollectOpen(open);
        }}
        onSave={savePopupLink}
      />
      <RelationDialog
        open={pendingRelations.length > 0}
        title="新增标签关系"
        description="请输入关系名称"
        endpoints={pendingRelationEndpoints}
        initialName=""
        onOpenChange={(open) => {
          if (!open) setPendingRelations([]);
        }}
        onSaveMany={createRelations}
        onReverseEndpoint={reversePendingRelation}
        onReverseAllEndpoints={reversePendingRelations}
      />
      <TagConfirmDialogs
        deleteTarget={deleteTarget}
        onDeleteTargetChange={setDeleteTarget}
        onConfirmDelete={() => void confirmPopupDelete()}
        relationCleanupTarget={relationCleanupTarget}
        onRelationCleanupTargetChange={setRelationCleanupTarget}
        onConfirmRelationCleanup={() => void confirmRelationCleanup()}
        tagsById={tagsById as Map<Id, TagRecord>}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
