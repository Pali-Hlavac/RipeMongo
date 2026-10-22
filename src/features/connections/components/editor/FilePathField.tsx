import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpenIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";

interface FilePathFieldProps {
  label: string;
  value: string | null;
  onChange: (path: string | null) => void;
  description?: string;
  /** Extensions offered by the file dialog, e.g. `["pem", "crt"]`. */
  extensions?: string[];
}

/** Path input with a native "Browse…" picker. Empty input means "not set". */
export function FilePathField({
  label,
  value,
  onChange,
  description,
  extensions,
}: FilePathFieldProps) {
  const browse = async () => {
    const filters = extensions ? [{ name: label, extensions }] : undefined;
    const picked = await open({ multiple: false, directory: false, filters });
    if (picked) onChange(picked);
  };

  return (
    <FormField label={label} description={description}>
      {(control) => (
        <div className="flex gap-2">
          <Input
            {...control}
            className="font-mono"
            spellCheck={false}
            value={value ?? ""}
            onChange={(event) => {
              onChange(event.target.value === "" ? null : event.target.value);
            }}
          />
          <Button type="button" variant="outline" className="h-9" onClick={() => void browse()}>
            <FolderOpenIcon aria-hidden />
            Browse…
          </Button>
        </div>
      )}
    </FormField>
  );
}
