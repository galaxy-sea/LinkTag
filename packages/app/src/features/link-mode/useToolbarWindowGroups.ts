import { useCallback, useEffect, useRef, useState } from "react";

export function useToolbarWindowGroups() {
  const [toolbarWindowGroupsOpen, setToolbarWindowGroupsOpen] = useState(false);
  const toolbarHoverCloseTimerRef = useRef<number | null>(null);

  const openToolbarWindowGroups = useCallback(() => {
    if (toolbarHoverCloseTimerRef.current !== null) {
      window.clearTimeout(toolbarHoverCloseTimerRef.current);
      toolbarHoverCloseTimerRef.current = null;
    }
    setToolbarWindowGroupsOpen(true);
  }, []);

  const closeToolbarWindowGroups = useCallback(() => {
    if (toolbarHoverCloseTimerRef.current !== null) {
      window.clearTimeout(toolbarHoverCloseTimerRef.current);
    }
    toolbarHoverCloseTimerRef.current = window.setTimeout(() => {
      setToolbarWindowGroupsOpen(false);
      toolbarHoverCloseTimerRef.current = null;
    }, 120);
  }, []);

  useEffect(() => {
    return () => {
      if (toolbarHoverCloseTimerRef.current !== null) {
        window.clearTimeout(toolbarHoverCloseTimerRef.current);
      }
    };
  }, []);

  return {
    toolbarWindowGroupsOpen,
    openToolbarWindowGroups,
    closeToolbarWindowGroups,
  };
}
