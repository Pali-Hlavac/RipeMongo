import { useEffect, useRef } from "react";

import { cn } from "@/shared/lib/cn";

import { DARK_THEME, LIGHT_THEME, MONGOSH_LANGUAGE, setupMonaco, type monaco } from "./monaco";
import type { CodeEditorProps } from "./types";

const MARKER_OWNER = "ripemongo";

function currentTheme(): string {
  return document.documentElement.classList.contains("dark") ? DARK_THEME : LIGHT_THEME;
}

/**
 * Monaco editor for shell-syntax documents. Uncontrolled after mount (Monaco owns the text);
 * `onChange` reports edits, Ctrl/⌘+Enter calls `onSubmit`. Load it through
 * `LazyCodeEditor` so Monaco is only downloaded when an editor opens.
 */
export default function CodeEditor({
  value,
  onChange,
  onSubmit,
  error,
  ariaLabel,
  className,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  // Latest callbacks without re-creating the editor.
  const callbacks = useRef({ onChange, onSubmit });
  useEffect(() => {
    callbacks.current = { onChange, onSubmit };
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const api = setupMonaco();
    const editor = api.editor.create(container, {
      value,
      language: MONGOSH_LANGUAGE,
      theme: currentTheme(),
      ariaLabel,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 13,
      tabSize: 2,
      wordWrap: "on",
      renderLineHighlight: "line",
      fixedOverflowWidgets: true,
    });
    editorRef.current = editor;
    editor.onDidChangeModelContent(() => {
      callbacks.current.onChange(editor.getValue());
    });
    editor.addCommand(api.KeyMod.CtrlCmd | api.KeyCode.Enter, () => {
      callbacks.current.onSubmit?.();
    });
    editor.focus();
    // Follow the app theme (the `dark` class on <html>).
    const observer = new MutationObserver(() => {
      api.editor.setTheme(currentTheme());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
      editor.getModel()?.dispose();
      editor.dispose();
      editorRef.current = null;
    };
    // The editor is created once; `value` is only the initial text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (!model) return;
    const api = setupMonaco();
    api.editor.setModelMarkers(
      model,
      MARKER_OWNER,
      error
        ? [
            {
              severity: api.MarkerSeverity.Error,
              message: error.message,
              startLineNumber: error.line,
              startColumn: error.column,
              endLineNumber: error.line,
              endColumn: error.column + 1,
            },
          ]
        : [],
    );
    if (error) editorRef.current?.revealLineInCenterIfOutsideViewport(error.line);
  }, [error]);

  return <div ref={containerRef} className={cn("min-h-0 overflow-hidden", className)} />;
}
