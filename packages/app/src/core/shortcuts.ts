export function normalizeShortcutKey(key: string) {
  if (key === " ") return "Space";
  if (key.length === 1) return key.toUpperCase();
  const aliases: Record<string, string> = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Esc: "Escape",
  };
  return aliases[key] ?? key;
}

export function shortcutKeyFromKeyboardEvent(event: Pick<KeyboardEvent, "key" | "code">) {
  if (event.code.startsWith("Key")) return event.code.slice(3).toUpperCase();
  if (event.code.startsWith("Digit")) return event.code.slice(5);
  if (event.code.startsWith("Numpad")) return event.code.replace("Numpad", "Num");
  if (event.code === "Space") return "Space";
  return normalizeShortcutKey(event.key);
}

export function shortcutFromKeyboardEvent(
  event: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">,
) {
  const key = shortcutKeyFromKeyboardEvent(event);
  if (["Control", "Alt", "Shift", "Meta"].includes(key)) return "";
  const parts = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  parts.push(key);
  return parts.join("+");
}

export function isMacPlatform() {
  const userAgentData = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = userAgentData.userAgentData?.platform || navigator.platform || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

export function shortcutEventMatchesPart(part: string, event: KeyboardEvent) {
  if (part === "Ctrl") return event.ctrlKey;
  if (part === "Alt") return event.altKey;
  if (part === "Shift") return event.shiftKey;
  if (part === "Meta") return event.metaKey;
  if (part === "Mod") return isMacPlatform() ? event.metaKey : event.ctrlKey;
  return shortcutKeyFromKeyboardEvent(event) === part;
}

export function shortcutMatchesEvent(shortcut: string, event: KeyboardEvent) {
  const parts = shortcut.split("+").filter(Boolean);
  if (!parts.length) return false;
  const wantsCtrl = parts.includes("Ctrl") || (!isMacPlatform() && parts.includes("Mod"));
  const wantsMeta = parts.includes("Meta") || (isMacPlatform() && parts.includes("Mod"));
  const wantsAlt = parts.includes("Alt");
  const wantsShift = parts.includes("Shift");
  if (event.ctrlKey !== wantsCtrl) return false;
  if (event.metaKey !== wantsMeta) return false;
  if (event.altKey !== wantsAlt) return false;
  if (event.shiftKey !== wantsShift) return false;
  return parts.every((part) => shortcutEventMatchesPart(part, event));
}

export function normalizeRecordedShortcut(shortcut: string) {
  const parts = shortcut.split("+").filter(Boolean);
  if (parts.length === 2 && (parts[0] === "Ctrl" || parts[0] === "Meta")) return `Mod+${parts[1]}`;
  return shortcut;
}

export function displayShortcut(shortcut: string) {
  const displayParts = shortcut.split("+").map((part) => {
    if (part === "Mod") return isMacPlatform() ? "⌘" : "Ctrl";
    if (part === "Meta") return isMacPlatform() ? "⌘" : "Meta";
    if (part === "Alt") return isMacPlatform() ? "Option" : "Alt";
    return part;
  });
  return isMacPlatform() ? displayParts.join("") : displayParts.join("+");
}
