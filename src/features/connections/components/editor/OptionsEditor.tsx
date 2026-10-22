import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import type { UriOption } from "../../types";

interface OptionsEditorProps {
  options: UriOption[];
  onChange: (options: UriOption[]) => void;
}

/** Key/value rows for connection-string options without a dedicated field. */
export function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const update = (index: number, patch: Partial<UriOption>) => {
    onChange(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Other options</legend>
      <p className="text-xs text-muted-foreground">
        Any other connection-string option, e.g. <code>retryWrites</code> = <code>false</code>.
      </p>
      {options.map((option, index) => (
        // Index keys are fine: rows have no identity besides their position.
        <div key={index} className="flex gap-2">
          <Input
            aria-label={`Option ${index + 1} name`}
            placeholder="name"
            className="font-mono"
            value={option.key}
            onChange={(event) => {
              update(index, { key: event.target.value });
            }}
          />
          <Input
            aria-label={`Option ${index + 1} value`}
            placeholder="value"
            className="font-mono"
            value={option.value}
            onChange={(event) => {
              update(index, { value: event.target.value });
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={`Remove option ${index + 1}`}
            onClick={() => {
              onChange(options.filter((_, i) => i !== index));
            }}
          >
            <Trash2Icon aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => {
          onChange([...options, { key: "", value: "" }]);
        }}
      >
        <PlusIcon aria-hidden />
        Add option
      </Button>
    </fieldset>
  );
}
