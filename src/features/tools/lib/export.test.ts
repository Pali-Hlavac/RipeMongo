import {
  buildExportRequest,
  chosenFields,
  exportFileName,
  initialExportValues,
  parseCount,
  sampledFields,
  validateExportForm,
  type ExportFormValues,
} from "./export";

const target = { connectionId: "c1", database: "shop", collection: "orders" };
const sample = { fields: ["_id", "name", "address"], paths: ["_id", "name", "address.city"] };

function values(overrides: Partial<ExportFormValues> = {}): ExportFormValues {
  return { ...initialExportValues(target), path: "C:\\out\\orders.json", ...overrides };
}

describe("export form", () => {
  it("starts from the documents tab's query", () => {
    const start = initialExportValues({
      ...target,
      query: { filter: "{ a: 1 }", sort: "{ b: -1 }", skip: 0, limit: 25, projection: "" },
    });
    expect(start).toMatchObject({ filter: "{ a: 1 }", sort: "{ b: -1 }", skip: "", limit: "25" });
  });

  it("switches known extensions with the format", () => {
    expect(exportFileName("C:\\out\\orders.json", "csv")).toBe("C:\\out\\orders.csv");
    expect(exportFileName("orders.CSV", "json")).toBe("orders.json");
    expect(exportFileName("C:\\out\\orders.txt", "csv")).toBe("C:\\out\\orders.txt");
  });

  it("offers top-level fields for JSON and nested paths for CSV", () => {
    expect(sampledFields(sample, "json")).toEqual(sample.fields);
    expect(sampledFields(sample, "csv")).toEqual(sample.paths);
    expect(sampledFields(undefined, "csv")).toEqual([]);
  });

  it("exports whole JSON documents when every field is ticked", () => {
    expect(chosenFields(values(), sample.fields)).toEqual([]);
    expect(chosenFields(values({ unticked: ["address"] }), sample.fields)).toEqual(["_id", "name"]);
    expect(chosenFields(values({ extraFields: "notes, name" }), sample.fields)).toEqual([
      "_id",
      "name",
      "address",
      "notes",
    ]);
    expect(chosenFields(values({ format: "csv" }), sample.paths)).toEqual(sample.paths);
  });

  it("validates the file, fields and numbers", () => {
    expect(validateExportForm(values({ path: " " }), sample.fields)).toEqual({
      path: "Choose a file.",
    });
    expect(validateExportForm(values({ unticked: sample.fields }), sample.fields)).toEqual({
      fields: "Choose a field.",
    });
    // An empty collection: JSON exports everything, CSV needs typed fields.
    expect(validateExportForm(values(), [])).toEqual({});
    expect(validateExportForm(values({ format: "csv" }), [])).toEqual({
      fields: "Choose the fields that become columns.",
    });
    expect(validateExportForm(values({ skip: "-1", limit: "2.5" }), sample.fields)).toEqual({
      skip: "Enter a whole number.",
      limit: "Enter a whole number.",
    });
    expect(parseCount(" ")).toBeNull();
    expect(parseCount("10")).toBe(10);
  });

  it("builds a request without the other format's options", () => {
    const csv = values({
      format: "csv",
      path: " C:\\out\\orders.csv ",
      pretty: true,
      header: false,
      unticked: ["_id"],
      filter: " { a: 1 } ",
      sort: " ",
      limit: "5",
    });
    expect(buildExportRequest(target, csv, sample.paths)).toEqual({
      database: "shop",
      collection: "orders",
      path: "C:\\out\\orders.csv",
      format: "csv",
      fields: ["name", "address.city"],
      jsonArray: false,
      pretty: false,
      canonical: false,
      header: false,
      query: "{ a: 1 }",
      sort: null,
      skip: null,
      limit: 5,
    });
  });
});
