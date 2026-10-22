import { CopyIcon } from "lucide-react";
import { useState } from "react";

import { copyText } from "@/shared/lib/clipboard";
import { Button } from "@/shared/ui/button";

import { toShell } from "../../lib/format";
import type { LoadedDocument } from "../../types";
import { FieldRow } from "./FieldRow";

/** Top-level fields shown before "Show more"; very wide documents stay readable. */
const INITIAL_FIELDS = 25;

/** Documents as cards with expandable fields. */
export function DocumentListView({ documents }: { documents: LoadedDocument[] }) {
  return (
    <ol aria-label="Documents" className="flex flex-col gap-2 p-3">
      {documents.map((document, index) => (
        <DocumentCard key={document.key} document={document} position={index + 1} />
      ))}
    </ol>
  );
}

function DocumentCard({ document, position }: { document: LoadedDocument; position: number }) {
  const [showAll, setShowAll] = useState(false);
  const { fields } = document.value;
  const visible = showAll ? fields : fields.slice(0, INITIAL_FIELDS);
  const hidden = fields.length - visible.length;

  return (
    <li
      aria-label={`Document ${position}`}
      className="group relative rounded-md border border-border bg-background px-3 py-2 text-sm"
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 right-1 size-7 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
        aria-label={`Copy document ${position}`}
        onClick={() => void copyText(toShell(document.value), "Document")}
      >
        <CopyIcon aria-hidden />
      </Button>
      <ul>
        {visible.map(([name, value]) => (
          <FieldRow key={name} name={name} value={value} depth={0} />
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          className="mt-1 ml-5 rounded-sm text-xs text-muted-foreground underline outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            setShowAll(true);
          }}
        >
          Show {hidden} more {hidden === 1 ? "field" : "fields"}
        </button>
      )}
    </li>
  );
}
