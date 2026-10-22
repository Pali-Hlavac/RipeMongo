import { FolderOpenIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";

import type { DumpOutputKind } from "../lib/dump";

const KINDS: { value: DumpOutputKind; label: string; description: string }[] = [
  {
    value: "folder",
    label: "Folder",
    description: "One folder per database with a file per collection.",
  },
  {
    value: "archive",
    label: "Single archive file",
    description: "Everything in one file, easy to copy or attach.",
  },
];

interface DumpOutputFieldProps {
  kind: DumpOutputKind;
  path: string;
  error: string | null;
  onKindChange: (kind: DumpOutputKind) => void;
  onPathChange: (path: string) => void;
  onBrowse: () => void;
}

/** "Save as" choice (folder or archive) and the destination path with a native picker. */
export function DumpOutputField({
  kind,
  path,
  error,
  onKindChange,
  onPathChange,
  onBrowse,
}: DumpOutputFieldProps) {
  const selected = KINDS.find((option) => option.value === kind);
  return (
    <>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Save as</legend>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          {KINDS.map((option) => (
            <label
              key={option.value}
              className={cn(
                "cursor-pointer rounded-sm px-2 py-1 text-center text-sm text-muted-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                kind === option.value && "bg-background text-foreground shadow-sm",
              )}
            >
              <input
                type="radio"
                name="dump-output"
                className="sr-only"
                value={option.value}
                checked={kind === option.value}
                onChange={() => {
                  onKindChange(option.value);
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{selected?.description}</p>
      </fieldset>
      <FormField label={kind === "folder" ? "Folder" : "Archive file"} error={error}>
        {(control) => (
          <div className="flex gap-2">
            <Input
              {...control}
              className="font-mono"
              spellCheck={false}
              placeholder={kind === "folder" ? "Choose a folder…" : "Choose a file…"}
              value={path}
              onChange={(event) => {
                onPathChange(event.target.value);
              }}
            />
            <Button type="button" variant="outline" className="h-9" onClick={onBrowse}>
              <FolderOpenIcon aria-hidden />
              Browse…
            </Button>
          </div>
        )}
      </FormField>
    </>
  );
}
