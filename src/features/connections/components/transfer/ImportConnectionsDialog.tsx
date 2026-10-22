import { FileInputIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { toIpcError } from "@/shared/ipc/client";
import { Button } from "@/shared/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";

import { inspectConnectionsFile, pickImportPath, useImportConnections } from "../../api/transfer";
import type { ConnectionsFileInfo } from "../../types";

interface PickedFile {
  path: string;
  info: ConnectionsFileInfo;
}

/** Choose an exported file, optionally unlock its passwords, and import it. */
export function ImportConnectionsDialog({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const importConnections = useImportConnections();

  const choose = async () => {
    const path = await pickImportPath();
    if (!path) return;
    try {
      setFile({ path, info: await inspectConnectionsFile(path) });
      setProblem(null);
    } catch (error) {
      setFile(null);
      setProblem(toIpcError(error).message);
    }
  };

  const run = () => {
    if (!file) return;
    importConnections.mutate(
      { path: file.path, password: password === "" ? null : password },
      {
        onSuccess: (summary) => {
          const secrets = summary.secretsImported ? " with passwords" : "";
          toast.success(`Imported ${summary.imported} connection(s)${secrets}.`);
          onDone();
        },
      },
    );
  };

  const importError = importConnections.error ? toIpcError(importConnections.error) : null;
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Import connections</DialogTitle>
        <DialogDescription>
          Adds the connections from a RipeMongo export file. Existing connections are kept.
        </DialogDescription>
      </DialogHeader>
      <Button variant="outline" className="justify-self-start" onClick={() => void choose()}>
        <FileInputIcon aria-hidden /> Choose file…
      </Button>
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      {file && (
        <div className="grid gap-3 rounded-md border border-border p-3 text-sm">
          <p className="font-mono break-all">{file.path}</p>
          <p>{file.info.connectionCount} connection(s) found.</p>
          {file.info.hasEncryptedSecrets && (
            <FormField
              label="Export password"
              description="Enter it to import the saved passwords too, or leave empty to import without them."
              error={importError?.message ?? null}
            >
              {(control) => (
                <Input
                  {...control}
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                  }}
                />
              )}
            </FormField>
          )}
        </div>
      )}
      {importError && !file?.info.hasEncryptedSecrets && (
        <p role="alert" className="text-sm text-destructive">
          {importError.message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={!file || importConnections.isPending} onClick={run}>
          Import
        </Button>
      </div>
    </div>
  );
}
