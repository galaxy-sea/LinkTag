import {
  Background,
  ConnectionMode,
  Controls,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BadgeFilter } from "../../core/filters";
import { buildGraph, tagIdFromNodeId } from "./graph-layout";
import { GraphHoverContext, type GraphHoverTarget } from "./graph-hover";
import { RelationEdge } from "./RelationEdge";
import { TagNode } from "./TagNode";
import type { EdgeLineType, ElkLayout, Id, TagRecord, TagRelationRecord } from "../../types";

function isMultiSelectEvent(event: unknown) {
  return typeof event === "object" && event !== null && ("metaKey" in event || "ctrlKey" in event)
    ? Boolean((event as MouseEvent).metaKey || (event as MouseEvent).ctrlKey)
    : false;
}

const nodeTypes = {
  tag: TagNode,
};

const edgeTypes = {
  relation: RelationEdge,
};

export function GraphMode({
  visible,
  tags,
  relations,
  query,
  elkLayout,
  edgeLineType,
  badgeFilters,
  onBadgeFilterChange,
  onEditTag,
  onDeleteTag,
  onEditRelation,
  onReverseRelation,
  onDeleteRelation,
  onCreateRelation,
}: {
  visible: boolean;
  tags: TagRecord[];
  relations: TagRelationRecord[];
  query: string;
  elkLayout: ElkLayout;
  edgeLineType: EdgeLineType;
  badgeFilters: BadgeFilter[];
  onBadgeFilterChange: (filter: BadgeFilter, additive?: boolean) => void;
  onEditTag: (tag: TagRecord) => void;
  onDeleteTag: (tagId: Id) => void;
  onEditRelation: (relation: TagRelationRecord) => void;
  onReverseRelation: (relation: TagRelationRecord) => void;
  onDeleteRelation: (relationId: Id) => void;
  onCreateRelation: (sourceTagId: Id, targetTagId: Id) => void;
}) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hoverTarget, setHoverTarget] = useState<GraphHoverTarget>(null);
  const flowWrapper = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void buildGraph({
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
    }).then((graph) => {
      if (cancelled) return;
      setNodes(graph.nodes);
      setEdges(graph.edges);
    });
    return () => {
      cancelled = true;
    };
  }, [
    edgeLineType,
    elkLayout,
    badgeFilters,
    onDeleteTag,
    onDeleteRelation,
    onEditRelation,
    onReverseRelation,
    onEditTag,
    query,
    relations,
    tags,
    visible,
  ]);

  const hoverContextValue = useMemo(() => ({ hoverTarget, setHoverTarget }), [hoverTarget]);
  const connectRelation = useCallback(
    (connection: Connection) => {
      const sourceTagId = tagIdFromNodeId(connection.source);
      const targetTagId = tagIdFromNodeId(connection.target);
      if (!sourceTagId || !targetTagId) return;
      onCreateRelation(sourceTagId, targetTagId);
    },
    [onCreateRelation],
  );

  return (
    <div ref={flowWrapper} className="h-full w-full" data-ui-name="关系图模式页面">
      <GraphHoverContext.Provider value={hoverContextValue}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          zIndexMode="manual"
          fitView
          minZoom={0.2}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable
          connectionMode={ConnectionMode.Loose}
          onConnect={connectRelation}
          onPaneContextMenu={(event) => {
            event.preventDefault();
          }}
          onNodeClick={(event, node) => {
            const tag = node.data.tag as TagRecord | undefined;
            if (tag) onBadgeFilterChange({ type: "tag", tagId: tag.id }, isMultiSelectEvent(event));
          }}
          onEdgeClick={(event, edge) => {
            onBadgeFilterChange({ type: "relation", relationId: edge.id }, isMultiSelectEvent(event));
          }}
          connectionLineStyle={{ stroke: "hsl(var(--primary))", strokeWidth: 2 }}
          data-ui-name="ReactFlow关系图"
        >
          <GraphAutoFit visible={visible} nodeCount={nodes.length} />
          <Background gap={24} size={1} color="hsl(var(--border))" />
          <Controls />
        </ReactFlow>
      </GraphHoverContext.Provider>
    </div>
  );
}

function GraphAutoFit({ visible, nodeCount }: { visible: boolean; nodeCount: number }) {
  const { fitView } = useReactFlow();
  const wasVisibleRef = useRef(false);
  const hasAutoFitRef = useRef(false);
  const nodeCountRef = useRef(nodeCount);

  useEffect(() => {
    nodeCountRef.current = nodeCount;
  }, [nodeCount]);

  useEffect(() => {
    const shouldFit = visible && !wasVisibleRef.current && !hasAutoFitRef.current;
    wasVisibleRef.current = visible;
    if (!shouldFit) return;
    const fit = () => {
      if (nodeCountRef.current === 0) return;
      hasAutoFitRef.current = true;
      void fitView({ padding: 0.18, duration: 180, includeHiddenNodes: false });
    };
    let secondFrame = 0;
    let timer = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(fit);
      timer = window.setTimeout(fit, 120);
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      if (timer) window.clearTimeout(timer);
    };
  }, [fitView, visible]);

  return null;
}
