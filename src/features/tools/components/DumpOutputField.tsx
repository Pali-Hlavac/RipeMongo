import type { DumpOutputKind } from "../lib/dump";
import { PathField } from "./PathField";
import { SegmentedField } from "./SegmentedField";

const LABELS: Record<DumpOutputKind, string> = {
  folder: "Folder",
  archive: "Single archive file",
};

/** Wording for dumping into a folder or archive; restoring passes its own. */
const SAVE_DESCRIPTIONS: Record<DumpOutputKind, string> = {
  folder: "One folder per database with a file per collection.",
  archive: "Everything in one file, easy to copy or attach.",
};

interface DumpOutputFieldProps {
  kind: DumpOutputKind;
  path: string;
  error: string | null;
  legend?: string;
  descriptions?: Record<DumpOutputKind, string>;
  /** Radio group name; unique per dialog. */
  name?: string;
  onKindChange: (kind: DumpOutputKind) => void;
  onPathChange: (path: string) => void;
  /** Called when the user leaves the path field (a typed path is complete). */
  onPathCommit?: () => void;
  onBrowse: () => void;
}

/** Folder or archive choice and the path, with a native picker. */
export function DumpOutputField({
  kind,
  path,
  error,
  legend = "Save as",
  descriptions = SAVE_DESCRIPTIONS,
  name = "dump-output",
  onKindChange,
  onPathChange,
  onPathCommit,
  onBrowse,
}: DumpOutputFieldProps) {
  return (
    <>
      <SegmentedField
        legend={legend}
        name={name}
        value={kind}
        labels={LABELS}
        descriptions={descriptions}
        onChange={onKindChange}
      />
      <PathField
        label={kind === "folder" ? "Folder" : "Archive file"}
        path={path}
        placeholder={kind === "folder" ? "Choose a folder…" : "Choose a file…"}
        error={error}
        onChange={onPathChange}
        onCommit={onPathCommit}
        onBrowse={onBrowse}
      />
    </>
  );
}
