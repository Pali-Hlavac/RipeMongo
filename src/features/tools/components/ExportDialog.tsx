import { useId, useState } from "react";

import { useToolsInfo } from "@/features/about";
import { useJobsPanel } from "@/features/jobs";
import { InlineError } from "@/shared/components/InlineError";
import { useAfterDialogClose } from "@/shared/hooks/useAfterDialogClose";
import type { ExportFormat } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { pickExportPath, useSampledFields, useStartExport } from "../api/export";
import {
  buildExportRequest,
  exportFileName,
  initialExportValues,
  sampledFields,
  validateExportForm,
  type ExportFormErrors,
  type ExportFormValues,
} from "../lib/export";
import { useExportDialog, type ExportTarget } from "../store/transfer";
import { ExportFieldsField } from "./ExportFieldsField";
import { ExportOptionsFields } from "./ExportOptionsFields";
import { PathField } from "./PathField";
import { SegmentedField } from "./SegmentedField";

const FORMAT_LABELS: Record<ExportFormat, string> = { json: "JSON", csv: "CSV" };
const FORMAT_DESCRIPTIONS: Record<ExportFormat, string> = {
  json: "Keeps types and nested documents; can be imported again as is.",
  csv: "A table for spreadsheets: one row per document, one column per field.",
};

/** Export dialog for a collection or view; mount once at the app root. */
export function ExportDialog() {
  const target = useExportDialog((state) => state.target);
  const close = useExportDialog((state) => state.close);
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {/* Keyed so every opening starts from a fresh form. */}
      {target && <ExportForm key={JSON.stringify(target)} target={target} onDone={close} />}
    </Dialog>
  );
}

function ExportForm({ target, onDone }: { target: ExportTarget; onDone: () => void }) {
  const [values, setValues] = useState(() => initialExportValues(target));
  const [errors, setErrors] = useState<ExportFormErrors>({});
  const formId = useId();
  const closing = useAfterDialogClose();
  const sample = useSampledFields(target.connectionId, target.database, target.collection);
  const startExport = useStartExport();
  const tools = useToolsInfo();
  const missing = tools.data?.tools.some((tool) => tool.tool === "mongoexport" && !tool.version);
  const sampled = sample.data ? sampledFields(sample.data, values.format) : undefined;
  const namespace = `${target.database}.${target.collection}`;
  const change = (patch: Partial<ExportFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setErrors({});
  };

  const browse = async () => {
    const name = values.path.trim() || `${target.collection}.${values.format}`;
    const picked = await pickExportPath(exportFileName(name, values.format), values.format);
    if (picked) change({ path: picked });
  };

  const submit = () => {
    const found = validateExportForm(values, sampled ?? []);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    startExport.mutate(
      {
        connectionId: target.connectionId,
        request: buildExportRequest(target, values, sampled ?? []),
      },
      {
        onSuccess: () => {
          closing.after(() => {
            useJobsPanel.getState().setOpen(true);
          });
          onDone();
        },
      },
    );
  };

  return (
    <DialogContent
      className="flex max-h-[90vh] max-w-lg flex-col"
      onCloseAutoFocus={closing.onCloseAutoFocus}
    >
      <DialogHeader>
        <DialogTitle>Export {namespace}</DialogTitle>
        <DialogDescription>
          Writes the documents to a file with mongoexport. You can keep working while it runs.
        </DialogDescription>
      </DialogHeader>
      <form
        id={formId}
        className="-mx-1 grid min-h-0 gap-4 overflow-auto px-1"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <SegmentedField
          legend="Format"
          name="export-format"
          value={values.format}
          labels={FORMAT_LABELS}
          descriptions={FORMAT_DESCRIPTIONS}
          onChange={(format) => {
            change({ format, path: exportFileName(values.path, format) });
          }}
        />
        <PathField
          label="File"
          path={values.path}
          placeholder="Choose a file…"
          error={errors.path ?? null}
          onChange={(path) => {
            change({ path });
          }}
          onBrowse={() => void browse()}
        />
        <ExportFieldsField
          values={values}
          sampled={sampled}
          loadError={sample.error}
          error={errors.fields ?? null}
          onChange={change}
        />
        <ExportOptionsFields
          values={values}
          errors={errors}
          projection={Boolean(target.query?.projection.trim())}
          onChange={change}
        />
      </form>
      {/* Outside the scrolling form so the buttons and errors always stay visible. */}
      {missing && (
        <InlineError
          error={{
            code: "NOT_FOUND",
            message: "mongoexport is not included in this build of RipeMongo.",
            hint: "Reinstall RipeMongo. If you built it yourself, run `pnpm sidecars` first.",
          }}
        />
      )}
      {startExport.error && <InlineError error={startExport.error} />}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          form={formId}
          disabled={startExport.isPending || missing === true || sample.isPending}
        >
          Start export
        </Button>
      </div>
    </DialogContent>
  );
}
