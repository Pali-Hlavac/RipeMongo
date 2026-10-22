import { useId } from "react";

import { cn } from "@/shared/lib/cn";
import { Input } from "@/shared/ui/input";

interface BulkFilterFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter runs the preview. */
  onSubmit: () => void;
  invalid: boolean;
}

/** One-line filter of a bulk dialog; empty means every document. */
export function BulkFilterField({ value, onChange, onSubmit, invalid }: BulkFilterFieldProps) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        Filter
      </label>
      <Input
        id={id}
        value={value}
        spellCheck={false}
        autoComplete="off"
        placeholder="{ } (every document)"
        aria-invalid={invalid}
        className={cn("font-mono", invalid && "border-destructive")}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
    </div>
  );
}
