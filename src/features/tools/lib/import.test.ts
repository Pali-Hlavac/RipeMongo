import type { ImportPreview } from "@/shared/ipc/bindings";

import {
  buildImportRequest,
  collectionFromPath,
  importColumns,
  initialImportValues,
  parseWorkers,
  validateImportForm,
  type ImportFormValues,
} from "./import";

const target = { connectionId: "c1", database: "shop", collection: null };

const csv: ImportPreview = {
  format: "csv",
  size: 120,
  delimiter: ";",
  columns: [
    { first: "zip", samples: ["01234"], suggestion: { type: "string", dateFormat: "" } },
    {
      first: "born",
      samples: ["05.03.2024"],
      suggestion: { type: "date", dateFormat: "dd.MM.yyyy" },
    },
    { first: " ", samples: ["x"], suggestion: { type: "auto", dateFormat: "" } },
  ],
};

function values(overrides: Partial<ImportFormValues> = {}): ImportFormValues {
  return {
    ...initialImportValues(target),
    path: "C:\\data\\people.csv",
    collection: "people",
    ...overrides,
  };
}

describe("import form", () => {
  it("suggests a collection name from the file name", () => {
    expect(collectionFromPath("C:\\data\\people.export.csv")).toBe("people.export");
    expect(collectionFromPath("/home/ann/$orders.json")).toBe("orders");
    expect(collectionFromPath("notes")).toBe("notes");
  });

  it("names columns from the header line and applies the user's changes", () => {
    const columns = importColumns(csv, values({ columnEdits: { 0: { type: "int32" } } }));
    expect(columns.map((column) => column.field)).toEqual(["zip", "born", "field3"]);
    expect(columns[0]?.type).toBe("int32");
    expect(columns[1]?.dateFormat).toBe("dd.MM.yyyy");
    const unnamed = importColumns(csv, values({ header: false }));
    expect(unnamed.map((column) => column.field)).toEqual(["field1", "field2", "field3"]);
    expect(importColumns(undefined, values())).toEqual([]);
  });

  it("validates the file, the collection and the columns", () => {
    expect(validateImportForm(values({ path: "", collection: " " }), undefined)).toEqual({
      path: "Choose a file.",
      collection: "Enter a collection name.",
    });
    const none = { 0: { include: false }, 1: { include: false }, 2: { include: false } };
    expect(validateImportForm(values({ columnEdits: none }), csv).columns).toBe(
      "Choose at least one column.",
    );
    expect(validateImportForm(values({ columnEdits: { 2: { field: "zip" } } }), csv).columns).toBe(
      "Two columns have the same field name.",
    );
    expect(
      validateImportForm(values({ columnEdits: { 1: { dateFormat: " " } } }), csv).columns,
    ).toBe("Enter the format of every date column.");
    expect(validateImportForm(values(), csv)).toEqual({});
  });

  it("accepts 1 to 16 insert workers, or blank for one", () => {
    expect(parseWorkers("")).toBeNull();
    expect(parseWorkers(" 8 ")).toBe(8);
    for (const bad of ["0", "17", "2.5", "two"]) expect(parseWorkers(bad)).toBeUndefined();
    expect(validateImportForm(values({ workers: "0" }), csv).workers).toBe(
      "Enter a whole number from 1 to 16.",
    );
  });

  it("builds CSV and JSON requests", () => {
    const request = buildImportRequest(
      target,
      values({
        columnEdits: { 0: { type: "auto" }, 2: { include: false } },
        mode: "merge",
        matchFields: " email, ,name ",
        ignoreBlanks: true,
        parseErrors: "skipRow",
        workers: "4",
        bypassValidation: true,
      }),
      csv,
    );
    expect(request).toMatchObject({
      database: "shop",
      collection: "people",
      format: "csv",
      delimiter: ";",
      header: true,
      ignoreBlanks: true,
      parseErrors: "skipRow",
      mode: "merge",
      matchFields: ["email", "name"],
      insertionWorkers: 4,
      bypassValidation: true,
    });
    expect(request.columns[0]).toEqual({
      include: true,
      field: "zip",
      type: "auto",
      dateFormat: "",
    });
    expect(request.columns[1]?.dateFormat).toBe("dd.MM.yyyy");
    expect(request.columns[2]?.include).toBe(false);

    const json = buildImportRequest(
      target,
      values({ ignoreBlanks: true, parseErrors: "skipRow", drop: true }),
      { format: "jsonArray", size: 10, delimiter: ",", columns: [] },
    );
    expect(json).toMatchObject({
      format: "jsonArray",
      columns: [],
      header: false,
      ignoreBlanks: false,
      parseErrors: "stop",
      matchFields: [],
      drop: true,
      insertionWorkers: null,
      bypassValidation: false,
    });
  });
});
