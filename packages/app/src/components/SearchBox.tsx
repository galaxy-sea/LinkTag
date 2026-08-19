import { Button, Input, Popover, PopoverAnchor, PopoverContent, cn } from "@linktag/ui";
import { Search } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { shortcutMatchesEvent } from "../core/shortcuts";
import type { Id, TagRecord, TagRelationRecord } from "../types";

type SearchSuggestion =
  | { kind: "directive"; token: "@Tag" | "@Link"; label: string; description: string }
  | { kind: "tag"; id: Id; value: string; label: string; description: string; color: string }
  | { kind: "relation"; id: Id; value: string; label: string; description: string };

export function SearchBox({
  value,
  onChange,
  tags,
  relations,
  shortcut,
}: {
  value: string;
  onChange: (value: string) => void;
  tags: TagRecord[];
  relations: TagRelationRecord[];
  shortcut: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [cursorIndex, setCursorIndex] = useState(value.length);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const restoreFocusRef = useRef(false);
  const restoreCursorRef = useRef<number | null>(null);
  const directiveSuggestions = useMemo<SearchSuggestion[]>(
    () => [
      { kind: "directive", token: "@Tag", label: "@Tag", description: "标签" },
      { kind: "directive", token: "@Link", label: "@Link", description: "关系" },
    ],
    [],
  );
  const tagsById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);

  const tokenRange = useMemo(() => {
    const safeCursor = Math.min(cursorIndex, value.length);
    const beforeCursor = value.slice(0, safeCursor);
    const tokenStart =
      Math.max(beforeCursor.lastIndexOf(" "), beforeCursor.lastIndexOf("\t"), beforeCursor.lastIndexOf("\n")) + 1;
    const nextWhitespace = value.slice(safeCursor).search(/\s/);
    const tokenEnd = nextWhitespace === -1 ? value.length : safeCursor + nextWhitespace;
    return { start: tokenStart, end: tokenEnd, value: value.slice(tokenStart, tokenEnd) };
  }, [cursorIndex, value]);

  const suggestionContext = useMemo(() => {
    const token = tokenRange.value;
    const tokenBeforeCursor = value.slice(tokenRange.start, Math.min(cursorIndex, tokenRange.end));
    const inlineDirective = /^@(tag|link)(:|=)(.*)$/i.exec(token);
    if (inlineDirective) {
      return {
        type: inlineDirective[1].toLowerCase() as "tag" | "link",
        query: inlineDirective[3].toLowerCase(),
        replaceStart: tokenRange.start + inlineDirective[0].length - inlineDirective[3].length,
        replaceEnd: tokenRange.end,
      };
    }

    if (/^@tag$/i.test(token)) {
      return { type: "tag" as const, query: "", replaceStart: tokenRange.end, replaceEnd: tokenRange.end };
    }
    if (/^@link$/i.test(token)) {
      return { type: "link" as const, query: "", replaceStart: tokenRange.end, replaceEnd: tokenRange.end };
    }
    if (token.startsWith("@")) {
      return {
        type: "directive" as const,
        query: token.toLowerCase(),
        replaceStart: tokenRange.start,
        replaceEnd: tokenRange.end,
      };
    }

    const previousToken = value.slice(0, tokenRange.start).trimEnd().split(/\s+/).filter(Boolean).at(-1) ?? "";
    const previousDirective = /^@(tag|link)$/i.exec(previousToken);
    if (previousDirective) {
      const segmentStart = tokenBeforeCursor.lastIndexOf(",") + 1;
      return {
        type: previousDirective[1].toLowerCase() as "tag" | "link",
        query: tokenBeforeCursor.slice(segmentStart).trim().toLowerCase(),
        replaceStart: tokenRange.start + segmentStart,
        replaceEnd: tokenRange.end,
      };
    }

    return { type: "directive" as const, query: "", replaceStart: tokenRange.start, replaceEnd: tokenRange.end };
  }, [cursorIndex, tokenRange.end, tokenRange.start, tokenRange.value, value]);

  const visibleSuggestions = useMemo(() => {
    if (suggestionContext.type === "directive") {
      return directiveSuggestions.filter(
        (suggestion) =>
          suggestion.kind === "directive" && suggestion.token.toLowerCase().startsWith(suggestionContext.query),
      );
    }
    if (suggestionContext.type === "tag") {
      return tags
        .filter((tag) => !suggestionContext.query || tag.name.toLowerCase().includes(suggestionContext.query))
        .slice(0, 10)
        .map<SearchSuggestion>((tag) => ({
          kind: "tag",
          id: tag.id,
          value: tag.name,
          label: tag.name,
          description: "标签",
          color: tag.color,
        }));
    }
    return relations
      .filter((relation) => !suggestionContext.query || relation.name.toLowerCase().includes(suggestionContext.query))
      .slice(0, 10)
      .map<SearchSuggestion>((relation) => {
        const source = tagsById.get(relation.sourceTagId)?.name;
        const target = tagsById.get(relation.targetTagId)?.name;
        return {
          kind: "relation",
          id: relation.id,
          value: relation.name,
          label: relation.name,
          description: source && target ? `${source} - ${target}` : "关系",
        };
      });
  }, [directiveSuggestions, relations, suggestionContext.query, suggestionContext.type, tags, tagsById]);

  const insertText = (text: string, replaceStart: number, replaceEnd: number, trailing = " ", keepOpen = false) => {
    const before = value.slice(0, replaceStart);
    const after = value.slice(replaceEnd);
    const prefix = before.length > 0 && !/[\s,:=]$/.test(before) ? " " : "";
    const suffix = after.length > 0 && !/^\s|^,/.test(after) ? " " : "";
    const inserted = `${prefix}${text}${trailing}`;
    const nextValue = `${before}${inserted}${suffix}${after}`;
    const nextCursor = before.length + inserted.length;
    restoreFocusRef.current = true;
    restoreCursorRef.current = nextCursor;
    onChange(nextValue);
    setCursorIndex(nextCursor);
    setActiveIndex(null);
    setOpen(keepOpen);
  };

  useEffect(() => {
    if (activeIndex !== null && activeIndex >= visibleSuggestions.length) setActiveIndex(null);
  }, [activeIndex, visibleSuggestions.length]);

  const updateCursorIndex = () => {
    setCursorIndex(inputRef.current?.selectionStart ?? value.length);
  };

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if (!shortcut || event.defaultPrevented || event.repeat || event.isComposing) return;
      if (event.target instanceof HTMLElement && event.target.closest("[data-shortcut-recorder]")) return;
      if (!shortcutMatchesEvent(shortcut, event)) return;
      event.preventDefault();
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
      setCursorIndex(value.length);
      setActiveIndex(null);
      setOpen(true);
    };
    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, [shortcut, value.length]);

  const insertSuggestion = (suggestion: SearchSuggestion) => {
    if (suggestion.kind === "directive") {
      insertText(suggestion.token, suggestionContext.replaceStart, suggestionContext.replaceEnd, " ", true);
      return;
    }
    insertText(suggestion.value, suggestionContext.replaceStart, suggestionContext.replaceEnd, ",", true);
  };

  const onSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current === null ? 0 : (current + 1) % Math.max(visibleSuggestions.length, 1)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        current === null
          ? visibleSuggestions.length - 1
          : (current - 1 + visibleSuggestions.length) % Math.max(visibleSuggestions.length, 1),
      );
      return;
    }
    if (event.key === "Enter" && open && activeIndex !== null && visibleSuggestions.length > 0) {
      event.preventDefault();
      insertSuggestion(visibleSuggestions[activeIndex] ?? visibleSuggestions[0]);
      return;
    }
    if (event.key === "Escape") setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-full min-w-0" data-ui-name="搜索区域">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            data-ui-name="全局搜索框"
            className="pl-8"
            value={value}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onChange(event.target.value);
              setCursorIndex(event.target.selectionStart ?? event.target.value.length);
              setActiveIndex(null);
              setOpen(true);
            }}
            onClick={() => {
              updateCursorIndex();
              setActiveIndex(null);
              setOpen(true);
            }}
            onFocus={() => {
              updateCursorIndex();
              setActiveIndex(null);
              setOpen(true);
            }}
            onKeyDown={onSearchKeyDown}
            onKeyUp={updateCursorIndex}
            onSelect={updateCursorIndex}
            placeholder="搜索 @Tag / @Link"
          />
        </div>
      </PopoverAnchor>
      {visibleSuggestions.length > 0 ? (
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-72 rounded-lg p-1"
          data-ui-name="搜索提示下拉"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            if (!restoreFocusRef.current) return;
            event.preventDefault();
            const nextCursor = restoreCursorRef.current;
            restoreFocusRef.current = false;
            restoreCursorRef.current = null;
            window.requestAnimationFrame(() => {
              inputRef.current?.focus({ preventScroll: true });
              if (nextCursor !== null) inputRef.current?.setSelectionRange(nextCursor, nextCursor);
            });
          }}
        >
          <div className="grid gap-0.5" data-ui-name="搜索提示列表">
            {visibleSuggestions.map((suggestion, index) => (
              <Button
                key={suggestion.kind === "directive" ? suggestion.token : suggestion.id}
                className={cn(
                  "h-9 w-full justify-start gap-2 rounded-md px-2.5 text-left",
                  activeIndex === index && "bg-accent text-accent-foreground",
                )}
                data-ui-name="搜索提示选项"
                variant="ghost"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => insertSuggestion(suggestion)}
              >
                {suggestion.kind === "tag" ? (
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: suggestion.color }} />
                ) : (
                  <Search className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{suggestion.label}</span>
                  <span className="ml-2 text-muted-foreground">{suggestion.description}</span>
                </span>
              </Button>
            ))}
          </div>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
