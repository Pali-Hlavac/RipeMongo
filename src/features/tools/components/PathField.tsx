import { FolderOpenIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";

interface PathFieldProps {
  label: string;
  path: string;
  placeholder: string;
  error: string | null;
  description?: string;
  onChange: (path: string) => void;
  /** Called when the user leaves the field (a typed path is complete). */
  onCommit?: () => void;
  onBrowse: () => void;
}

/** A file or folder path that can be typed or chosen with a native picker. */
export function PathField({
  label,
  path,
  placeholder,
  error,
  description,
  onChange,
  onCommit,
  onBrowse,
}: PathFieldProps) {
  return (
    <FormField label={label} error={error} description={description}>
      {(control) => (
        <div className="flex gap-2">
          <Input
            {...control}
            className="font-mono"
            spellCheck={false}
            placeholder={placeholder}
            value={path}
            onChange={(event) => {
              onChange(event.target.value);
            }}
            onBlur={onCommit}
          />
          <Button type="button" variant="outline" className="h-9" onClick={onBrowse}>
            <FolderOpenIcon aria-hidden />
            Browse…
          </Button>
        </div>
      )}
    </FormField>
  );
}
