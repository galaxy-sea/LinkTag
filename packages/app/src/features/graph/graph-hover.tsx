import { createContext } from "react";

import type { Id, TagRelationRecord } from "../../types";

export type GraphHoverTarget =
  { type: "tag"; tagId: Id } | { type: "relation"; relationId: Id; sourceTagId: Id; targetTagId: Id } | null;

export const GraphHoverContext = createContext<{
  hoverTarget: GraphHoverTarget;
  setHoverTarget: (target: GraphHoverTarget) => void;
}>({
  hoverTarget: null,
  setHoverTarget: () => undefined,
});

export function graphHoverTouchesRelation(hoverTarget: GraphHoverTarget, relation: TagRelationRecord) {
  if (!hoverTarget) return false;
  if (hoverTarget.type === "tag") {
    return relation.sourceTagId === hoverTarget.tagId || relation.targetTagId === hoverTarget.tagId;
  }
  return relation.id === hoverTarget.relationId;
}

export function graphHoverTouchesTag(hoverTarget: GraphHoverTarget, tagId: Id) {
  if (!hoverTarget) return false;
  if (hoverTarget.type === "tag") return hoverTarget.tagId === tagId;
  return hoverTarget.sourceTagId === tagId || hoverTarget.targetTagId === tagId;
}
