import { emptyToNull, switchMechanism, usernameOf, usesPassword } from "./auth";

describe("switchMechanism", () => {
  it("keeps the user name when switching between mechanisms", () => {
    const scram = switchMechanism({ mechanism: "none" }, "scram");
    expect(scram).toEqual({ mechanism: "scram", username: "", authSource: null, variant: "auto" });

    const alice = {
      mechanism: "scram",
      username: "alice",
      authSource: null,
      variant: "auto",
    } as const;
    const ldap = switchMechanism(alice, "ldap");
    expect(ldap).toEqual({ mechanism: "ldap", username: "alice" });

    const aws = switchMechanism(ldap, "aws");
    expect(aws).toEqual({ mechanism: "aws", accessKeyId: "alice" });
    expect(usernameOf(aws)).toBe("alice");
  });

  it("drops the user name for no authentication", () => {
    expect(switchMechanism({ mechanism: "ldap", username: "x" }, "none")).toEqual({
      mechanism: "none",
    });
  });
});

describe("helpers", () => {
  it("knows which mechanisms use the password", () => {
    expect(usesPassword("scram")).toBe(true);
    expect(usesPassword("x509")).toBe(false);
  });

  it("turns blank input into null", () => {
    expect(emptyToNull("  ")).toBeNull();
    expect(emptyToNull("admin")).toBe("admin");
  });
});
