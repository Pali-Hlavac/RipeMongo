/** Human-readable numbers and sizes for the UI. */

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;
const BYTES_PER_UNIT = 1024;
/** Values below this get one decimal (e.g. "1.5 MB"), larger ones none ("15 MB"). */
const DECIMAL_THRESHOLD = 10;

/** `1536` → `"1.5 KB"`. */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= BYTES_PER_UNIT && unit < BYTE_UNITS.length - 1) {
    value /= BYTES_PER_UNIT;
    unit += 1;
  }
  const digits = unit === 0 || value >= DECIMAL_THRESHOLD ? 0 : 1;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unit] ?? "B"}`;
}

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const grouped = new Intl.NumberFormat();

/** Short count for tight spaces: `12345` → `"12K"`. */
export function formatCompactCount(count: number): string {
  return compact.format(count);
}

/** Full count with digit grouping: `12345` → `"12,345"` (locale dependent). */
export function formatCount(count: number): string {
  return grouped.format(count);
}
