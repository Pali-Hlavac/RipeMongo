import { FolderOpenIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";

import type { DumpOutputKind } from "../lib/dump";

const LABELS: Record<DumpOutputKind, string> = {
  folder: "Folder",
  archive: "Single archive file",
};

/** Wording for dumping into a folder or archive; restoring passes its own. */
const SAVE_DESCRIPTIONS: Record<DumpOutputKind, string> = {
  folder: "One folder per database with a file per collection.",
  archive: "Everything in one file, easy to copy or attach.",
};

interface DumpOutputFieldProps {
  kind: DumpOutputKind;
  path: string;
  error: string | null;
  legend?: string;
  descriptions?: Record<DumpOutputKind, string>;
  /** Radio group name; unique per dialog. */
  name?: string;
  onKindChange: (kind: DumpOutputKind) => void;
  onPathChange: (path: string) => void;
  /** Called when the user leaves the path field (a typed path is complete). */
  onPathCommit?: () => void;
  onBrowse: () => void;
}

/** Folder or archive choice and the path, with a native picker. */
export function DumpOutputField({
  kind,
  path,
  error,
  legend = "Save as",
  descriptions = SAVE_DESCRIPTIONS,
  name = "dump-output",
  onKindChange,
  onPathChange,
  onPathCommit,
  onBrowse,
}: DumpOutputFieldProps) {
  const kinds = Object.keys(LABELS) as DumpOutputKind[];
  return (
    <>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          {kinds.map((value) => (
            <label
              key={value}
              className={cn(
                "cursor-pointer rounded-sm px-2 py-1 text-center text-sm text-muted-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                kind === value && "bg-background text-foreground shadow-sm",
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                value={value}
                checked={kind === value}
                onChange={() => {
                  onKindChange(value);
                }}
              />
              {LABELS[value]}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{descriptions[kind]}</p>
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
              onBlur={onPathCommit}
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
