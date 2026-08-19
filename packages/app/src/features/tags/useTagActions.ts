import { useCallback, useMemo, useState } from "react";

import { type AppData } from "../../core/app-data";
import { createId, db, markLocalDataChanged, nowIso } from "../../db";
import type { BrowserTab, Id, LinkRecord, RuntimeInfo, TagRecord, TagRelationRecord } from "../../types";
import {
  findTagRelationBetween,
  relationsToCleanupAfterBindingDelete,
  tagRelationPairKey,
  type PendingRelation,
  type PendingRelationEndpoint,
} from "./relation-utils";

export type RelationCleanupTarget = {
  deletedTagId: Id;
  relations: TagRelationRecord[];
} | null;

export type DeleteTarget =
  { type: "binding"; linkId: Id; tagId: Id } | { type: "relation"; relationId: Id } | { type: "tag"; tagId: Id } | null;

export function useTagActions({
  data,
  runtimeInfo,
  collectionId,
}: {
  data: AppData;
  runtimeInfo: RuntimeInfo;
  collectionId: Id;
}) {
  const [pendingRelations, setPendingRelations] = useState<PendingRelation[]>([]);
  const [editingRelation, setEditingRelation] = useState<TagRelationRecord | null>(null);
  const [editingTag, setEditingTag] = useState<TagRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [relationCleanupTarget, setRelationCleanupTarget] = useState<RelationCleanupTarget>(null);

  const pendingRelationEndpoints = useMemo<PendingRelationEndpoint[]>(
    () =>
      pendingRelations.map((relation) => ({
        ...relation,
        source: data.tags.find((tag) => tag.id === relation.sourceTagId),
        target: data.tags.find((tag) => tag.id === relation.targetTagId),
      })),
    [data.tags, pendingRelations],
  );

  const markCurrentLocalDataChanged = useCallback(async () => {
    await markLocalDataChanged(runtimeInfo);
  }, [runtimeInfo]);

  const addTag = useCallback(
    async (name: string, color: string) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const existing = data.tags.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return existing;
      const tag: TagRecord = {
        id: createId("tag"),
        collectionId,
        name: trimmed,
        color,
        sort: Date.now(),
        updatedAt: nowIso(),
      };
      await db.tags.add(tag);
      await markCurrentLocalDataChanged();
      return tag;
    },
    [collectionId, data.tags, markCurrentLocalDataChanged],
  );

  const bindTagToLink = useCallback(
    async (linkId: Id, tagId: Id) => {
      const exists = data.linkTags.some((item) => item.linkId === linkId && item.tagId === tagId);
      if (exists) return;
      const relatedTagIds = data.linkTags
        .filter((item) => item.linkId === linkId && item.tagId !== tagId)
        .map((item) => item.tagId);
      const missingRelations = relatedTagIds
        .filter((relatedTagId) => !findTagRelationBetween(data.relations, relatedTagId, tagId))
        .map((relatedTagId) => ({ sourceTagId: tagId, targetTagId: relatedTagId }));
      await db.link_tags.add({ collectionId, linkId, tagId });
      await markCurrentLocalDataChanged();
      if (missingRelations.length) {
        setPendingRelations((current) => {
          const keys = new Set(
            current.map((relation) => tagRelationPairKey(relation.sourceTagId, relation.targetTagId)),
          );
          const next = [...current];
          for (const relation of missingRelations) {
            const key = tagRelationPairKey(relation.sourceTagId, relation.targetTagId);
            if (keys.has(key)) continue;
            keys.add(key);
            next.push(relation);
          }
          return next;
        });
      }
    },
    [collectionId, data.linkTags, data.relations, markCurrentLocalDataChanged],
  );

  const persistRuntimeTabLink = useCallback(
    async (tab: BrowserTab) => {
      const existing = await db.links.where("[collectionId+id]").equals([collectionId, tab.linkId]).first();
      await db.links.put({
        id: tab.linkId,
        collectionId,
        url: tab.url,
        title: tab.title,
        note: existing?.note ?? "",
        sort: existing?.sort ?? Date.now(),
      });
      await markCurrentLocalDataChanged();
    },
    [collectionId, markCurrentLocalDataChanged],
  );

  const updateLink = useCallback(
    async (linkId: Id, values: Pick<LinkRecord, "title" | "url" | "note">) => {
      const existing = await db.links.where("[collectionId+id]").equals([collectionId, linkId]).first();
      await db.links.put({
        id: linkId,
        collectionId,
        title: values.title.trim(),
        url: values.url.trim(),
        note: values.note,
        sort: existing?.sort ?? Date.now(),
      });
      await markCurrentLocalDataChanged();
    },
    [collectionId, markCurrentLocalDataChanged],
  );

  const requestGraphRelation = useCallback(
    (sourceTagId: Id, targetTagId: Id) => {
      if (sourceTagId === targetTagId) return;
      if (findTagRelationBetween(data.relations, sourceTagId, targetTagId)) return;
      setPendingRelations((current) => {
        const key = tagRelationPairKey(sourceTagId, targetTagId);
        if (current.some((relation) => tagRelationPairKey(relation.sourceTagId, relation.targetTagId) === key))
          return current;
        return [...current, { sourceTagId, targetTagId }];
      });
    },
    [data.relations],
  );

  const reversePendingRelation = useCallback((index: number) => {
    setPendingRelations((current) =>
      current.map((relation, relationIndex) =>
        relationIndex === index ? { sourceTagId: relation.targetTagId, targetTagId: relation.sourceTagId } : relation,
      ),
    );
  }, []);

  const reversePendingRelations = useCallback(() => {
    setPendingRelations((current) =>
      current.map((relation) => ({ sourceTagId: relation.targetTagId, targetTagId: relation.sourceTagId })),
    );
  }, []);

  const createRelations = async (names: string[]) => {
    if (!pendingRelations.length) return;
    const existingRelations = await db.tag_relations.where("collectionId").equals(collectionId).toArray();
    const existingKeys = new Set(
      existingRelations.map((relation) => tagRelationPairKey(relation.sourceTagId, relation.targetTagId)),
    );
    const relationRows: TagRelationRecord[] = [];
    pendingRelations.forEach((relation, index) => {
      const key = tagRelationPairKey(relation.sourceTagId, relation.targetTagId);
      if (existingKeys.has(key)) return;
      existingKeys.add(key);
      relationRows.push({
        id: createId("rel"),
        collectionId,
        sourceTagId: relation.sourceTagId,
        targetTagId: relation.targetTagId,
        name: names[index]?.trim() || "关联",
      });
    });
    if (relationRows.length) {
      await db.tag_relations.bulkAdd(relationRows);
      await markCurrentLocalDataChanged();
    }
    setPendingRelations([]);
  };

  const updateRelation = useCallback(
    async (relationId: Id, name: string) => {
      await db.tag_relations
        .where("[collectionId+id]")
        .equals([collectionId, relationId])
        .modify({ name: name.trim() || "关联" });
      await markCurrentLocalDataChanged();
      setEditingRelation(null);
    },
    [collectionId, markCurrentLocalDataChanged],
  );

  const reverseRelation = useCallback(
    async (relation: TagRelationRecord) => {
      await db.tag_relations.where("[collectionId+id]").equals([collectionId, relation.id]).modify({
        sourceTagId: relation.targetTagId,
        targetTagId: relation.sourceTagId,
      });
      await markCurrentLocalDataChanged();
    },
    [collectionId, markCurrentLocalDataChanged],
  );

  const updateTag = useCallback(
    async (tagId: Id, name: string, color: string, sort: number) => {
      await db.tags
        .where("[collectionId+id]")
        .equals([collectionId, tagId])
        .modify({ name: name.trim(), color, sort, updatedAt: nowIso() });
      await markCurrentLocalDataChanged();
      setEditingTag(null);
    },
    [collectionId, markCurrentLocalDataChanged],
  );

  const requestDeleteBinding = useCallback((linkId: Id, tagId: Id) => {
    setDeleteTarget({ type: "binding", linkId, tagId });
  }, []);

  const requestEditTag = useCallback((tag: TagRecord) => {
    setEditingTag(tag);
  }, []);

  const requestDeleteTag = useCallback((tagId: Id) => {
    setDeleteTarget({ type: "tag", tagId });
  }, []);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "binding") {
      const cleanupRelations = relationsToCleanupAfterBindingDelete(
        deleteTarget.linkId,
        deleteTarget.tagId,
        data.linkTags,
        data.relations,
      );
      await db.transaction("rw", db.links, db.link_tags, async () => {
        await db.link_tags.delete([collectionId, deleteTarget.linkId, deleteTarget.tagId]);
        const remainingBindings = await db.link_tags
          .where("[collectionId+linkId]")
          .equals([collectionId, deleteTarget.linkId])
          .count();
        if (remainingBindings === 0)
          await db.links.where("[collectionId+id]").equals([collectionId, deleteTarget.linkId]).delete();
      });
      await markCurrentLocalDataChanged();
      if (cleanupRelations.length) {
        setRelationCleanupTarget({ deletedTagId: deleteTarget.tagId, relations: cleanupRelations });
      }
    }
    if (deleteTarget.type === "relation") {
      await db.tag_relations.where("[collectionId+id]").equals([collectionId, deleteTarget.relationId]).delete();
      await markCurrentLocalDataChanged();
    }
    if (deleteTarget.type === "tag") {
      await db.transaction("rw", db.tags, db.link_tags, db.tag_relations, async () => {
        await db.tags.where("[collectionId+id]").equals([collectionId, deleteTarget.tagId]).delete();
        const bindings = await db.link_tags
          .where("[collectionId+tagId]")
          .equals([collectionId, deleteTarget.tagId])
          .toArray();
        await Promise.all(
          bindings.map((binding) => db.link_tags.delete([binding.collectionId, binding.linkId, binding.tagId])),
        );
        const relations = await db.tag_relations.where("collectionId").equals(collectionId).toArray();
        await db.tag_relations.bulkDelete(
          relations
            .filter(
              (relation) => relation.sourceTagId === deleteTarget.tagId || relation.targetTagId === deleteTarget.tagId,
            )
            .map((relation) => [collectionId, relation.id] as [Id, Id]),
        );
      });
      await markCurrentLocalDataChanged();
    }
    setDeleteTarget(null);
  };

  const confirmRelationCleanup = async () => {
    if (!relationCleanupTarget) return;
    await db.tag_relations.bulkDelete(
      relationCleanupTarget.relations.map((relation) => [collectionId, relation.id] as [Id, Id]),
    );
    await markCurrentLocalDataChanged();
    setRelationCleanupTarget(null);
  };

  return {
    pendingRelations,
    setPendingRelations,
    pendingRelationEndpoints,
    editingRelation,
    setEditingRelation,
    editingTag,
    setEditingTag,
    deleteTarget,
    setDeleteTarget,
    relationCleanupTarget,
    setRelationCleanupTarget,
    addTag,
    bindTagToLink,
    persistRuntimeTabLink,
    updateLink,
    requestGraphRelation,
    reversePendingRelation,
    reversePendingRelations,
    createRelations,
    updateRelation,
    reverseRelation,
    updateTag,
    requestDeleteBinding,
    requestEditTag,
    requestDeleteTag,
    confirmDelete,
    confirmRelationCleanup,
  };
}
