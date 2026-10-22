import { useState } from "react";

import type { LoadedDocument } from "../../types";
import { CurrentDocumentContext } from "../actions/context";
import { DocumentActionButtons } from "../actions/DocumentActionButtons";
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
      <DocumentActionButtons document={document} position={position} />
      <CurrentDocumentContext.Provider value={document}>
        <ul>
          {visible.map(([name, value]) => (
            <FieldRow key={name} name={name} path={name} value={value} depth={0} />
          ))}
        </ul>
      </CurrentDocumentContext.Provider>
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
