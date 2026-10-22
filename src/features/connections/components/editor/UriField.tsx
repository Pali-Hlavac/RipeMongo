import { FormField } from "@/shared/ui/form-field";
import { Textarea } from "@/shared/ui/input";

import { useUriSync } from "../../hooks/useUriSync";
import type { ConnectionDraft } from "../../hooks/useConnectionDraft";

/**
 * Connection string kept in sync with the form. Pasting a URI fills the form; passwords
 * found in it move into the keychain-backed secret fields and are never displayed.
 */
export function UriField({ draft }: { draft: ConnectionDraft }) {
  const { uri, error, onUriChange, onUriBlur } = useUriSync({
    config: draft.profile.config,
    onParsed: draft.applyParsedUri,
  });

  return (
    <FormField
      label="Connection string"
      error={error}
      description="Paste a connection string or use the fields below; both stay in sync. Passwords are stored in the system keychain."
    >
      {(control) => (
        <Textarea
          {...control}
          rows={2}
          spellCheck={false}
          autoComplete="off"
          placeholder="mongodb://localhost:27017"
          value={uri}
          onChange={(event) => {
            onUriChange(event.target.value);
          }}
          onBlur={onUriBlur}
        />
      )}
    </FormField>
  );
}
