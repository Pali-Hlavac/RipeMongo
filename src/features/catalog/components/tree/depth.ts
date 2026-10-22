/**
 * Left padding of database (1) and collection (2) rows, below a connection row (0). Static
 * class names so Tailwind's scanner finds them.
 */
export const DEPTH_PADDING = { 1: "pl-5", 2: "pl-10" } as const;
