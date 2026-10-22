import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { FormField } from "@/shared/ui/form-field";
import { Input, NativeSelect, Textarea } from "@/shared/ui/input";

import { useCollections } from "../../api/queries";
import type { DraftErrors, NewCollectionDraft, NewCollectionKind } from "../../lib/new-collection";
import type { TimeSeriesGranularity } from "../../types";

const KINDS: { value: NewCollectionKind; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "capped", label: "Capped" },
  { value: "timeSeries", label: "Time series" },
  { value: "view", label: "View" },
];

/** Segmented radio group choosing what to create. */
export function KindPicker({
  value,
  onChange,
}: {
  value: NewCollectionKind;
  onChange: (kind: NewCollectionKind) => void;
}) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">Type</legend>
      <div className="grid grid-cols-4 gap-1 rounded-md bg-muted p-1">
        {KINDS.map((kind) => (
          <label
            key={kind.value}
            className={cn(
              "cursor-pointer rounded-sm px-2 py-1 text-center text-sm text-muted-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              value === kind.value && "bg-background text-foreground shadow-sm",
            )}
          >
            <input
              type="radio"
              name="collection-kind"
              className="sr-only"
              value={kind.value}
              checked={value === kind.value}
              onChange={() => {
                onChange(kind.value);
              }}
            />
            {kind.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Draft fields edited with a plain text input. */
type TextField =
  "cappedSizeMb" | "cappedMaxDocuments" | "timeField" | "metaField" | "expireAfterSeconds";

interface KindFieldsProps {
  connectionId: string;
  database: string;
  draft: NewCollectionDraft;
  errors: DraftErrors;
  onChange: (patch: Partial<NewCollectionDraft>) => void;
}

/** The extra settings of capped collections, time-series collections and views. */
export function CollectionKindFields({
  connectionId,
  database,
  draft,
  errors,
  onChange,
}: KindFieldsProps) {
  const text = (field: TextField, label: string, description?: ReactNode) => (
    <FormField label={label} description={description} error={errors[field]}>
      {(control) => (
        <Input
          {...control}
          autoComplete="off"
          spellCheck={false}
          value={draft[field]}
          onChange={(event) => {
            onChange({ [field]: event.target.value });
          }}
        />
      )}
    </FormField>
  );

  switch (draft.kind) {
    case "standard":
      return null;
    case "capped":
      return (
        <div className="grid grid-cols-2 gap-4">
          {text("cappedSizeMb", "Maximum size (MB)", "Oldest documents are removed beyond this.")}
          {text("cappedMaxDocuments", "Maximum documents", "Optional.")}
        </div>
      );
    case "timeSeries":
      return (
        <div className="grid grid-cols-2 gap-4">
          {text("timeField", "Time field", "Holds each measurement's date.")}
          {text("metaField", "Meta field", "Optional. Identifies the source, e.g. a sensor.")}
          <FormField label="Granularity">
            {(control) => (
              <NativeSelect
                {...control}
                value={draft.granularity}
                onChange={(event) => {
                  onChange({ granularity: event.target.value as TimeSeriesGranularity | "" });
                }}
              >
                <option value="">Server default</option>
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </NativeSelect>
            )}
          </FormField>
          {text("expireAfterSeconds", "Expire after (seconds)", "Optional. Deletes old data.")}
        </div>
      );
    case "view":
      return (
        <ViewFields
          connectionId={connectionId}
          database={database}
          draft={draft}
          errors={errors}
          onChange={onChange}
        />
      );
  }
}

function ViewFields({ connectionId, database, draft, errors, onChange }: KindFieldsProps) {
  const { data: collections = [] } = useCollections(connectionId, database);
  return (
    <>
      <FormField label="Source collection" error={errors.viewOn}>
        {(control) => (
          <NativeSelect
            {...control}
            value={draft.viewOn}
            onChange={(event) => {
              onChange({ viewOn: event.target.value });
            }}
          >
            <option value="">Choose…</option>
            {collections.map((collection) => (
              <option key={collection.name} value={collection.name}>
                {collection.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField
        label="Pipeline"
        description="An aggregation pipeline in JSON or shell syntax. Leave it empty to show every document."
      >
        {(control) => (
          <Textarea
            {...control}
            rows={6}
            spellCheck={false}
            value={draft.pipeline}
            onChange={(event) => {
              onChange({ pipeline: event.target.value });
            }}
          />
        )}
      </FormField>
    </>
  );
}
