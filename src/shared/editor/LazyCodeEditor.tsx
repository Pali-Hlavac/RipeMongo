import { lazy, Suspense } from "react";

import { LoadingState } from "@/shared/components/LoadingState";
import { cn } from "@/shared/lib/cn";

import type { CodeEditorProps } from "./types";

const CodeEditor = lazy(() => import("./CodeEditor"));

/** The code editor, downloading Monaco on first use. */
export function LazyCodeEditor(props: CodeEditorProps) {
  return (
    <Suspense
      fallback={
        <LoadingState
          label="Loading editor…"
          className={cn("border border-border", props.className)}
        />
      }
    >
      <CodeEditor {...props} />
    </Suspense>
  );
}
