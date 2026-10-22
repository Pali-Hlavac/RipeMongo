import { useId } from "react";

import { cn } from "@/shared/lib/cn";
import { FormField } from "@/shared/ui/form-field";
import { Checkbox, Input, NativeSelect } from "@/shared/ui/input";

import { CONNECTION_COLORS } from "../../lib/colors";
import { suggestName } from "../../lib/defaults";
import type { Scheme } from "../../types";
import { HostsEditor } from "./HostsEditor";
import type { SectionProps } from "./section";

/** Name, organization (folder, color, favorite) and hosts. */
export function GeneralTab({ draft, folders }: SectionProps & { folders: string[] }) {
  const { profile, updateProfile, updateConfig } = draft;
  const { config } = profile;
  const folderListId = useId();

  const changeScheme = (scheme: Scheme) => {
    const first = config.hosts[0] ?? { host: "", port: null };
    updateConfig({
      scheme,
      hosts: scheme === "srv" ? [{ host: first.host, port: null }] : config.hosts,
      directConnection: scheme === "srv" ? null : config.directConnection,
    });
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Name">
          {(control) => (
            <Input
              {...control}
              placeholder={suggestName(config) || "My cluster"}
              value={profile.name}
              onChange={(event) => {
                updateProfile({ name: event.target.value });
              }}
            />
          )}
        </FormField>
        <FormField label="Folder" description="Optional; groups connections in the sidebar.">
          {(control) => (
            <>
              <Input
                {...control}
                list={folderListId}
                value={profile.folder ?? ""}
                onChange={(event) => {
                  updateProfile({ folder: event.target.value || null });
                }}
              />
              <datalist id={folderListId}>
                {folders.map((folder) => (
                  <option key={folder} value={folder} />
                ))}
              </datalist>
            </>
          )}
        </FormField>
      </div>

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mb-1.5 text-sm font-medium">Color label</legend>
        <ColorSwatch
          label="No color"
          className="border border-dashed border-border bg-transparent"
          selected={profile.color === null}
          onSelect={() => {
            updateProfile({ color: null });
          }}
        />
        {CONNECTION_COLORS.map((color) => (
          <ColorSwatch
            key={color.value}
            label={color.label}
            className={color.className}
            selected={profile.color === color.value}
            onSelect={() => {
              updateProfile({ color: color.value });
            }}
          />
        ))}
        <Checkbox
          className="ml-4"
          label="Favorite"
          checked={profile.favorite}
          onChange={(event) => {
            updateProfile({ favorite: event.target.checked });
          }}
        />
      </fieldset>

      <FormField label="Connection type">
        {(control) => (
          <NativeSelect
            {...control}
            value={config.scheme}
            onChange={(event) => {
              changeScheme(event.target.value === "srv" ? "srv" : "standard");
            }}
          >
            <option value="standard">Standard (mongodb://)</option>
            <option value="srv">DNS seed list (mongodb+srv://)</option>
          </NativeSelect>
        )}
      </FormField>
      <HostsEditor
        scheme={config.scheme}
        hosts={config.hosts}
        onChange={(hosts) => {
          updateConfig({ hosts });
        }}
      />
    </div>
  );
}

interface ColorSwatchProps {
  label: string;
  className: string;
  selected: boolean;
  onSelect: () => void;
}

function ColorSwatch({ label, className, selected, onSelect }: ColorSwatchProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onSelect}
      className={cn(
        "size-6 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
        className,
      )}
    />
  );
}
