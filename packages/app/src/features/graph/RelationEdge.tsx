import { BaseEdge, getSmoothStepPath, getStraightPath, type EdgeProps } from "@xyflow/react";
import { useContext } from "react";

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@linktag/ui";

import { GraphHoverContext, graphHoverTouchesRelation } from "./graph-hover";
import type { RelationEdgeModel } from "./graph-types";

export function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  label,
  data,
}: EdgeProps<RelationEdgeModel>) {
  if (!data) return null;
  const { hoverTarget, setHoverTarget } = useContext(GraphHoverContext);
  const active = data.highlighted || graphHoverTouchesRelation(hoverTarget, data.relation);
  const pathParams = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
  const [edgePath, labelX, labelY] =
    data.edgeLineType === "straight"
      ? getStraightPath(pathParams)
      : getSmoothStepPath({
          ...pathParams,
          borderRadius: data.edgeLineType === "orthogonal" ? 0 : 12,
        });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: active ? "hsl(var(--primary))" : (style?.stroke ?? "hsl(var(--muted-foreground))"),
          strokeWidth: active ? 3 : (style?.strokeWidth ?? 1.8),
        }}
        label={label}
        labelX={labelX}
        labelY={labelY}
        labelStyle={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
        labelBgStyle={{ fill: "hsl(var(--background))", fillOpacity: 0.86 }}
        interactionWidth={20}
      />
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <path
            d={edgePath}
            data-ui-name="关系线右键触发区"
            data-linktag-context-menu
            className="react-flow__edge-interaction"
            fill="none"
            stroke="transparent"
            strokeWidth={24}
            style={{ pointerEvents: "stroke" }}
            onMouseEnter={() =>
              setHoverTarget({
                type: "relation",
                relationId: data.relation.id,
                sourceTagId: data.relation.sourceTagId,
                targetTagId: data.relation.targetTagId,
              })
            }
            onMouseLeave={() => setHoverTarget(null)}
          />
        </ContextMenuTrigger>
        <ContextMenuContent data-ui-name="关系线右键菜单">
          <ContextMenuItem data-ui-name="关系线编辑名称" onSelect={() => data.onEditRelation(data.relation)}>
            编辑名称
          </ContextMenuItem>
          <ContextMenuItem data-ui-name="关系线反转方向" onSelect={() => data.onReverseRelation(data.relation)}>
            反转方向
          </ContextMenuItem>
          <ContextMenuItem
            data-ui-name="关系线删除"
            className="text-destructive"
            onSelect={() => data.onDeleteRelation(data.relation.id)}
          >
            删除
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  );
}
