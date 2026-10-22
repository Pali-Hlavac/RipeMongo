import { CopyIcon } from "lucide-react";

import { copyText } from "@/shared/lib/clipboard";
import { Button } from "@/shared/ui/button";

import { toShell } from "../lib/format";
import type { LoadedDocument } from "../types";

/** Documents as mongosh-style text (the same syntax the query bar accepts). */
export function JsonView({ documents }: { documents: LoadedDocument[] }) {
  return (
    <ol aria-label="Documents" className="flex flex-col gap-2 p-3">
      {documents.map((document, index) => {
        const text = toShell(document.value);
        return (
          <li
            key={document.key}
            aria-label={`Document ${index + 1}`}
            className="group relative rounded-md border border-border bg-background"
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 size-7 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
              aria-label={`Copy document ${index + 1}`}
              onClick={() => void copyText(text, "Document")}
            >
              <CopyIcon aria-hidden />
            </Button>
            <pre className="overflow-x-auto px-3 py-2 font-mono text-sm">{text}</pre>
          </li>
        );
      })}
    </ol>
  );
}
