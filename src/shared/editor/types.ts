/** Props of the shell-syntax code editor (shared by the lazy wrapper and the editor). */

/** A parse error to mark in the editor (1-based line and column). */
export interface EditorError {
  line: number;
  column: number;
  message: string;
}

export interface CodeEditorProps {
  /** Initial text; later edits are reported through `onChange`. */
  value: string;
  onChange: (value: string) => void;
  /** Ctrl/⌘+Enter. */
  onSubmit?: () => void;
  error?: EditorError | null;
  ariaLabel: string;
  className?: string;
}

const POSITION = /\(line (\d+), column (\d+)\)/;

/** Finds "(line 3, column 7)" in a backend parse error, for an editor marker. */
export function editorErrorFrom(message: string): EditorError | null {
  const match = POSITION.exec(message);
  if (!match) return null;
  return { line: Number(match[1]), column: Number(match[2]), message };
}
