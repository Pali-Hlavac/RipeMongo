/** Color labels for connections and their display styles. */
import type { ConnectionColor } from "../types";

export const CONNECTION_COLORS: readonly {
  value: ConnectionColor;
  label: string;
  className: string;
}[] = [
  { value: "red", label: "Red", className: "bg-red-500" },
  { value: "orange", label: "Orange", className: "bg-orange-500" },
  { value: "amber", label: "Amber", className: "bg-amber-400" },
  { value: "green", label: "Green", className: "bg-green-500" },
  { value: "teal", label: "Teal", className: "bg-teal-500" },
  { value: "blue", label: "Blue", className: "bg-blue-500" },
  { value: "purple", label: "Purple", className: "bg-purple-500" },
  { value: "pink", label: "Pink", className: "bg-pink-500" },
];

/** Background class for a color label; transparent when unset. */
export function colorClass(color: ConnectionColor | null): string {
  return CONNECTION_COLORS.find((option) => option.value === color)?.className ?? "bg-transparent";
}
