import type { Id } from "../types";

export type BadgeFilter = { type: "tag"; tagId: Id } | { type: "relation"; relationId: Id };

export function sameBadgeFilter(left: BadgeFilter, right: BadgeFilter) {
  return (
    left.type === right.type &&
    ((left.type === "tag" && right.type === "tag" && left.tagId === right.tagId) ||
      (left.type === "relation" && right.type === "relation" && left.relationId === right.relationId))
  );
}
