import {
  buildCopyRequest,
  initialCopyValues,
  targetName,
  validateCopyForm,
  withTargetConnection,
  type CopyFormValues,
} from "./copy";

const collection = { connectionId: "c1", database: "shop", collection: "orders" };
const database = { connectionId: "c1", database: "shop", collection: null };

describe("copy form", () => {
  it("suggests a new name in the same connection and the same names in another", () => {
    const values = initialCopyValues(collection);
    expect(values).toMatchObject({ database: "shop", collection: "orders_copy", indexes: true });
    expect(initialCopyValues(database)).toMatchObject({ database: "shop_copy", collection: "" });

    const elsewhere = withTargetConnection(collection, values, "c2");
    expect(elsewhere).toMatchObject({ targetConnectionId: "c2", collection: "orders" });
    const edited = { ...elsewhere, collection: "archive", namesEdited: true };
    expect(withTargetConnection(collection, edited, "c1").collection).toBe("archive");
    expect(targetName(collection, edited)).toBe("archive");
    expect(targetName(database, initialCopyValues(database))).toBe("shop_copy");
  });

  it("refuses copying onto the source and empty names", () => {
    const same: CopyFormValues = { ...initialCopyValues(collection), collection: " orders " };
    expect(validateCopyForm(collection, same)).toEqual({
      collection: "This is the collection you copy from. Enter another name.",
    });
    expect(
      validateCopyForm(database, { ...initialCopyValues(database), database: "shop" }),
    ).toEqual({ database: "This is the database you copy from. Enter another name." });
    const other = withTargetConnection(collection, initialCopyValues(collection), "c2");
    expect(validateCopyForm(collection, other)).toEqual({});
    expect(validateCopyForm(collection, { ...other, database: " ", collection: "" })).toEqual({
      database: "Enter a database name.",
      collection: "Enter a collection name.",
    });
  });

  it("builds requests with only the options of their scope", () => {
    const values: CopyFormValues = {
      ...initialCopyValues(collection),
      query: " { total: 1 } ",
      excluded: ["logs"],
      prefixes: "tmp_, ",
      indexes: false,
      drop: true,
    };
    expect(buildCopyRequest(collection, values)).toEqual({
      database: "shop",
      collection: "orders",
      targetDatabase: "shop",
      targetCollection: "orders_copy",
      query: "{ total: 1 }",
      excludeCollections: [],
      excludePrefixes: [],
      indexes: false,
      drop: true,
    });
    expect(buildCopyRequest(database, { ...values, database: "shop_copy" })).toMatchObject({
      collection: null,
      targetDatabase: "shop_copy",
      targetCollection: null,
      query: null,
      excludeCollections: ["logs"],
      excludePrefixes: ["tmp_"],
    });
  });
});
