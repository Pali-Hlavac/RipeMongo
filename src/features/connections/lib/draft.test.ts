import { defaultConfig, defaultSshConfig, newProfile } from "./defaults";
import { settingsFingerprint, withParsedUri } from "./draft";
import { KEEP_ALL_SECRETS } from "./secrets";

const noSecrets = {
  password: null,
  awsSessionToken: null,
  tlsKeyPassword: null,
  sshPassword: null,
  sshKeyPassphrase: null,
};

describe("withParsedUri", () => {
  it("replaces the config but keeps the SSH tunnel and routes URI secrets", () => {
    const ssh = defaultSshConfig();
    const draft = {
      profile: { ...newProfile(), name: "Kept", config: { ...defaultConfig(), ssh } },
      secrets: KEEP_ALL_SECRETS,
    };
    const parsedConfig = { ...defaultConfig(), replicaSet: "rs0" };
    const next = withParsedUri(draft, {
      config: parsedConfig,
      secrets: { ...noSecrets, password: "pw" },
    });

    expect(next.profile.name).toBe("Kept");
    expect(next.profile.config.replicaSet).toBe("rs0");
    expect(next.profile.config.ssh).toBe(ssh);
    expect(next.secrets.password).toEqual({ action: "set", value: "pw" });
    expect(next.secrets.sshPassword).toEqual({ action: "keep" });
  });
});

describe("settingsFingerprint", () => {
  it("ignores profile metadata but tracks config and secrets", () => {
    const base = { profile: newProfile(), secrets: KEEP_ALL_SECRETS };
    const renamed = { ...base, profile: { ...base.profile, name: "Other" } };
    const withPassword = {
      ...base,
      secrets: { ...KEEP_ALL_SECRETS, password: { action: "set" as const, value: "x" } },
    };
    expect(settingsFingerprint(renamed)).toBe(settingsFingerprint(base));
    expect(settingsFingerprint(withPassword)).not.toBe(settingsFingerprint(base));
  });
});
