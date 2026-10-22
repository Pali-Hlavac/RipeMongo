import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/form-field";
import { Checkbox, Input } from "@/shared/ui/input";

import { useConnections } from "../../api/profiles";
import { pickExportPath, useExportConnections } from "../../api/transfer";
import { exportPasswordProblem } from "../../lib/export-password";

/** Pick connections and whether to include their passwords (encrypted), then save a file. */
export function ExportConnectionsDialog({ onDone }: { onDone: () => void }) {
  const { data: connections = [] } = useConnections();
  const [selected, setSelected] = useState(() => new Set(connections.map((p) => p.id)));
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const exportConnections = useExportConnections();

  const passwordProblem = includeSecrets ? exportPasswordProblem(password, confirmation) : null;
  const canExport = selected.size > 0 && passwordProblem === null;

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const run = async () => {
    const path = await pickExportPath();
    if (!path) return;
    const connectionIds = [...selected];
    exportConnections.mutate(
      { path, connectionIds, password: includeSecrets ? password : null },
      {
        onSuccess: () => {
          toast.success(`Exported ${connectionIds.length} connection(s).`);
          onDone();
        },
      },
    );
  };

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Export connections</DialogTitle>
        <DialogDescription>
          Saves connection settings to a JSON file you can import on another computer.
        </DialogDescription>
      </DialogHeader>
      <fieldset className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-border p-2">
        <legend className="px-1 text-sm font-medium">Connections</legend>
        {connections.map((profile) => (
          <Checkbox
            key={profile.id}
            label={profile.name}
            checked={selected.has(profile.id)}
            onChange={(event) => {
              toggle(profile.id, event.target.checked);
            }}
          />
        ))}
      </fieldset>
      <Checkbox
        label="Include passwords, encrypted with a password"
        checked={includeSecrets}
        onChange={(event) => {
          setIncludeSecrets(event.target.checked);
        }}
      />
      {includeSecrets && (
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Export password" error={password ? passwordProblem : null}>
            {(control) => (
              <Input
                {...control}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
              />
            )}
          </FormField>
          <FormField label="Repeat password">
            {(control) => (
              <Input
                {...control}
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.target.value);
                }}
              />
            )}
          </FormField>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={!canExport || exportConnections.isPending} onClick={() => void run()}>
          Export…
        </Button>
      </div>
    </div>
  );
}
