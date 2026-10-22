import { collectionNameError, databaseNameError } from "./names";

describe("databaseNameError", () => {
  it.each(["shop", "my_db-2", "Ünïcode"])("accepts %s", (name) => {
    expect(databaseNameError(name)).toBeNull();
  });

  it.each(["", "a.b", "a b", "a/b", "a$b", "x".repeat(64)])("rejects %j", (name) => {
    expect(databaseNameError(name)).not.toBeNull();
  });
});

describe("collectionNameError", () => {
  it.each(["users", "orders.archive", "with space"])("accepts %s", (name) => {
    expect(collectionNameError(name)).toBeNull();
  });

  it.each(["", "a$b", "system.users"])("rejects %j", (name) => {
    expect(collectionNameError(name)).not.toBeNull();
  });
});
