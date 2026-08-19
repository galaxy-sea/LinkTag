import type { Id, LinkTagRecord, TagRecord, TagRelationRecord } from "../../types";

export type PendingRelation = {
  sourceTagId: Id;
  targetTagId: Id;
};

export type PendingRelationEndpoint = PendingRelation & {
  source?: TagRecord;
  target?: TagRecord;
};

export function findTagRelationBetween(relations: TagRelationRecord[], firstTagId: Id, secondTagId: Id) {
  return relations.find(
    (relation) =>
      (relation.sourceTagId === firstTagId && relation.targetTagId === secondTagId) ||
      (relation.sourceTagId === secondTagId && relation.targetTagId === firstTagId),
  );
}

export function tagRelationPairKey(firstTagId: Id, secondTagId: Id) {
  return [firstTagId, secondTagId].sort().join("::");
}

export function linkTagsContainPair(linkTags: LinkTagRecord[], firstTagId: Id, secondTagId: Id) {
  const tagsByLink = new Map<Id, Set<Id>>();
  for (const binding of linkTags) {
    const tagIds = tagsByLink.get(binding.linkId) ?? new Set<Id>();
    tagIds.add(binding.tagId);
    tagsByLink.set(binding.linkId, tagIds);
  }
  return [...tagsByLink.values()].some((tagIds) => tagIds.has(firstTagId) && tagIds.has(secondTagId));
}

export function relationsToCleanupAfterBindingDelete(
  linkId: Id,
  tagId: Id,
  linkTags: LinkTagRecord[],
  relations: TagRelationRecord[],
) {
  const linkTagsAfterDelete = linkTags.filter((binding) => !(binding.linkId === linkId && binding.tagId === tagId));
  const remainingTagIds = linkTagsAfterDelete
    .filter((binding) => binding.linkId === linkId)
    .map((binding) => binding.tagId);

  return remainingTagIds
    .map((remainingTagId) => findTagRelationBetween(relations, tagId, remainingTagId))
    .filter((relation): relation is TagRelationRecord => Boolean(relation))
    .filter((relation) => !linkTagsContainPair(linkTagsAfterDelete, relation.sourceTagId, relation.targetTagId));
}
