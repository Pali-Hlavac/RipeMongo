/** Props shared by every tab of the connection editor. */
import type { ConnectionDraft } from "../../hooks/useConnectionDraft";
import type { StoredSecrets } from "../../types";

export interface SectionProps {
  draft: ConnectionDraft;
  /** Which secrets are saved for the edited connection; `undefined` for a new one. */
  stored: StoredSecrets | undefined;
}
