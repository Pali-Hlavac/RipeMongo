import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { commands } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { defaultConfig, newProfile } from "../../lib/defaults";
import { ConnectionEditor } from "./ConnectionEditor";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: {
    buildConnectionString: vi.fn(),
    parseConnectionString: vi.fn(),
    saveConnection: vi.fn(),
    testConnection: vi.fn(),
    openConnection: vi.fn(),
    listActiveConnections: vi.fn(),
  },
}));

const PARSED_HOST = "db.example.com";

beforeEach(() => {
  vi.mocked(commands.buildConnectionString).mockResolvedValue("mongodb://localhost:27017/");
  vi.mocked(commands.parseConnectionString).mockReturnValue(
    ok({
      config: {
        ...defaultConfig(),
        hosts: [{ host: PARSED_HOST, port: 27018 }],
        auth: { mechanism: "scram", username: "app", authSource: null, variant: "auto" },
      },
      secrets: {
        password: "pw",
        awsSessionToken: null,
        tlsKeyPassword: null,
        sshPassword: null,
        sshKeyPassphrase: null,
      },
    }),
  );
  vi.mocked(commands.saveConnection).mockImplementation((profile) =>
    ok({ ...profile, id: "new-id" }),
  );
});

function renderEditor(onDone = vi.fn()) {
  renderWithProviders(
    <ConnectionEditor initial={newProfile()} stored={undefined} folders={[]} onDone={onDone} />,
  );
  return onDone;
}

describe("ConnectionEditor", () => {
  it("shows the URI built from the form", async () => {
    renderEditor();
    expect(await screen.findByDisplayValue("mongodb://localhost:27017/")).toBeInTheDocument();
  });

  it("fills the form from a pasted URI and saves its password as a secret", async () => {
    const user = userEvent.setup();
    const onDone = renderEditor();
    const uriField = screen.getByRole("textbox", { name: "Connection string" });

    await user.clear(uriField);
    await user.click(uriField);
    await user.paste("mongodb://app:pw@db.example.com:27018");
    expect(await screen.findByDisplayValue(PARSED_HOST)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
    const [savedProfile, savedSecrets] = vi.mocked(commands.saveConnection).mock.calls[0] ?? [];
    expect(savedProfile?.name).toBe(`${PARSED_HOST}:27018`);
    expect(savedProfile?.config.auth).toMatchObject({ mechanism: "scram", username: "app" });
    expect(savedSecrets?.password).toEqual({ action: "set", value: "pw" });
    expect(savedSecrets?.sshPassword).toEqual({ action: "keep" });
  });

  it("tests straight from the URI field (blur and click in one gesture)", async () => {
    vi.mocked(commands.testConnection).mockReturnValue(
      ok({
        version: "8.0.4",
        topology: "standalone",
        replicaSetName: null,
        hosts: [],
        primary: null,
        writable: true,
      }),
    );
    const user = userEvent.setup();
    renderEditor();
    const uriField = screen.getByRole("textbox", { name: "Connection string" });
    await user.clear(uriField);
    await user.click(uriField);
    await user.paste("mongodb://app:pw@db.example.com:27018");
    await user.click(screen.getByRole("button", { name: "Test connection" }));

    expect(await screen.findByText("Connected successfully")).toBeInTheDocument();
    const [, , secrets] = vi.mocked(commands.testConnection).mock.calls[0] ?? [];
    expect(secrets?.password).toEqual({ action: "set", value: "pw" });
  });

  it("shows URI parse errors inline without changing the form", async () => {
    vi.mocked(commands.parseConnectionString).mockReturnValue(
      Promise.resolve({
        status: "error",
        error: { code: "INVALID_INPUT", message: "The connection string has no host.", hint: null },
      }),
    );
    const user = userEvent.setup();
    renderEditor();
    const uriField = screen.getByRole("textbox", { name: "Connection string" });
    await user.clear(uriField);
    await user.type(uriField, "mongodb://");

    expect(await screen.findByText("The connection string has no host.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("localhost")).toBeInTheDocument();
  });
});
