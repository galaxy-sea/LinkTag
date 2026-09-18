import type { BrowserTab, LinkRecord } from "../types";

export const windowTabDragType = "application/x-linktag-window-tab";

export type WindowTabDragPayload = {
  tab: BrowserTab;
  link: LinkRecord;
};

export function setElementDragImage(event: { currentTarget: HTMLElement; dataTransfer: DataTransfer }) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.dataTransfer.setDragImage(event.currentTarget, Math.min(rect.width / 2, 160), Math.min(rect.height / 2, 32));
}

export function getElementDragPlacement(event: { currentTarget: HTMLElement; clientX: number; clientY: number }) {
  const rect = event.currentTarget.getBoundingClientRect();
  const parent = event.currentTarget.parentElement;
  const gridTemplateColumns = parent ? window.getComputedStyle(parent).gridTemplateColumns : "";
  const columnCount = gridTemplateColumns.split(" ").filter(Boolean).length;
  const after =
    columnCount > 1 ? event.clientX > rect.left + rect.width / 2 : event.clientY > rect.top + rect.height / 2;
  return after ? "after" : "before";
}

export type DragPoint = {
  clientX: number;
  clientY: number;
};

export function getDragPoint(event: { clientX: number; clientY: number }): DragPoint | null {
  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
  if (event.clientX === 0 && event.clientY === 0) return null;
  return { clientX: event.clientX, clientY: event.clientY };
}

export function getDragPointTarget(point: DragPoint | null, selector: string) {
  if (!point) return null;
  return document.elementFromPoint(point.clientX, point.clientY)?.closest(selector) as HTMLElement | null;
}

export function writeWindowTabDragPayload(dataTransfer: DataTransfer, payload: WindowTabDragPayload) {
  dataTransfer.setData(windowTabDragType, JSON.stringify(payload));
  dataTransfer.setData("text/plain", payload.link.id);
}

export function hasWindowTabDragPayload(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes(windowTabDragType);
}

export function readWindowTabDragPayload(dataTransfer: DataTransfer): WindowTabDragPayload | null {
  const raw = dataTransfer.getData(windowTabDragType);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as Partial<WindowTabDragPayload>;
    if (!payload.tab?.linkId || !payload.link?.id || !payload.link.url) return null;
    return payload as WindowTabDragPayload;
  } catch {
    return null;
  }
}
