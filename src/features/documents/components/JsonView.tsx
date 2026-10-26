import { findPrefix } from "../lib/find";
import { toShell } from "../lib/format";
import type { LoadedDocument } from "../types";
import { DocumentActionButtons } from "./actions/DocumentActionButtons";
import { FindText } from "./find/FindText";

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
              <FindText
                text={toShell(document.value)}
                prefix={findPrefix(document.key, "", "json")}
              />
            </pre>
          </li>
        );
      })}
    </ol>
  );
}
