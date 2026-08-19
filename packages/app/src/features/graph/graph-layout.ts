import ELK from "elkjs/lib/elk.bundled.js";
import { MarkerType, type Edge, type Node } from "@xyflow/react";

import type { BadgeFilter } from "../../core/filters";
import { matchesEveryKeyword, parseSearchQuery, searchIsEmpty, searchMatchesTag } from "../../core/search";
import type { GraphHandleSide } from "./graph-types";
import type { EdgeLineType, ElkLayout, Id, TagRecord, TagRelationRecord } from "../../types";

const elk = new ELK();

export function nodeId(kind: string, id: Id) {
  return `${kind}:${id}`;
}

export function tagIdFromNodeId(value: string | null | undefined) {
  return value?.startsWith("tag:") ? value.slice(4) : null;
}

export function elkOptions(layout: ElkLayout): Record<string, string> {
  if (layout === "force") {
    return {
      "elk.algorithm": "org.eclipse.elk.force",
      "elk.spacing.nodeNode": "48",
    };
  }
  if (layout === "stress") {
    return {
      "elk.algorithm": "org.eclipse.elk.stress",
      "elk.spacing.nodeNode": "48",
    };
  }
  return {
    "elk.algorithm": "layered",
    "elk.direction": layout === "horizontal" ? "RIGHT" : "DOWN",
    "elk.layered.spacing.nodeNodeBetweenLayers": "72",
    "elk.spacing.nodeNode": "36",
  };
}

export function filterGraphTags(tags: TagRecord[], relations: TagRelationRecord[], query: string) {
  const search = parseSearchQuery(query);
  if (searchIsEmpty(search) || (search.tagTerms.length === 0 && search.keywords.length === 0)) return tags;
  const matched = new Set(tags.filter((tag) => searchMatchesTag(tag, search)).map((tag) => tag.id));
  const visible = new Set(matched);
  for (const relation of relations) {
    if (
      matched.has(relation.sourceTagId) ||
      matched.has(relation.targetTagId) ||
      (search.keywords.length > 0 && matchesEveryKeyword([relation.name], search.keywords))
    ) {
      visible.add(relation.sourceTagId);
      visible.add(relation.targetTagId);
    }
  }
  return tags.filter((tag) => visible.has(tag.id));
}

export function chooseGraphHandleSides(
  source: { x: number; y: number; width: number; height: number },
  target: { x: number; y: number; width: number; height: number },
  elkLayout: ElkLayout,
): { sourceSide: GraphHandleSide; targetSide: GraphHandleSide } {
  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const targetCenterX = target.x + target.width / 2;
  const targetCenterY = target.y + target.height / 2;
  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;
  const useHorizontal = elkLayout === "horizontal" || (elkLayout !== "vertical" && Math.abs(dx) >= Math.abs(dy));

  if (useHorizontal) {
    return dx >= 0 ? { sourceSide: "right", targetSide: "left" } : { sourceSide: "left", targetSide: "right" };
  }
  return dy >= 0 ? { sourceSide: "bottom", targetSide: "top" } : { sourceSide: "top", targetSide: "bottom" };
}

export async function buildGraph({
  tags,
  relations,
  query,
  elkLayout,
  edgeLineType,
  onEditTag,
  onDeleteTag,
  onEditRelation,
  onReverseRelation,
  onDeleteRelation,
  badgeFilters,
}: {
  tags: TagRecord[];
  relations: TagRelationRecord[];
  query: string;
  elkLayout: ElkLayout;
  edgeLineType: EdgeLineType;
  onEditTag: (tag: TagRecord) => void;
  onDeleteTag: (tagId: Id) => void;
  onEditRelation: (relation: TagRelationRecord) => void;
  onReverseRelation: (relation: TagRelationRecord) => void;
  onDeleteRelation: (relationId: Id) => void;
  badgeFilters: BadgeFilter[];
}) {
  const nodes: Node[] = [];
  const graphTop = 24;
  const filteredTags = filterGraphTags(tags, relations, query);
  const filteredTagIds = new Set(filteredTags.map((tag) => tag.id));
  const tagsByNodeId = new Map(filteredTags.map((tag) => [nodeId("tag", tag.id), tag]));
  const relationsById = new Map(relations.map((relation) => [relation.id, relation]));
  const selectedGraphTagIds = new Set(
    badgeFilters.filter((filter) => filter.type === "tag").map((filter) => filter.tagId),
  );
  const selectedGraphRelationIds = new Set(
    badgeFilters.filter((filter) => filter.type === "relation").map((filter) => filter.relationId),
  );
  const tagChildren = filteredTags.map((tag) => ({
    id: nodeId("tag", tag.id),
    width: Math.max(92, tag.name.length * 15 + 56),
    height: 44,
  }));
  const tagEdges =
    edgeLineType === "none"
      ? []
      : relations
          .filter((relation) => filteredTagIds.has(relation.sourceTagId) && filteredTagIds.has(relation.targetTagId))
          .map((relation) => ({
            id: relation.id,
            sources: [nodeId("tag", relation.sourceTagId)],
            targets: [nodeId("tag", relation.targetTagId)],
          }));
  const layouted = await elk.layout({
    id: "root",
    layoutOptions: elkOptions(elkLayout),
    children: tagChildren,
    edges: tagEdges,
  });

  const nodeRects = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const child of layouted.children ?? []) {
    const tag = tagsByNodeId.get(child.id);
    if (!tag) continue;
    const x = 48 + (child.x ?? 0);
    const y = graphTop + (child.y ?? 0);
    const width = child.width ?? 92;
    const height = child.height ?? 44;
    nodeRects.set(child.id, { x, y, width, height });
    nodes.push({
      id: child.id,
      type: "tag",
      position: { x, y },
      data: { tag, onEditTag, onDeleteTag, active: selectedGraphTagIds.has(tag.id) },
      draggable: false,
      zIndex: 10,
    });
  }

  const edges: Edge[] =
    edgeLineType === "none"
      ? []
      : tagEdges.map((edge) => {
          const relation = relationsById.get(edge.id)!;
          const highlighted = selectedGraphRelationIds.has(relation.id);
          const sourceRect = nodeRects.get(edge.sources[0]);
          const targetRect = nodeRects.get(edge.targets[0]);
          const handleSides =
            sourceRect && targetRect
              ? chooseGraphHandleSides(sourceRect, targetRect, elkLayout)
              : { sourceSide: "right" as const, targetSide: "left" as const };
          return {
            id: relation.id,
            source: edge.sources[0],
            target: edge.targets[0],
            sourceHandle: `source-${handleSides.sourceSide}`,
            targetHandle: `source-${handleSides.targetSide}`,
            type: "relation",
            label: relation.name,
            data: {
              relation,
              edgeLineType,
              highlighted,
              onEditRelation,
              onReverseRelation,
              onDeleteRelation,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: highlighted ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
            },
            style: {
              stroke: highlighted ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
              strokeWidth: highlighted ? 3 : 1.8,
            },
            labelStyle: { fill: "hsl(var(--foreground))", fontSize: 12 },
            labelBgStyle: { fill: "hsl(var(--background))", fillOpacity: 0.86 },
          };
        });

  return { nodes, edges };
}
