export function preventNativeContextMenu(event: React.MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.closest("[data-linktag-context-menu], .react-flow__edge")) return;
  event.preventDefault();
}

export function isDialogLayerTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("[data-linktag-dialog-layer]"));
}

export function isContextMenuLayerTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("[data-linktag-context-menu-layer]"));
}
