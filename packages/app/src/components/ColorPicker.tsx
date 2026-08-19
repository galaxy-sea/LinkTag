import { Palette } from "lucide-react";

import { cn } from "@linktag/ui";

import { colorChoices } from "../core/colors";

export function ColorPicker({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("grid gap-2", compact && "grid-cols-[auto_1fr] items-center")} data-ui-name="颜色选择器">
      {!compact ? (
        <div className="flex items-center gap-2 text-sm font-medium">
          <Palette className="h-4 w-4" />
          颜色
        </div>
      ) : null}
      <div className="grid w-40 grid-cols-5 gap-1.5">
        {colorChoices.map((color) => (
          <span
            key={color}
            data-ui-name="内置颜色"
            role="button"
            tabIndex={0}
            aria-label={color}
            aria-pressed={value === color}
            className={cn(
              "block h-6 w-6 rounded-full border border-border ring-offset-2",
              value === color && "ring-2 ring-ring",
            )}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onChange(color);
            }}
          />
        ))}
      </div>
      <input
        type="color"
        data-ui-name="自定义颜色输入"
        className="h-8 w-12 rounded border border-border bg-background p-1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
