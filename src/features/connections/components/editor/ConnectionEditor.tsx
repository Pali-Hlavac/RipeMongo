import { useEffect } from "react";

import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";

import { useSaveConnection } from "../../api/profiles";
import { useConnectionSession, useTestConnection } from "../../api/session";
import { useConnectionDraft } from "../../hooks/useConnectionDraft";
import { suggestName } from "../../lib/defaults";
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
  const { profile, secrets } = draft;
  const save = useSaveConnection();
  const test = useTestConnection();
  const { connect } = useConnectionSession();
  const resetTest = test.reset;

  // A test result describes the settings it ran with; drop it once they change.
  useEffect(() => {
    resetTest();
  }, [profile.config, secrets, resetTest]);

  const submit = async (connectAfterSave: boolean) => {
    const name = profile.name.trim() || suggestName(profile.config);
    let saved: ConnectionProfile;
    try {
      saved = await save.mutateAsync({ profile: { ...profile, name }, secrets });
    } catch {
      return; // Shown by the global mutation error toast; the dialog stays open to fix it.
    }
    onDone();
    if (connectAfterSave) await connect(saved);
  };

  const sectionProps = { draft, stored };
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(false);
      }}
    >
      <UriField draft={draft} />
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

      <TestResult server={test.data} error={test.error} />

      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={test.isPending}
          onClick={() => {
            test.mutate({ config: profile.config, connectionId: profile.id || null, secrets });
          }}
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
