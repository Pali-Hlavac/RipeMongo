import { documentsPhrase, hasMatches, isAbout, sampleText } from "./bulk";

describe("bulk helpers", () => {
  it("phrases counts", () => {
    expect(documentsPhrase({ count: 0, estimated: false })).toBe("no documents");
    expect(documentsPhrase({ count: 1, estimated: false })).toBe("1 document");
    expect(documentsPhrase({ count: 1500, estimated: true })).toBe(
      `about ${(1500).toLocaleString()} documents`,
    );
    expect(documentsPhrase({ count: null, estimated: false })).toBe(
      "an unknown number of documents",
    );
  });

  it("allows applying only when something matches", () => {
    expect(hasMatches({ count: 0, estimated: false })).toBe(false);
    expect(hasMatches({ count: 3, estimated: false })).toBe(true);
  });

  it("recognizes which part an error is about", () => {
    expect(isAbout("Update: Expected ':' (line 2, column 3)", "Update")).toBe(true);
    expect(isAbout("Update: Expected ':' (line 2, column 3)", "Filter")).toBe(false);
  });

  it("shows samples in shell syntax", () => {
    expect(sampleText('{"_id":{"$numberInt":"1"},"a":"x"}')).toBe('{\n  _id: 1,\n  a: "x"\n}');
  });
});
