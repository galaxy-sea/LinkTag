import { Button, Input } from "@linktag/ui";
import { type KeyboardEvent as ReactKeyboardEvent, useState } from "react";

import { displayShortcut, normalizeRecordedShortcut, shortcutFromKeyboardEvent } from "../core/shortcuts";

export function ShortcutRecorder({
  id,
  value,
  onChange,
  defaultValue,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  defaultValue: string;
}) {
  const [recording, setRecording] = useState(false);

  const recordShortcut = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Backspace" || event.key === "Delete") {
      onChange(defaultValue);
      setRecording(false);
      return;
    }
    const nextShortcut = shortcutFromKeyboardEvent(event.nativeEvent);
    if (!nextShortcut) return;
    onChange(normalizeRecordedShortcut(nextShortcut));
    setRecording(false);
  };

  return (
    <div className="flex items-center gap-2" data-ui-name="快捷键录入器">
      <Input
        id={id}
        data-ui-name="快捷键输入框"
        data-shortcut-recorder
        readOnly
        value={recording ? "按下快捷键" : displayShortcut(value)}
        onFocus={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={recordShortcut}
      />
      <Button data-ui-name="快捷键恢复默认按钮" type="button" variant="outline" onClick={() => onChange(defaultValue)}>
        恢复
      </Button>
    </div>
  );
}
