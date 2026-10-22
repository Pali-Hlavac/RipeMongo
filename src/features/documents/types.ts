/** Document types: generated IPC types plus the parsed form the views render. */
import type { BsonDocument } from "./lib/bson";

export type {
  CollectionQueries,
  DocumentCount,
  FieldEdit,
  FindPage,
  FindRequest,
  QueryParts,
  SavedQuery,
} from "@/shared/ipc/bindings";

/** One loaded document. */
export interface LoadedDocument {
  /** Stable React key within a page. */
  key: string;
  /** Canonical Extended JSON as received (lossless). */
  json: string;
  value: BsonDocument;
}

export interface DocumentPage {
  documents: LoadedDocument[];
  hasMore: boolean;
}
