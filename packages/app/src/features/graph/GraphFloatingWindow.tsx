import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@linktag/ui";

import { clampFloatingRect, resizeFloatingRect, type ResizeEdge } from "./floating-window";
import { writeSetting } from "../../storage";
import type { GraphWindowRect } from "../../types";

type FloatingAction =
  | { type: "move"; startX: number; startY: number; startRect: GraphWindowRect }
  | { type: "resize"; edge: ResizeEdge; startX: number; startY: number; startRect: GraphWindowRect };

export function GraphFloatingWindow({
  children,
  visible,
  initialRect,
  headerControls,
}: {
  children: ReactNode;
  visible: boolean;
  initialRect: GraphWindowRect;
  headerControls?: ReactNode;
}) {
  const [rect, setRect] = useState<GraphWindowRect>(() => clampFloatingRect(initialRect));
  const rectRef = useRef(rect);
  const actionRef = useRef<FloatingAction | null>(null);

  const persistRect = useCallback((nextRect: GraphWindowRect) => {
    writeSetting("graphWindowRect", JSON.stringify(nextRect));
  }, []);

  const updateRect = useCallback((nextRect: GraphWindowRect) => {
    rectRef.current = nextRect;
    setRect(nextRect);
  }, []);

  useEffect(() => {
    const nextRect = clampFloatingRect(rectRef.current);
    updateRect(nextRect);
    persistRect(nextRect);
  }, [persistRect, updateRect]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const action = actionRef.current;
      if (!action) return;
      event.preventDefault();
      const dx = event.clientX - action.startX;
      const dy = event.clientY - action.startY;
      if (action.type === "move") {
        updateRect(clampFloatingRect({ ...action.startRect, x: action.startRect.x + dx, y: action.startRect.y + dy }));
      } else {
        updateRect(resizeFloatingRect(action.edge, action.startRect, dx, dy));
      }
    };
    const handlePointerUp = () => {
      if (actionRef.current) persistRect(rectRef.current);
      actionRef.current = null;
    };
    const handleResize = () => {
      const nextRect = clampFloatingRect(rectRef.current);
      updateRect(nextRect);
      persistRect(nextRect);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("resize", handleResize);
    };
  }, [persistRect, updateRect]);

  const startMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    actionRef.current = { type: "move", startX: event.clientX, startY: event.clientY, startRect: rect };
  };

  const startResize = (edge: ResizeEdge, event: ReactPointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    actionRef.current = { type: "resize", edge, startX: event.clientX, startY: event.clientY, startRect: rect };
  };

  return (
    <div
      className={cn(
        "fixed z-30 flex overflow-hidden rounded-md border border-border bg-background shadow-panel",
        !visible && "hidden",
      )}
      data-ui-name="关系图浮窗"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
      aria-hidden={!visible}
    >
      <div className="flex min-h-0 w-full flex-col">
        <div
          className="flex h-10 min-w-0 shrink-0 cursor-move select-none items-center gap-3 overflow-hidden border-b border-border bg-muted px-3 text-sm font-semibold"
          data-ui-name="关系图浮窗顶部拖动区"
          onPointerDown={startMove}
        >
          <span className="min-w-0 flex-1 truncate" data-ui-name="关系图浮窗标题">
            关系图
          </span>
          {headerControls}
        </div>
        <div className="min-h-0 flex-1" data-ui-name="关系图浮窗内容">
          {children}
        </div>
      </div>
      <span
        className="absolute inset-x-2 top-0 h-1.5 cursor-n-resize"
        data-ui-name="关系图浮窗上边框缩放"
        onPointerDown={(event) => startResize("n", event)}
      />
      <span
        className="absolute inset-x-2 bottom-0 h-1.5 cursor-s-resize"
        data-ui-name="关系图浮窗下边框缩放"
        onPointerDown={(event) => startResize("s", event)}
      />
      <span
        className="absolute inset-y-2 left-0 w-1.5 cursor-w-resize"
        data-ui-name="关系图浮窗左边框缩放"
        onPointerDown={(event) => startResize("w", event)}
      />
      <span
        className="absolute inset-y-2 right-0 w-1.5 cursor-e-resize"
        data-ui-name="关系图浮窗右边框缩放"
        onPointerDown={(event) => startResize("e", event)}
      />
      <span
        className="absolute left-0 top-0 h-3 w-3 cursor-nw-resize"
        data-ui-name="关系图浮窗左上角缩放"
        onPointerDown={(event) => startResize("nw", event)}
      />
      <span
        className="absolute right-0 top-0 h-3 w-3 cursor-ne-resize"
        data-ui-name="关系图浮窗右上角缩放"
        onPointerDown={(event) => startResize("ne", event)}
      />
      <span
        className="absolute bottom-0 left-0 h-3 w-3 cursor-sw-resize"
        data-ui-name="关系图浮窗左下角缩放"
        onPointerDown={(event) => startResize("sw", event)}
      />
      <span
        className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize"
        data-ui-name="关系图浮窗右下角缩放"
        onPointerDown={(event) => startResize("se", event)}
      />
    </div>
  );
}
