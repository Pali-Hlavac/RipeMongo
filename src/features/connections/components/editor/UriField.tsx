import { FormField } from "@/shared/ui/form-field";
import { Textarea } from "@/shared/ui/input";

import type { UriSync } from "../../hooks/useUriSync";

/**
 * Connection string kept in sync with the form. Pasting a URI fills the form; passwords
 * found in it move into the keychain-backed secret fields and are never displayed.
 */
export function UriField({ sync }: { sync: UriSync }) {
  return (
    <FormField
      label="Connection string"
      error={sync.error}
      description="Paste a connection string or use the fields below; both stay in sync. Passwords are stored in the system keychain."
    >
      {(control) => (
        <Textarea
          {...control}
          rows={2}
          spellCheck={false}
          autoComplete="off"
          placeholder="mongodb://localhost:27017"
          value={sync.uri}
          onChange={(event) => {
            sync.onUriChange(event.target.value);
          }}
          onBlur={sync.onUriBlur}
        />
      )}
    </FormField>
  );
}
