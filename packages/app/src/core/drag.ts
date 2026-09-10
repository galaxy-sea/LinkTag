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
