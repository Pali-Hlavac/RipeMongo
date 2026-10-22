import { useToolsInfo } from "../api/toolsInfo";
import { summarizeTools } from "../lib/tools";

/** "MongoDB tools" row of the About dialog; checks the bundled binaries when first shown. */
export function ToolsVersion() {
  const { data, isPending, isError } = useToolsInfo();
  let value: string;
  if (isPending) value = "Checking…";
  else if (isError) value = "Could not check";
  else {
    const { version, missing } = summarizeTools(data);
    if (version === null) value = "Not included in this build";
    else if (missing.length > 0) value = `${version} (missing: ${missing.join(", ")})`;
    else value = version;
  }

  return (
    <>
      <dt className="text-muted-foreground">MongoDB tools</dt>
      <dd className="font-mono">{value}</dd>
    </>
  );
}
