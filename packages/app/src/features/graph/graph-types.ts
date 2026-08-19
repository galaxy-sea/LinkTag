import type { Edge } from "@xyflow/react";

import type { EdgeLineType, Id, TagRecord, TagRelationRecord } from "../../types";

export type GraphHandleSide = "top" | "right" | "bottom" | "left";

export type RelationEdgeData = {
  relation: TagRelationRecord;
  edgeLineType: EdgeLineType;
  highlighted: boolean;
  onEditRelation: (relation: TagRelationRecord) => void;
  onReverseRelation: (relation: TagRelationRecord) => void;
  onDeleteRelation: (relationId: Id) => void;
};

export type RelationEdgeModel = Edge<RelationEdgeData, "relation">;

export type TagNodeData = {
  tag: TagRecord;
  onEditTag: (tag: TagRecord) => void;
  onDeleteTag: (tagId: Id) => void;
  active: boolean;
};
