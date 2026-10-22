import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";

import { useSaveConnection } from "../../api/profiles";
import { useConnectionSession, useTestConnection } from "../../api/session";
import { useConnectionDraft } from "../../hooks/useConnectionDraft";
import { useUriSync } from "../../hooks/useUriSync";
import { suggestName } from "../../lib/defaults";
import { settingsFingerprint, withParsedUri, type DraftValues } from "../../lib/draft";
import type { ConnectionProfile, StoredSecrets } from "../../types";
import { AdvancedTab } from "./AdvancedTab";
import { AuthTab } from "./AuthTab";
import { GeneralTab } from "./GeneralTab";
import { SshTab } from "./SshTab";
import { TestResult } from "./TestResult";
import { TlsTab } from "./TlsTab";
import { UriField } from "./UriField";

interface ConnectionEditorProps {
  initial: ConnectionProfile;
  stored: StoredSecrets | undefined;
  folders: string[];
  onDone: () => void;
}

/** Form body and actions of the connection editor dialog. */
export function ConnectionEditor({ initial, stored, folders, onDone }: ConnectionEditorProps) {
  const draft = useConnectionDraft(initial);
  const { profile, values } = draft;
  const uriSync = useUriSync({ config: profile.config, onParsed: draft.applyParsedUri });
  const save = useSaveConnection();
  const test = useTestConnection();
  const { connect } = useConnectionSession();
  // Fingerprint of the settings the last test ran with; its result is shown only while the
  // form still matches, so editing after a test never shows a stale "Connected".
  const [testedWith, setTestedWith] = useState<string | null>(null);

  /** Current values including a URI that is still being typed; `null` if it is invalid. */
  const latestValues = async (): Promise<DraftValues | null> => {
    const flushed = await uriSync.flush();
    if (flushed.kind === "invalid") return null;
    return flushed.kind === "parsed" ? withParsedUri(values, flushed.parsed) : values;
  };

  const runTest = async () => {
    const latest = await latestValues();
    if (!latest) return;
    setTestedWith(settingsFingerprint(latest));
    test.mutate({
      config: latest.profile.config,
      connectionId: latest.profile.id || null,
      secrets: latest.secrets,
    });
  };

  const submit = async (connectAfterSave: boolean) => {
    const latest = await latestValues();
    if (!latest) return;
    const name = latest.profile.name.trim() || suggestName(latest.profile.config);
    let saved: ConnectionProfile;
    try {
      saved = await save.mutateAsync({
        profile: { ...latest.profile, name },
        secrets: latest.secrets,
      });
    } catch {
      return; // Shown by the global mutation error toast; the dialog stays open to fix it.
    }
    onDone();
    if (connectAfterSave) await connect(saved);
  };

  const testIsCurrent = testedWith === settingsFingerprint(values);
  const sectionProps = { draft, stored };
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(false);
      }}
    >
      <UriField sync={uriSync} />
      <Tabs defaultValue="general">
        <TabsList aria-label="Connection settings">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="auth">Authentication</TabsTrigger>
          <TabsTrigger value="tls">TLS</TabsTrigger>
          <TabsTrigger value="ssh">SSH tunnel</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <GeneralTab {...sectionProps} folders={folders} />
        </TabsContent>
        <TabsContent value="auth">
          <AuthTab {...sectionProps} />
        </TabsContent>
        <TabsContent value="tls">
          <TlsTab {...sectionProps} />
        </TabsContent>
        <TabsContent value="ssh">
          <SshTab {...sectionProps} />
        </TabsContent>
        <TabsContent value="advanced">
          <AdvancedTab {...sectionProps} />
        </TabsContent>
      </Tabs>

      <TestResult
        server={testIsCurrent ? test.data : undefined}
        error={testIsCurrent ? test.error : null}
      />

      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={test.isPending}
          onClick={() => void runTest()}
        >
          {test.isPending ? "Testing…" : "Test connection"}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="outline" disabled={save.isPending}>
            Save
          </Button>
          <Button type="button" disabled={save.isPending} onClick={() => void submit(true)}>
            Save &amp; connect
          </Button>
        </div>
      </div>
    </form>
  );
}
