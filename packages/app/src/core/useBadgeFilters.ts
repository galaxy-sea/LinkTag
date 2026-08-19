import { useCallback, useState } from "react";

import { type BadgeFilter, sameBadgeFilter } from "./filters";

export function useBadgeFilters() {
  const [badgeFilters, setBadgeFilters] = useState<BadgeFilter[]>([]);

  const toggleBadgeFilter = useCallback((nextFilter: BadgeFilter, additive = false) => {
    setBadgeFilters((current) => {
      const exists = current.some((filter) => sameBadgeFilter(filter, nextFilter));
      if (additive)
        return exists ? current.filter((filter) => !sameBadgeFilter(filter, nextFilter)) : [...current, nextFilter];
      return exists && current.length === 1 ? [] : [nextFilter];
    });
  }, []);

  const clearBadgeFilters = useCallback(() => setBadgeFilters([]), []);

  return {
    badgeFilters,
    toggleBadgeFilter,
    clearBadgeFilters,
  };
}
