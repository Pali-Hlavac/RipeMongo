import { toShell } from "../lib/format";
import type { LoadedDocument } from "../types";
import { DocumentActionButtons } from "./actions/DocumentActionButtons";

/** Documents as mongosh-style text (the same syntax the query bar accepts). */
export function JsonView({ documents }: { documents: LoadedDocument[] }) {
  return (
    <ol aria-label="Documents" className="flex flex-col gap-2 p-3">
      {documents.map((document, index) => {
        return (
          <li
            key={document.key}
            aria-label={`Document ${index + 1}`}
            className="group relative rounded-md border border-border bg-background"
          >
            <DocumentActionButtons document={document} position={index + 1} />
            <pre className="overflow-x-auto px-3 py-2 font-mono text-sm">
              {toShell(document.value)}
            </pre>
          </li>
        );
      })}
    </ol>
  );
}
