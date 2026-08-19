import { Handle, Position } from "@xyflow/react";
import { useContext } from "react";

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, cn } from "@linktag/ui";

import { GraphHoverContext, graphHoverTouchesTag } from "./graph-hover";
import type { GraphHandleSide, TagNodeData } from "./graph-types";
import { tagStyle } from "../tags/TagBadges";

const graphHandlePositions: Array<{ side: GraphHandleSide; position: Position }> = [
  { side: "top", position: Position.Top },
  { side: "right", position: Position.Right },
  { side: "bottom", position: Position.Bottom },
  { side: "left", position: Position.Left },
];

export function TagNode({ data }: { data: Record<string, unknown> }) {
  const { tag, onEditTag, onDeleteTag, active } = data as TagNodeData;
  const { hoverTarget, setHoverTarget } = useContext(GraphHoverContext);
  const highlighted = active || graphHoverTouchesTag(hoverTarget, tag.id);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="relative nodrag"
          data-ui-name="关系图标签节点"
          data-linktag-context-menu
          onMouseEnter={() => setHoverTarget({ type: "tag", tagId: tag.id })}
          onMouseLeave={() => setHoverTarget(null)}
        >
          {graphHandlePositions.map(({ side, position }) => (
            <Handle
              key={`source-${side}`}
              id={`source-${side}`}
              type="source"
              position={position}
              isConnectable
              className="linktag-inert-handle"
            />
          ))}
          <div
            className={cn(
              "flex h-10 items-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold shadow-sm",
              highlighted && "ring-2 ring-ring",
            )}
            data-ui-name="关系图标签"
            style={tagStyle(tag.color)}
          >
            <span>{tag.name}</span>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent data-ui-name="标签右键菜单">
        <ContextMenuItem data-ui-name="编辑标签名称" onSelect={() => onEditTag(tag)}>
          编辑
        </ContextMenuItem>
        <ContextMenuItem data-ui-name="删除标签" className="text-destructive" onSelect={() => onDeleteTag(tag.id)}>
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
