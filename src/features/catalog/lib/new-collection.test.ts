import {
  newCollectionDraft,
  toRequest,
  validateDraft,
  type NewCollectionDraft,
} from "./new-collection";

const draft = (extra: Partial<NewCollectionDraft>): NewCollectionDraft => ({
  ...newCollectionDraft(),
  name: "events",
  ...extra,
});

describe("validateDraft", () => {
  it("accepts a standard collection with a name", () => {
    expect(validateDraft(draft({}))).toEqual({});
    expect(validateDraft(draft({ name: "" }))).toHaveProperty("name");
  });

  it("requires a positive capped size and a whole document limit", () => {
    const errors = validateDraft(
      draft({ kind: "capped", cappedSizeMb: "0", cappedMaxDocuments: "1.5" }),
    );
    expect(Object.keys(errors).sort()).toEqual(["cappedMaxDocuments", "cappedSizeMb"]);
  });

  it("requires a time field for time series and a source for views", () => {
    expect(validateDraft(draft({ kind: "timeSeries" }))).toHaveProperty("timeField");
    expect(validateDraft(draft({ kind: "view" }))).toHaveProperty("viewOn");
  });
});

describe("toRequest", () => {
  it("converts capped sizes from megabytes to bytes", () => {
    expect(toRequest(draft({ kind: "capped", cappedSizeMb: "1.5" }))).toEqual({
      type: "collection",
      name: "events",
      options: { kind: "capped", sizeBytes: 1_572_864, maxDocuments: null },
    });
  });

  it("drops blank optional time-series fields", () => {
    expect(
      toRequest(draft({ kind: "timeSeries", timeField: " ts ", granularity: "minutes" })),
    ).toEqual({
      type: "collection",
      name: "events",
      options: {
        kind: "timeSeries",
        timeField: "ts",
        metaField: null,
        granularity: "minutes",
        expireAfterSeconds: null,
      },
    });
  });

  it("builds a view with its source and pipeline", () => {
    const request = toRequest({ ...newCollectionDraft("orders"), name: "open" });
    expect(request).toMatchObject({ type: "view", view: { name: "open", viewOn: "orders" } });
  });
});
