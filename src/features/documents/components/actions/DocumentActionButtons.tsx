import { CopyIcon, CopyPlusIcon, PencilIcon, Trash2Icon, type LucideIcon } from "lucide-react";

import { copyText } from "@/shared/lib/clipboard";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import { toShell } from "../../lib/format";
import { documentId } from "../../lib/identity";
import type { LoadedDocument } from "../../types";
import { useDocumentActions } from "./context";

const PROJECTED_HINT = "Clear the projection to edit or clone whole documents";

/** Copy / edit / clone / delete buttons shown on hover over a document card. */
export function DocumentActionButtons({
  document,
  position,
}: {
  document: LoadedDocument;
  position: number;
}) {
  const actions = useDocumentActions();
  const hasId = documentId(document) !== null;
  const writable = !actions.readOnly && hasId;
  const whole = writable && !actions.projected;

  return (
    <div className="absolute top-1 right-1 flex gap-0.5 rounded-md bg-background opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
      <ActionButton
        icon={CopyIcon}
        label={`Copy document ${position}`}
        tooltip="Copy"
        onClick={() => void copyText(toShell(document.value), "Document")}
      />
      {writable && (
        <>
          <ActionButton
            icon={PencilIcon}
            label={`Edit document ${position}`}
            tooltip={whole ? "Edit" : PROJECTED_HINT}
            disabled={!whole}
            onClick={() => {
              actions.edit(document);
            }}
          />
          <ActionButton
            icon={CopyPlusIcon}
            label={`Clone document ${position}`}
            tooltip={whole ? "Clone" : PROJECTED_HINT}
            disabled={!whole}
            onClick={() => {
              actions.clone(document);
            }}
          />
          <ActionButton
            icon={Trash2Icon}
            label={`Delete document ${position}`}
            tooltip="Delete"
            onClick={() => {
              actions.remove(document);
            }}
          />
        </>
      )}
    </div>
  );
}

interface ActionButtonProps {
  icon: LucideIcon;
  label: string;
  tooltip: string;
  disabled?: boolean;
  onClick: () => void;
}

function ActionButton({
  icon: Icon,
  label,
  tooltip,
  disabled = false,
  onClick,
}: ActionButtonProps) {
  return (
    <Tooltip content={tooltip}>
      {/* A wrapper keeps the tooltip working on disabled buttons. */}
      <span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          <Icon aria-hidden />
        </Button>
      </span>
    </Tooltip>
  );
}
