# 0012. Canonical Extended JSON on the wire, shell syntax for people

- Status: Accepted
- Date: 2026-10-22

## Context

BSON has types JSON lacks (ObjectId, Date, Int64, Decimal128, Binary/UUID, Regex, Timestamp,
MinKey/MaxKey, …). JavaScript numbers lose precision above 2^53, and `JSON.parse` reorders
integer-like keys, while MongoDB field order is meaningful. Users type queries the way they do
in mongosh (`{_id: ObjectId("…"), at: {$gte: ISODate("2024-01-01")}}`), not strict JSON.

## Decision

- **Input** (filters, projections, sorts, pipelines, documents): the backend parser
  `src-tauri/src/ejson/` accepts strict JSON, canonical/relaxed Extended JSON and mongosh
  syntax (unquoted keys, single quotes, comments, trailing commas, `/re/i`, `ObjectId`,
  `ISODate`/`new Date`, `NumberLong`/`NumberInt`/`NumberDecimal`, `UUID`, `BinData`,
  `Timestamp`, `MinKey`/`MaxKey`, …). Errors carry line and column, and name the query part
  ("Filter: …").
- **Wire format** (backend → webview): each document is a **canonical Extended JSON string**
  (`to_canonical_json`), which is lossless and type-preserving. `serde_json` uses
  `preserve_order`.
- **Frontend model**: `documents/lib/ordered-json.ts` parses those strings keeping entry order,
  and `lib/bson.ts` turns them into a typed `BsonValue` tree. Numbers stay strings, so Int64
  and Decimal128 are never rounded.
- **Display/copy format**: mongosh-style shell syntax (`lib/format.ts` `toShell`). It is the
  same syntax the parser accepts; a Rust test parses the frontend's exact output and compares
  it with the original canonical JSON, so copying and (later) editing round-trip.

## Consequences

- Payloads are larger than relaxed JSON (`{"$numberInt":"5"}` instead of `5`), bounded by page
  size (ADR 0011).
- Two small parsers exist (Rust input parser, TS ordered-JSON reader); both are unit tested,
  and the round trip between them is tested.
- Types without a shell constructor (Code, Symbol, DBPointer, unknown wrappers) are shown and
  copied as Extended JSON objects, which the parser also accepts.
