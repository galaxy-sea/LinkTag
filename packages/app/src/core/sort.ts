import type { Id } from "../types";

export function moveIdBefore(ids: Id[], draggedId: Id, targetId: Id) {
  return moveId(ids, draggedId, targetId, "before");
}

export function moveIdAfter(ids: Id[], draggedId: Id, targetId: Id) {
  return moveId(ids, draggedId, targetId, "after");
}

export function moveId(ids: Id[], draggedId: Id, targetId: Id, placement: "before" | "after") {
  if (draggedId === targetId) return ids;
  const fromIndex = ids.indexOf(draggedId);
  const toIndex = ids.indexOf(targetId);
  if (fromIndex < 0 || toIndex < 0) return ids;
  const next = [...ids];
  next.splice(fromIndex, 1);
  const targetIndex = next.indexOf(targetId);
  next.splice(placement === "after" ? targetIndex + 1 : targetIndex, 0, draggedId);
  return next;
}

export function sortValuesForOrder(ids: Id[]) {
  const base = Date.now();
  return new Map(ids.map((id, index) => [id, base + ids.length - index]));
}
