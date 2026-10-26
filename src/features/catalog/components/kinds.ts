/** Icons and spoken names of collection kinds, shared by the tree and "Go to collection". */
import { ClockIcon, EyeIcon, Table2Icon, type LucideIcon } from "lucide-react";

import type { CollectionKind } from "../types";

export const KIND_ICONS: Record<CollectionKind, LucideIcon> = {
  collection: Table2Icon,
  view: EyeIcon,
  timeseries: ClockIcon,
};

/** Spoken after the name of non-standard kinds, which only an icon shows visually. */
export const KIND_LABELS: Record<CollectionKind, string> = {
  collection: "collection",
  view: "view",
  timeseries: "time series",
};
