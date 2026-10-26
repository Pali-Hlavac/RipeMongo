import type { CopyRequest } from "@/shared/ipc/bindings";

import type { CopyTarget } from "../store/transfer";
import { parsePrefixes } from "./dump";

/** Added to the name when copying within the same connection. */
const COPY_SUFFIX = "_copy";

/** Everything the copy dialog edits. */
export interface CopyFormValues {
  targetConnectionId: string;
  /** Target database name. */
  database: string;
  /** Target collection name; collection copies only. */
  collection: string;
  /** True once the user typed a name, which then stays when the connection changes. */
  namesEdited: boolean;
  /** Collection copies only. */
  query: string;
  /** Database copies only: unticked collections. */
  excluded: string[];
  /** Database copies only: comma-separated name prefixes. */
  prefixes: string;
  indexes: boolean;
  drop: boolean;
}

/** "shop" or "shop.orders". */
export function copyScope(target: CopyTarget): string {
  return target.collection === null ? target.database : `${target.database}.${target.collection}`;
}

/** The source's names in another connection; with a suffix in the same one. */
export function suggestedNames(
  target: CopyTarget,
  targetConnectionId: string,
): Pick<CopyFormValues, "database" | "collection"> {
  const same = targetConnectionId === target.connectionId;
  if (target.collection === null) {
    return {
      database: same ? `${target.database}${COPY_SUFFIX}` : target.database,
      collection: "",
    };
  }
  return {
    database: target.database,
    collection: same ? `${target.collection}${COPY_SUFFIX}` : target.collection,
  };
}

/** A copy into the same connection under a suggested name. */
export function initialCopyValues(target: CopyTarget): CopyFormValues {
  return {
    targetConnectionId: target.connectionId,
    ...suggestedNames(target, target.connectionId),
    namesEdited: false,
    query: "",
    excluded: [],
    prefixes: "",
    indexes: true,
    drop: false,
  };
}

/** Values after picking another target connection. */
export function withTargetConnection(
  target: CopyTarget,
  values: CopyFormValues,
  targetConnectionId: string,
): CopyFormValues {
  const names = values.namesEdited ? {} : suggestedNames(target, targetConnectionId);
  return { ...values, ...names, targetConnectionId };
}

/** "copy" or "copy.orders": what the copy writes, and what dropping asks the user to type. */
export function targetName(target: CopyTarget, values: CopyFormValues): string {
  return target.collection === null ? values.database.trim() : values.collection.trim();
}

export interface CopyFormErrors {
  targetConnection?: string;
  database?: string;
  collection?: string;
}

/** Checks what the backend cannot explain field by field; empty when the form is complete. */
export function validateCopyForm(target: CopyTarget, values: CopyFormValues): CopyFormErrors {
  const errors: CopyFormErrors = {};
  const database = values.database.trim();
  const collection = values.collection.trim();
  if (values.targetConnectionId === "") errors.targetConnection = "Choose a connection.";
  if (database === "") errors.database = "Enter a database name.";
  if (target.collection !== null && collection === "") {
    errors.collection = "Enter a collection name.";
  }
  if (values.targetConnectionId === target.connectionId && database === target.database) {
    if (target.collection === null) {
      errors.database = "This is the database you copy from. Enter another name.";
    } else if (collection === target.collection) {
      errors.collection = "This is the collection you copy from. Enter another name.";
    }
  }
  return errors;
}

/** The request sent to `start_copy`; options outside the target's scope are dropped. */
export function buildCopyRequest(target: CopyTarget, values: CopyFormValues): CopyRequest {
  const single = target.collection !== null;
  const query = values.query.trim();
  return {
    database: target.database,
    collection: target.collection,
    targetDatabase: values.database.trim(),
    targetCollection: single ? values.collection.trim() : null,
    query: single && query !== "" ? query : null,
    excludeCollections: single ? [] : values.excluded,
    excludePrefixes: single ? [] : parsePrefixes(values.prefixes),
    indexes: values.indexes,
    drop: values.drop,
  };
}
