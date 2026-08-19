import type { GraphWindowRect } from "../../types";

export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function clampFloatingRect(rect: GraphWindowRect): GraphWindowRect {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const mobile = viewportWidth < 640;
  const margin = mobile ? 8 : 12;
  const topMargin = mobile ? 96 : 68;
  const minWidth = Math.min(mobile ? 280 : 420, Math.max(160, viewportWidth - margin * 2));
  const minHeight = Math.min(mobile ? 260 : 320, Math.max(180, viewportHeight - topMargin - margin));
  const width = clampNumber(rect.width, minWidth, Math.max(minWidth, viewportWidth - margin * 2));
  const height = clampNumber(rect.height, minHeight, Math.max(minHeight, viewportHeight - topMargin - margin));
  return {
    x: clampNumber(rect.x, margin, Math.max(margin, viewportWidth - width - margin)),
    y: clampNumber(rect.y, topMargin, Math.max(topMargin, viewportHeight - height - margin)),
    width,
    height,
  };
}

export function resizeFloatingRect(
  edge: ResizeEdge,
  startRect: GraphWindowRect,
  dx: number,
  dy: number,
): GraphWindowRect {
  const mobile = window.innerWidth < 640;
  const minWidth = Math.min(mobile ? 280 : 420, Math.max(160, window.innerWidth - (mobile ? 16 : 24)));
  const minHeight = Math.min(mobile ? 260 : 320, Math.max(180, window.innerHeight - (mobile ? 104 : 80)));
  let { x, y, width, height } = startRect;

  if (edge.includes("e")) width = startRect.width + dx;
  if (edge.includes("s")) height = startRect.height + dy;
  if (edge.includes("w")) {
    width = startRect.width - dx;
    x = startRect.x + dx;
    if (width < minWidth) {
      x = startRect.x + startRect.width - minWidth;
      width = minWidth;
    }
  }
  if (edge.includes("n")) {
    height = startRect.height - dy;
    y = startRect.y + dy;
    if (height < minHeight) {
      y = startRect.y + startRect.height - minHeight;
      height = minHeight;
    }
  }

  return clampFloatingRect({ x, y, width, height });
}
