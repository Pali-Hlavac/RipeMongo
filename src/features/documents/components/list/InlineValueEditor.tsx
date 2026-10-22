import { useEffect, useRef, useState } from "react";

import { cn } from "@/shared/lib/cn";
import { fieldClassName } from "@/shared/ui/input";

import type { BsonValue } from "../../lib/bson";
import { scalarShell } from "../../lib/format";

interface InlineValueEditorProps {
  label: string;
  value: BsonValue;
  /** Resolves when saved; on failure the editor stays open (the error is a toast). */
  onSave: (text: string) => Promise<void>;
  onCancel: () => void;
}

/** One-line editor for a field value in shell syntax; Enter saves, Esc cancels. */
export function InlineValueEditor({ label, value, onSave, onCancel }: InlineValueEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => scalarShell(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(text);
    } catch {
      setSaving(false);
    }
  };

  return (
    <input
      ref={inputRef}
      aria-label={label}
      spellCheck={false}
      autoComplete="off"
      disabled={saving}
      className={cn(fieldClassName, "h-7 min-w-48 flex-1 px-2 py-0 font-mono")}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void save();
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
      onBlur={() => {
        if (!saving) onCancel();
      }}
    />
  );
}
