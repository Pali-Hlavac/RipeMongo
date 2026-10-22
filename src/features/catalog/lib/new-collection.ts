/**
 * Form state of the "Create collection" dialog and its conversion into backend options.
 * Numbers are kept as typed text so half-typed values never jump around.
 */
import type { NewCollectionOptions, NewView, TimeSeriesGranularity } from "../types";
import { collectionNameError } from "./names";

export type NewCollectionKind = "standard" | "capped" | "timeSeries" | "view";

export interface NewCollectionDraft {
  kind: NewCollectionKind;
  name: string;
  /** Capped: maximum size in megabytes. */
  cappedSizeMb: string;
  cappedMaxDocuments: string;
  timeField: string;
  metaField: string;
  granularity: TimeSeriesGranularity | "";
  expireAfterSeconds: string;
  viewOn: string;
  pipeline: string;
}

const BYTES_PER_MB = 1024 * 1024;
/** Sensible default for capped collections; the server requires a size. */
const DEFAULT_CAPPED_SIZE_MB = "16";
const DEFAULT_PIPELINE = "[\n  { $match: {} }\n]";

export function newCollectionDraft(viewOn?: string): NewCollectionDraft {
  return {
    kind: viewOn === undefined ? "standard" : "view",
    name: "",
    cappedSizeMb: DEFAULT_CAPPED_SIZE_MB,
    cappedMaxDocuments: "",
    timeField: "",
    metaField: "",
    granularity: "",
    expireAfterSeconds: "",
    viewOn: viewOn ?? "",
    pipeline: DEFAULT_PIPELINE,
  };
}

/** What to send to the backend: a collection with options, or a view. */
export type NewCollectionRequest =
  | { type: "collection"; name: string; options: NewCollectionOptions }
  | { type: "view"; view: NewView };

/** Field → message for every problem in the draft; empty when it can be submitted. */
export type DraftErrors = Partial<Record<keyof NewCollectionDraft, string>>;

/** Parses an optional whole number; `undefined` means "not a valid number". */
function optionalWholeNumber(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

export function validateDraft(draft: NewCollectionDraft): DraftErrors {
  const errors: DraftErrors = {};
  const nameError = collectionNameError(draft.name);
  if (nameError) errors.name = nameError;
  const wholeNumber = "Enter a whole number of 0 or more.";
  switch (draft.kind) {
    case "capped": {
      const size = Number(draft.cappedSizeMb.trim());
      if (draft.cappedSizeMb.trim() === "" || !(size > 0)) {
        errors.cappedSizeMb = "Enter a size above 0.";
      }
      if (optionalWholeNumber(draft.cappedMaxDocuments) === undefined) {
        errors.cappedMaxDocuments = wholeNumber;
      }
      break;
    }
    case "timeSeries":
      if (draft.timeField.trim() === "") errors.timeField = "Enter the field that holds the time.";
      if (optionalWholeNumber(draft.expireAfterSeconds) === undefined) {
        errors.expireAfterSeconds = wholeNumber;
      }
      break;
    case "view":
      if (draft.viewOn === "") errors.viewOn = "Choose the source collection.";
      break;
    case "standard":
      break;
  }
  return errors;
}

/** Converts a valid draft (see {@link validateDraft}) into the backend request. */
export function toRequest(draft: NewCollectionDraft): NewCollectionRequest {
  const name = draft.name;
  switch (draft.kind) {
    case "standard":
      return { type: "collection", name, options: { kind: "standard" } };
    case "capped":
      return {
        type: "collection",
        name,
        options: {
          kind: "capped",
          sizeBytes: Math.round(Number(draft.cappedSizeMb) * BYTES_PER_MB),
          maxDocuments: optionalWholeNumber(draft.cappedMaxDocuments) ?? null,
        },
      };
    case "timeSeries":
      return {
        type: "collection",
        name,
        options: {
          kind: "timeSeries",
          timeField: draft.timeField.trim(),
          metaField: draft.metaField.trim() || null,
          granularity: draft.granularity || null,
          expireAfterSeconds: optionalWholeNumber(draft.expireAfterSeconds) ?? null,
        },
      };
    case "view":
      return { type: "view", view: { name, viewOn: draft.viewOn, pipeline: draft.pipeline } };
  }
}
